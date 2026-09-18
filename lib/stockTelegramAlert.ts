// ══════════════════════════════════════════════════════════════════════════
//  STOCK SCANNER (IDX + US) → TELEGRAM
//
//  Mengirim sinyal BUY/SELL dari lib/stockSignalEngine.ts (menu Stocks →
//  IDX Stocks / US Stocks) ke Telegram. BUY membawa entry/SL/TP1-3/R:R
//  lengkap; SELL cuma peringatan distribusi (lihat buildStockSignalText),
//  keduanya plus confidence, Kelly/EV, dan konteks struktur/institusi/sniper — semua
//  angka diambil langsung dari StockSignal yang sama dipakai UI, tidak ada
//  duplikasi rumus.
//
//  Config (reuse pola yang sudah ada di lib/sniperTelegramAlert.ts):
//    • TELEGRAM_BOT_TOKEN  (env, sama seperti alert lain)
//    • chatId default -1004431059985 (grup super forum yang sama)
//    • topic default 21458 (topik khusus Stocks) — override via
//      STOCK_TELEGRAM_TOPIC_ID
//
//  Sifat:
//    • Fire-and-forget — tidak pernah melempar / memblokir caller.
//    • Hanya sinyal dengan confidence ≥ STOCK_TG_MIN_CONFIDENCE (default 55)
//      yang dikirim.
//    • DEDUP + COOLDOWN persisten (.data/stock-telegram-sent.json): kombinasi
//      market+ticker+arah yang sudah dikirim tidak dikirim ulang selama masa
//      cooldown (default 12 jam) — scan berjalan tiap ~20 menit, jadi tanpa
//      cooldown setup yang sama akan terkirim berulang kali.
//    • Rate-limit: jeda 3s antar pesan + retry 429.
// ══════════════════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import type { StockSignal, StockMarket } from './stockSignalEngine'
import { DATA_DIR } from './dataDir'

// ─── Konfigurasi ────────────────────────────────────────────────────────────
const TG = {
  botToken: () => (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  chatId: () => (process.env.TELEGRAM_CHAT_ID || '-1004431059985').trim(),
  topicId: () => parseInt(process.env.STOCK_TELEGRAM_TOPIC_ID || '21458', 10) || 0,
  sendTimeoutMs: 10_000,
  minIntervalMs: 3_000,
}

const CFG = {
  enabled: () => (process.env.STOCK_TELEGRAM_ALERTS || 'true').trim().toLowerCase() !== 'false',
  minConfidence: () => Math.max(0, parseInt(process.env.STOCK_TG_MIN_CONFIDENCE || '55', 10) || 0),
  cooldownHours: () => Math.max(0.5, parseFloat(process.env.STOCK_TG_COOLDOWN_HOURS || '12')),
  maxPerCycle: () => Math.max(1, parseInt(process.env.STOCK_TG_MAX_PER_CYCLE || '5', 10)),
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
}

function formatPrice(price: number, currency: 'IDR' | 'USD'): string {
  const n = Number(price)
  if (!Number.isFinite(n)) return '—'
  if (currency === 'IDR') return 'Rp' + Math.round(n).toLocaleString('id-ID')
  return '$' + (n >= 1 ? n.toFixed(2) : n.toFixed(4))
}

// ─── Dedup store persisten (tahan restart & hot-reload) ────────────────────
type SentStore = { map: Record<string, number>; loaded: boolean; sending: boolean }
const gkey = '__crypycryptStockTgSent__' as const
const gstore = globalThis as typeof globalThis & { [gkey]?: SentStore }
function store(): SentStore {
  return (gstore[gkey] ??= { map: {}, loaded: false, sending: false })
}

const STORE_DIR = DATA_DIR
const STORE_PATH = path.join(STORE_DIR, 'stock-telegram-sent.json')
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
    console.warn('[stockTg] gagal baca dedup store:', (e as Error)?.message)
  }
}

function persistStore(): void {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true })
    fs.writeFileSync(STORE_PATH, JSON.stringify(store().map))
  } catch (e) {
    console.warn('[stockTg] gagal simpan dedup store:', (e as Error)?.message)
  }
}

