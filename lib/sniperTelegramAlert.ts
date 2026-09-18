// ══════════════════════════════════════════════════════════════════════════
//  SNIPER SCANNER (CURRENT SIGNAL) → TELEGRAM
//
//  Mengirim coin yang muncul di panel "CURRENT SIGNAL" halaman /sniper-scanner
//  (hasil app/api/crypto-scanner/sniper-scan/route.ts) ke Telegram, lengkap
//  dengan:
//    1. ringkasan KENAPA coin itu masuk list (sinyal aktif + bobotnya, sama
//       seperti `selectedActive` / `selectedReason` di SniperScanner.tsx), dan
//    2. blok "FUTURES RECOMMENDATION · $SYM/USDT PERP" (arah, leverage,
//       Entry/TP1/TP2/SL/Est. Liquidasi, R/R, support-resistance, faktor) —
//       dihitung dengan `getFuturesAnalysis` dari lib/futuresAnalysis.ts, yaitu
//       fungsi yang SAMA dengan yang dipakai panel UI, jadi angka di Telegram
//       identik dengan angka di halaman sniper-scanner (tidak ada duplikasi
//       rumus / drift).
//
//  Config (reuse yang sudah ada):
//    • TELEGRAM_BOT_TOKEN  (env, sama seperti lib/telegramNotify.ts)
//    • chatId default -1004431059985 (grup super forum)
//    • topic default 2 (topik TRADE) — override via SNIPER_TELEGRAM_TOPIC_ID
//
//  Sifat:
//    • Fire-and-forget — tidak pernah melempar error / memblokir response API.
//    • Hanya coin dengan skor ≥ SNIPER_TG_MIN_SCORE (default 80 = tier
//      "🎯 SNIPER") yang dikirim. WATCH/SETUP/WAIT tidak dikirim.
//    • DEDUP + COOLDOWN persisten (.data/sniper-telegram-sent.json): kombinasi
//      symbol+timeframe yang sudah dikirim tidak dikirim ulang selama masa
//      cooldown (default 4 jam). Scanner di-refetch berkala oleh client, jadi
//      tanpa cooldown satu setup yang sama akan terkirim berulang kali.
//    • Rate-limit: jeda 3s antar pesan + retry 429 (pola telegramNotify.ts).
//    • Keyboard hanya berisi tombol URL TradingView (tanpa callback).
// ══════════════════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import { getFuturesAnalysis } from './futuresAnalysis'
import { DATA_DIR } from './dataDir'

// ─── Tipe (cermin bentuk data dari sniper-scan route) ───────────────────────
export type SniperSignalEntry = { active: boolean; score: number; label: string }

export type SniperCoinAlert = {
  symbol: string
  signal: string
  price: number
  ch24h: number
  score: number
  rsi: number
  volRatio: number
  closes?: number[]
  signals: Record<string, SniperSignalEntry>
}

/** Bobot maksimal tiap sinyal — sama persis dengan SIGNAL_MAX di SniperScanner.tsx. */
const SIGNAL_MAX: Record<string, number> = {
  sweep: 25,
  volume: 20,
  candle: 15,
  bos: 20,
  fvg: 10,
  rsi: 10,
}

// ─── Konfigurasi ────────────────────────────────────────────────────────────
const TG = {
  botToken: () => (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  chatId: () => (process.env.TELEGRAM_CHAT_ID || '-1004431059985').trim(),
  topicId: () => parseInt(process.env.SNIPER_TELEGRAM_TOPIC_ID || '2', 10) || 0,
  sendTimeoutMs: 10_000,
  minIntervalMs: 3_000,
}

const CFG = {
  enabled: () => (process.env.SNIPER_TELEGRAM_ALERTS || 'true').trim().toLowerCase() !== 'false',
  // Ambang skor. 80 = tier "🎯 SNIPER" di analyzeSniper(); turunkan ke 60 bila
  // ingin ikut mengirim tier "👀 WATCH".
  minScore: () => Math.max(0, parseInt(process.env.SNIPER_TG_MIN_SCORE || '80', 10) || 0),
  // Cooldown dedup per symbol+timeframe (jam).
  cooldownHours: () => Math.max(0.5, parseFloat(process.env.SNIPER_TG_COOLDOWN_HOURS || '4')),
  maxPerCycle: () => Math.max(1, parseInt(process.env.SNIPER_TG_MAX_PER_CYCLE || '3', 10)),
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
}

/** Format harga — sama dengan formatPrice() di SniperScanner.tsx. */
function formatPrice(price: number): string {
  const n = Number(price)
  if (!Number.isFinite(n)) return '—'
  if (n < 0.01) return n.toFixed(6)
  if (n < 1) return n.toFixed(4)
  return n.toFixed(2)
}

// ─── Dedup store persisten (tahan restart & hot-reload) ────────────────────
type SentStore = { map: Record<string, number>; loaded: boolean; sending: boolean }
const gkey = '__crypycryptSniperTgSent__' as const
const gstore = globalThis as typeof globalThis & { [gkey]?: SentStore }
function store(): SentStore {
  return (gstore[gkey] ??= { map: {}, loaded: false, sending: false })
}

const STORE_DIR = DATA_DIR
const STORE_PATH = path.join(STORE_DIR, 'sniper-telegram-sent.json')
const MAX_KEYS = 2000

function loadStore(): void {
  const s = store()
  if (s.loaded) return
  s.loaded = true
  try {
    if (fs.existsSync(STORE_PATH)) {
      const obj = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'))
      if (obj && typeof obj === 'object') s.map = obj as Record<string, number>
    }
  } catch (e) {
    console.warn('[sniperTg] gagal baca dedup store:', (e as Error)?.message)
  }
}

function persistStore(): void {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true })
    fs.writeFileSync(STORE_PATH, JSON.stringify(store().map))
  } catch (e) {
    console.warn('[sniperTg] gagal simpan dedup store:', (e as Error)?.message)
  }
}

