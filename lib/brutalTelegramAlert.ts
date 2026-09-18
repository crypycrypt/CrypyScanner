// ══════════════════════════════════════════════════════════════════════════
//  BRUTAL FUTURES → TELEGRAM SIGNAL
//
//  Mengirim sinyal BRUTAL FUTURES (panel di Dashboard, hasil scan perpetual
//  Binance di lib/brutalEngine.ts) ke Telegram — diadaptasi dari sample
//  telegramCryptoSignal.js user, dengan field DIPETAKAN ke tipe BrutalSignal
//  yang benar-benar ada (side/entry/triggerPrice/status/factors/fundingPct/
//  oiChangePct/topLsr/takerRatio — bukan field LiveSignal).
//
//  Config (reuse yang sudah ada):
//    • TELEGRAM_BOT_TOKEN  (env, sama seperti lib/telegramNotify.ts)
//    • chatId default -1004431059985 (grup super forum)
//    • topic default 2 (topik TRADE) — override via BRUTAL_TELEGRAM_TOPIC_ID
//
//  Sifat:
//    • Fire-and-forget — tidak pernah melempar error ke paperTrader tick.
//    • Hanya sinyal berstatus EXECUTE (lolos gerbang brutalEngine, termasuk
//      pending order yang trigger-nya baru tersentuh) yang dikirim. WAIT/WEAK/
//      NEUTRAL tidak dikirim — sama seperti aturan eksekusi paper trader.
//    • DEDUP + COOLDOWN persisten (.data/brutal-telegram-sent.json): kombinasi
//      symbol+side yang sudah dikirim tidak dikirim ulang selama masa cooldown
//      (default 4 jam). Sinyal futures muncul kembali tiap scan (~90s) selama
//      setup masih valid — tanpa cooldown akan spam. Bila side berbalik
//      (LONG→SHORT) itu dianggap sinyal baru dan tetap dikirim.
//    • Rate-limit: jeda 3s antar pesan + retry 429 (pola telegramNotify.ts).
//    • Keyboard hanya berisi tombol URL TradingView (tanpa callback).
// ══════════════════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import type { BrutalSignal } from './brutalEngine'
import { fmtPrice } from './brutalEngine'
import { DATA_DIR } from './dataDir'