/** Key dedup: market + ticker + arah sinyal. */
const dedupKey = (s: StockSignal) => `${s.market}:${s.ticker}:${s.signal}`

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
export function buildStockSignalText(s: StockSignal): string {
  const isBuy = s.signal === 'BUY'
  const marketLabel = s.market === 'IDX' ? '🇮🇩 IDX' : '🇺🇸 US'
  const dirEmoji = isBuy ? '🟢' : '🔴'
  const p = (v: number) => formatPrice(v, s.currency)

  const lines: string[] = [
    `${dirEmoji} <b>${esc(s.signal)} SIGNAL</b> · ${marketLabel} · $${esc(s.coinSymbol)}`,
    `${esc(s.coinName)}`,
    ``,
    `Harga @ ${p(s.currentPrice)} · ${s.priceChange24h >= 0 ? '+' : ''}${s.priceChange24h.toFixed(2)}% hari ini`,
    `Confidence <b>${s.confidence}%</b> · Bullish ${s.bullish}% / Bearish ${s.bearish}%`,
    `${esc(s.signalReason)}`,
    ``,
  ]

  // BUY carries a real position structure (entry/SL/TP). SELL on stocks means
  // "distribution / trim if you hold" — not "open a short" — so it never
  // shows entry/stop/target numbers (see comment on StockSignal in
  // lib/stockSignalEngine.ts). Kelly/EV still reflect the underlying
  // probability edge either way.
  if (isBuy && s.entryLow != null && s.entryHigh != null && s.stopLoss != null) {
    lines.push(
      `🎯 Entry  ${p(s.entryLow)} — ${p(s.entryHigh)}`,
      `🛑 Stop Loss  ${p(s.stopLoss)}  (${s.stopDistancePct}%)`,
      `✅ TP1  ${p(s.tp1!)}`,
      `🚀 TP2  ${p(s.tp2!)}`,
      `🏁 TP3  ${p(s.tp3!)}`,
      `R:R 1:${s.rr} · Kelly ${(s.kellyFraction * 100).toFixed(2)}% · EV ${s.expectedValue}`,
      ``,
    )
  } else {
    lines.push(
      `⚠️ Sinyal distribusi/tekanan jual — bukan rekomendasi short. Pertimbangkan kurangi porsi bila sudah hold, atau tunggu di pinggir.`,
      `Kelly ${(s.kellyFraction * 100).toFixed(2)}% · EV ${s.expectedValue}`,
      ``,
    )
  }

  lines.push(
    `📈 Trend ${esc(s.trend)} · Pola ${esc(s.chartPattern)} · BOS ${esc(s.bos)}`,
    `🏦 Institusi ${esc(s.whaleBias)} (${s.whaleScore}) · Vol ${s.volumeRatio}x · Fase ${esc(s.volPhase)}`,
    `RSI ${s.rsi.toFixed(1)} · MACD ${esc(s.macdCrossover)} · HTF ${esc(s.htfTrend)} (${s.htfAligned ? 'aligned' : 'kontra'})`,
    `🎯 Sniper ${s.sniperScore}/100 (${esc(s.sniperSignal)}) · Regime ${esc(s.marketRegime)}`,
    ``,
    `⚠️ Bukan saran finansial — DYOR.`,
  )

  const text = lines.join('\n')
  return text.length > 4000 ? `${text.slice(0, 4000)}…` : text
}

function buildKeyboard(s: StockSignal): any[][] {
  const bare = s.coinSymbol.toUpperCase()
  return [
    [
      { text: '📰 Yahoo Finance', url: `https://finance.yahoo.com/quote/${encodeURIComponent(s.ticker)}` },
      { text: '📈 TradingView', url: `https://www.tradingview.com/symbols/${encodeURIComponent(bare)}/` },
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
      console.warn('[stockTg] sendMessage HTTP', res.status, String(b?.description || '').slice(0, 160))
      return false
    }
    return true
  } catch (e) {
    console.warn('[stockTg] sendMessage gagal:', String((e as Error)?.message || e).slice(0, 120))
    return false
  }
}

/** Kirim satu sinyal saham. Tidak pernah melempar. */
export async function sendStockSignal(s: StockSignal): Promise<boolean> {
  if (!TG.botToken()) return false
  return sendText(buildStockSignalText(s), buildKeyboard(s))
}

/**
 * Saring + kirim sinyal hasil scan. Dipanggil fire-and-forget dari
 * runLiveStockScan() di lib/stockSignalEngine.ts tepat setelah satu siklus
 * scan selesai — bukan per-request API, supaya tidak terkirim berulang
 * hanya karena banyak client polling cache yang sama.
 */
export function dispatchStockAlerts(signals: StockSignal[], market: StockMarket): void {
  try {
    if (!CFG.enabled()) return
    if (!TG.botToken()) return
    if (!Array.isArray(signals) || signals.length === 0) return

    const s = store()
    if (s.sending) return
    loadStore()

    const minConfidence = CFG.minConfidence()
    const qualified = signals.filter((sig) => {
      if (!sig?.ticker || !Number.isFinite(sig.confidence)) return false
      if (sig.confidence < minConfidence) return false
      return !inCooldown(dedupKey(sig))
    })
    if (qualified.length === 0) return

    qualified.sort((a, b) => b.confidence - a.confidence)
    const batch = qualified.slice(0, CFG.maxPerCycle())

    s.sending = true
    void (async () => {
      try {
        for (const sig of batch) {
          const ok = await sendStockSignal(sig)
          if (ok) markSent(dedupKey(sig))
          await sleep(TG.minIntervalMs)
        }
      } catch (e) {
        console.warn('[stockTg] dispatch error:', String((e as Error)?.message || e).slice(0, 120))
      } finally {
        s.sending = false
      }
    })()
  } catch (e) {
    console.warn('[stockTg] dispatch guard error:', String((e as Error)?.message || e).slice(0, 120))
  }
}