/** Key dedup: symbol + timeframe. TF berbeda = konteks sinyal berbeda. */
const dedupKey = (coin: SniperCoinAlert, tf: string) => `${String(coin.symbol).toUpperCase()}:${String(tf).toLowerCase()}`

/** true bila sudah dikirim dalam jendela cooldown. */
function inCooldown(key: string): boolean {
  const ts = store().map[key]
  if (!ts) return false
  return Date.now() - ts < CFG.cooldownHours() * 3_600_000
}

function markSent(key: string): void {
  const s = store()
  s.map[key] = Date.now()
  const keys = Object.keys(s.map)
  if (keys.length > MAX_KEYS) keys.slice(0, keys.length - MAX_KEYS).forEach((k) => delete s.map[k])
  persistStore()
}

// ─── Penyusunan pesan ──────────────────────────────────────────────────────
/** Sinyal aktif terurut bobot (maks 4) — cermin `selectedActive` di UI. */
function activeTop(coin: SniperCoinAlert): Array<[string, SniperSignalEntry]> {
  return Object.entries(coin.signals || {})
    .filter(([, s]) => s?.active)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 4)
}

/**
 * Susun teks HTML Telegram: CURRENT SIGNAL + alasan masuk list +
 * FUTURES RECOMMENDATION · $SYM/USDT PERP.
 */
export function buildSniperSignalText(coin: SniperCoinAlert, tf: string): string {
  const symbol = String(coin.symbol).toUpperCase()
  const badge = String(coin.signal || '').replace(/^\S+\s/, '') || 'SIGNAL'
  const active = activeTop(coin)
  const consensus = Object.values(coin.signals || {}).filter((s) => s?.active).length
  const reason = active.length
    ? active.map(([, s]) => s.label).join(' + ')
    : 'Menunggu konfirmasi sinyal lebih kuat'

  // Rekomendasi futures — input sintetis IDENTIK dengan useMemo `futures` di
  // SniperScanner.tsx supaya hasilnya sama persis dengan panel UI.
  const f = getFuturesAnalysis({
    symbol,
    current_price: coin.price,
    price_change_percentage_1h_in_currency: 0,
    price_change_percentage_24h: coin.ch24h,
    price_change_percentage_7d_in_currency: 0,
    market_cap: 0,
    total_volume: 0,
    sparkline_in_7d: { price: coin.closes || [] },
  })
  const isShort = f.direction.startsWith('short')
  const tp2Pct = (parseFloat(f.rewardPct) * 1.8).toFixed(2)

  const lines: string[] = [
    `🎯 <b>SNIPER SIGNAL</b> · $${esc(symbol)} · TF ${esc(String(tf).toUpperCase())}`,
    `<b>${esc(badge)}</b> · Skor <b>${Math.round(coin.score)}</b>/100`,
    ``,
    `$${esc(symbol)} @ $${formatPrice(coin.price)} · ${coin.ch24h >= 0 ? '+' : ''}${Number(coin.ch24h).toFixed(2)}% 24H`,
    `RSI ${Number(coin.rsi).toFixed(1)} · Vol Ratio ${Number(coin.volRatio).toFixed(1)}x · Consensus ${consensus}/6`,
    ``,
    `🧠 <b>KENAPA MASUK LIST</b>`,
  ]

  if (active.length) {
    active.forEach(([key, s]) => {
      const max = SIGNAL_MAX[key] || 1
      lines.push(`• ${esc(key.toUpperCase())} <b>${s.score}</b>/${max} — ${esc(s.label)}`)
    })
  } else {
    lines.push(`• Belum ada komponen aktif`)
  }
  lines.push(``, `Ringkasan: ${esc(reason)}`)

  lines.push(
    ``,
    `📊 <b>FUTURES RECOMMENDATION · $${esc(symbol)}/USDT PERP</b>`,
    `Rekomendasi: ${f.dirEmoji} <b>${esc(f.dirLabel)}</b> · Leverage <b>${f.leverage}×</b>`,
    `Score ${f.score >= 0 ? '+' : ''}${f.score} · Confidence ${esc(f.confidence)} · Volatilitas ${esc(f.volatilityLevel)}`,
    ``,
    `🎯 Entry  $${esc(f.entry.replace(/^\$/, ''))}`,
    `✅ TP1  $${esc(f.tp1.replace(/^\$/, ''))}  (${isShort ? '−' : '+'}${f.rewardPct}%)`,
    `🚀 TP2  $${esc(f.tp2.replace(/^\$/, ''))}  (${isShort ? '−' : '+'}${tp2Pct}%)`,
    `🛑 SL  $${esc(f.sl.replace(/^\$/, ''))}  (${isShort ? '+' : '−'}${f.riskPct}%)`,
    `💀 Est. Liquidasi  $${esc(f.liqEstimate.replace(/^\$/, ''))}  (pada ${f.leverage}×)`,
    ``,
    `R/R 1:${esc(f.rrRatio)} · RSI ${esc(f.rsi)} · ATR ${esc(f.atrPct)}%`,
    `Support $${esc(f.support.replace(/^\$/, ''))} · Resistance $${esc(f.resistance.replace(/^\$/, ''))}`
  )

  if (f.factors?.length) {
    lines.push(`Faktor: ${esc(f.factors.slice(0, 6).join(' · '))}`)
  }

  lines.push(``, `⚠️ Bukan saran finansial — DYOR. Sniper scanner = setup spot; level futures di atas turunan logika ATR/support-resistance.`)

  // Jaga batas 4096 karakter teks Telegram.
  const text = lines.join('\n')
  return text.length > 4000 ? `${text.slice(0, 4000)}…` : text
}