// ─── Konfigurasi ────────────────────────────────────────────────────────────
const TG = {
  botToken: () => (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  chatId: () => (process.env.TELEGRAM_CHAT_ID || '-1004431059985').trim(),
  topicId: () => parseInt(process.env.BRUTAL_TELEGRAM_TOPIC_ID || '2', 10) || 0,
  sendTimeoutMs: 10_000,
  minIntervalMs: 3_000,
}

const CFG = {
  enabled: () => (process.env.BRUTAL_TELEGRAM_ALERTS || 'true').trim().toLowerCase() !== 'false',
  // Cooldown dedup per symbol+side (jam). Sinyal yang sama tidak dikirim ulang
  // selama jendela ini walau muncul di setiap scan.
  cooldownHours: () => Math.max(0.5, parseFloat(process.env.BRUTAL_TG_COOLDOWN_HOURS || '4')),
  maxPerCycle: () => Math.max(1, parseInt(process.env.BRUTAL_TG_MAX_PER_CYCLE || '3', 10)),
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
}

function pct(v: number | null | undefined, digits = 1): string {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`
}

// ─── Dedup store persisten (tahan restart & hot-reload) ────────────────────
type SentStore = { map: Record<string, number>; loaded: boolean; sending: boolean }
const gkey = '__crypycryptBrutalTgSent__' as const
const gstore = globalThis as typeof globalThis & { [gkey]?: SentStore }
function store(): SentStore {
  return (gstore[gkey] ??= { map: {}, loaded: false, sending: false })
}

const STORE_DIR = DATA_DIR
const STORE_PATH = path.join(STORE_DIR, 'brutal-telegram-sent.json')
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
    console.warn('[brutalTg] gagal baca dedup store:', (e as Error)?.message)
  }
}

function persistStore(): void {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true })
    fs.writeFileSync(STORE_PATH, JSON.stringify(store().map))
  } catch (e) {
    console.warn('[brutalTg] gagal simpan dedup store:', (e as Error)?.message)
  }
}

/** Key dedup: symbol + side. Side berbalik = sinyal baru. */
const dedupKey = (sig: BrutalSignal) => `${String(sig.symbol).toUpperCase()}:${sig.side}`

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

// ─── Penyusunan pesan (adaptasi sample telegramCryptoSignal.js) ────────────
const STATUS_ICON: Record<string, string> = {
  EXECUTE: '⚡',
  WAIT_BREAKOUT: '⏳',
  WAIT_PULLBACK: '⏳',
  WEAK: '◦',
  NEUTRAL: '⚪',
}

function buildStatusLine(sig: BrutalSignal): string {
  const icon = STATUS_ICON[sig.status] || '⚡'
  const label = sig.status === 'EXECUTE'
    ? 'EKSEKUSI'
    : sig.status === 'WAIT_BREAKOUT' || sig.status === 'WAIT_PULLBACK'
      ? 'TUNGGU KONFIRMASI'
      : sig.status === 'WEAK' ? 'SINYAL LEMAH' : 'NETRAL'
  return `${icon} <b>${label}</b> · ${sig.side} <b>${esc(sig.coinSymbol.toUpperCase())}</b> · ${sig.leverage}×`
}

export function buildBrutalSignalText(sig: BrutalSignal, regime?: string): string {
  const entry = sig.entry > 0 ? sig.entry : sig.price
  const stopDistPct = entry > 0 ? (Math.abs(entry - sig.stopLoss) / entry) * 100 : 0
  const ageMin = sig.scannedAt ? (Date.now() - new Date(sig.scannedAt).getTime()) / 60_000 : 0

  const lines = [
    buildStatusLine(sig),
    `Entry ${fmtPrice(entry)}${sig.triggerPrice && sig.triggerPrice !== entry ? ` (trigger ${fmtPrice(sig.triggerPrice)})` : ''} · SL ${fmtPrice(sig.stopLoss)} (−${stopDistPct.toFixed(1)}%)`,
    `TP1 ${fmtPrice(sig.tp1)}${sig.tp2 ? ` · TP2 ${fmtPrice(sig.tp2)}` : ''} · R:R 1:${Number(sig.rr || 0).toFixed(1)}`,
    ``,
    `📊 Skor ${sig.score >= 0 ? '+' : ''}${sig.score}/10 · Conf ${Math.round(sig.confidence)}%`,
  ]

  // Baris alasan — maksimal 3 faktor terkuat dari engine + konteks derivatif.
  const reasons: string[] = []
  if (sig.structure) reasons.push(sig.structure.replace(/_/g, ' '))
  if (sig.htfAligned) reasons.push('HTF aligned')
  if (typeof sig.fundingPct === 'number') reasons.push(`funding ${pct(sig.fundingPct, 3)}`)
  if (typeof sig.oiChangePct === 'number') reasons.push(`ΔOI ${pct(sig.oiChangePct)}`)
  if (sig.factors?.length) reasons.push(...sig.factors.slice(0, 2))
  if (reasons.length) lines.push(`🧠 ${esc(reasons.slice(0, 3).join(' · '))}`)

  lines.push(
    `⏱ Umur ${Math.max(0, ageMin).toFixed(0)}m · RSI ${sig.rsi.toFixed(0)} · ATR ${sig.atrPct.toFixed(1)}%` +
      (regime ? ` · Regime ${esc(regime.toUpperCase())}` : '')
  )

  return lines.join('\n')
}

function buildKeyboard(sig: BrutalSignal): any[][] {
  const symbol = String(sig.coinSymbol || '').toUpperCase()
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
      console.warn('[brutalTg] sendMessage HTTP', res.status)
      return false
    }
    return true
  } catch (e) {
    console.warn('[brutalTg] sendMessage gagal:', String((e as Error)?.message || e).slice(0, 120))
    return false
  }
}

/** Kirim satu sinyal futures. Tidak pernah melempar. */
export async function sendBrutalSignal(sig: BrutalSignal, regime?: string): Promise<boolean> {
  if (!TG.botToken()) return false
  return sendText(buildBrutalSignalText(sig, regime), buildKeyboard(sig))
}

/**
 * Saring + kirim sinyal EXECUTE dari hasil tick brutalEngine. Dipanggil
 * fire-and-forget dari syncBrutal() di lib/paperTrader.ts. Tidak pernah
 * melempar / memblokir tick. Guard `sending` mencegah dispatch paralel.
 */
export function dispatchBrutalAlerts(signals: BrutalSignal[], regime?: string): void {
  try {
    if (!CFG.enabled()) return
    if (!TG.botToken()) return
    if (!Array.isArray(signals) || signals.length === 0) return

    const s = store()
    if (s.sending) return
    loadStore()

    // Hanya yang layak eksekusi (EXECUTE / pending ter-trigger) — gerbangnya
    // sudah dihitung brutalEngine, di sini tidak menghitung ulang logic apa pun.
    const qualified = signals.filter((sig) => {
      if (!sig?.executable || sig.side === 'NEUTRAL') return false
      return !inCooldown(dedupKey(sig))
    })
    if (qualified.length === 0) return

    // Prioritaskan confidence tertinggi, batasi per siklus.
    qualified.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    const batch = qualified.slice(0, CFG.maxPerCycle())

    s.sending = true
    void (async () => {
      try {
        for (const sig of batch) {
          const ok = await sendBrutalSignal(sig, regime)
          if (ok) markSent(dedupKey(sig))
          await sleep(TG.minIntervalMs)
        }
      } catch (e) {
        console.warn('[brutalTg] dispatch error:', String((e as Error)?.message || e).slice(0, 120))
      } finally {
        s.sending = false
      }
    })()
  } catch (e) {
    console.warn('[brutalTg] dispatch guard error:', String((e as Error)?.message || e).slice(0, 120))
  }
}