function buildKeyboard(coin: SniperCoinAlert): any[][] {
  const symbol = String(coin.symbol || '').toUpperCase()
  return [
    [
      { text: '📈 TradingView', url: `https://www.tradingview.com/chart/?symbol=BINANCE:${encodeURIComponent(symbol)}USDT.P` },
    ],
  ]
}

// ─── Transport ─────────────────────────────────────────────────────────────
async function sendText(text: string, keyboard: any[][] | null, attempt = 0): Promise<boolean> {
  try {
    const body: any = {
      chat_id: TG.chatId(),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }
    const topic = TG.topicId()
    if (topic > 0) body.message_thread_id = topic
    if (keyboard) body.reply_markup = { inline_keyboard: keyboard }
    const res = await fetch(`https://api.telegram.org/bot${TG.botToken()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TG.sendTimeoutMs),
    })
    if (res.status === 429 && attempt < 2) {
      const b = await res.json().catch(() => null)
      await sleep(Math.min(30, Number(b?.parameters?.retry_after) || 5) * 1000)
      return sendText(text, keyboard, attempt + 1)
    }
    if (!res.ok) {
      const b = await res.json().catch(() => null)
      console.warn('[sniperTg] sendMessage HTTP', res.status, String(b?.description || '').slice(0, 160))
      return false
    }
    return true
  } catch (e) {
    console.warn('[sniperTg] sendMessage gagal:', String((e as Error)?.message || e).slice(0, 120))
    return false
  }
}

/** Kirim satu sinyal sniper. Tidak pernah melempar. */
export async function sendSniperSignal(coin: SniperCoinAlert, tf: string): Promise<boolean> {
  if (!TG.botToken()) return false
  return sendText(buildSniperSignalText(coin, tf), buildKeyboard(coin))
}

/**
 * Saring + kirim coin CURRENT SIGNAL dari hasil sniper-scan. Dipanggil
 * fire-and-forget dari app/api/crypto-scanner/sniper-scan/route.ts tepat
 * sebelum response dikembalikan — tidak menambah latensi API. Guard `sending`
 * mencegah dispatch paralel (beberapa client bisa refetch bersamaan).
 */
export function dispatchSniperAlerts(coins: SniperCoinAlert[], tf: string): void {
  try {
    if (!CFG.enabled()) return
    if (!TG.botToken()) return
    if (!Array.isArray(coins) || coins.length === 0) return

    const s = store()
    if (s.sending) return
    loadStore()

    const minScore = CFG.minScore()
    const qualified = coins.filter((coin) => {
      if (!coin?.symbol || !Number.isFinite(Number(coin.score))) return false
      if (Number(coin.score) < minScore) return false
      return !inCooldown(dedupKey(coin, tf))
    })
    if (qualified.length === 0) return

    // Prioritaskan skor tertinggi, batasi per siklus.
    qualified.sort((a, b) => Number(b.score) - Number(a.score))
    const batch = qualified.slice(0, CFG.maxPerCycle())

    s.sending = true
    void (async () => {
      try {
        for (const coin of batch) {
          const ok = await sendSniperSignal(coin, tf)
          if (ok) markSent(dedupKey(coin, tf))
          await sleep(TG.minIntervalMs)
        }
      } catch (e) {
        console.warn('[sniperTg] dispatch error:', String((e as Error)?.message || e).slice(0, 120))
      } finally {
        s.sending = false
      }
    })()
  } catch (e) {
    console.warn('[sniperTg] dispatch guard error:', String((e as Error)?.message || e).slice(0, 120))
  }
}
