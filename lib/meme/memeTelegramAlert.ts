// ══════════════════════════════════════════════════════════════════════════
//  MEME RADAR → TELEGRAM ALERT
//
//  Mengirim sinyal token dari radar Meme's ke Telegram sebagai pesan bergambar
//  (logo token) + caption HTML + inline keyboard, diadaptasi dari sample
//  telegramAlertButtons.js user. Memakai CONFIG YANG SUDAH ADA:
//    • TELEGRAM_BOT_TOKEN  (env, sama seperti lib/telegramNotify.ts)
//    • chatId default -1004431059985 (grup super forum, sama seperti telegramNotify)
//    • topic default 21662 (topik khusus Meme's) — bisa di-override TELEGRAM_MEME_TOPIC_ID
//
//  Sifat:
//    • Fire-and-forget — TIDAK PERNAH melempar error ke pemanggil (route radar).
//    • No-op bila TELEGRAM_BOT_TOKEN kosong atau MEME_TELEGRAM_ALERTS=false.
//    • DEDUP PERMANEN per contract address: token yang sudah pernah dikirim
//      tidak dikirim ulang, bahkan setelah server restart (store JSON di disk
//      .data/meme-telegram-sent.json + cache globalThis agar tahan hot-reload).
//    • Rate-limit: kirim berurutan dengan jeda 3s + retry 429 (hormati
//      retry_after, maks 2 percobaan) — pola sama dengan lib/telegramNotify.ts.
//    • Hanya sinyal KUAT yang dikirim (bucket != NONE, holderGate != FAIL,
//      tidak rugged, aiScore & likuiditas di atas ambang) — lihat CFG.
//
//  Catatan tombol "Copy CA": memakai callback_data sehingga butuh webhook
//  (app/api/telegram/webhook/route.ts) + setWebhook URL publik agar aktif.
//  Tanpa webhook pun CA tetap bisa disalin karena ditulis sebagai <code> di
//  caption (tap-to-copy native Telegram).
// ══════════════════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import { DATA_DIR } from '../dataDir'

// ─── Konfigurasi (reuse config yang sudah ada) ─────────────────────────────
const TG = {
  botToken: () => (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  chatId: () => (process.env.TELEGRAM_CHAT_ID || '-1004431059985').trim(),
  topicId: () => parseInt(process.env.TELEGRAM_MEME_TOPIC_ID || '21662', 10) || 0,
  captionLimit: 1024,        // batas caption pesan bergambar Telegram
  sendTimeoutMs: 10_000,
  minIntervalMs: 3_000,      // jeda antar pesan (≈20 pesan/menit, aman per grup)
}

// Ambang penyaring sinyal — semua bisa di-override lewat env.
const CFG = {
  enabled: () => (process.env.MEME_TELEGRAM_ALERTS || 'true').trim().toLowerCase() !== 'false',
  minAiScore: () => parseInt(process.env.MEME_TG_MIN_AI_SCORE || '65', 10),
  minLiquidity: () => parseInt(process.env.MEME_TG_MIN_LIQUIDITY || '5000', 10),
  maxPerCycle: () => Math.max(1, parseInt(process.env.MEME_TG_MAX_PER_CYCLE || '4', 10)),
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Escape untuk parse_mode HTML Telegram.
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
}

// Format USD ringkas: $9.2K / $1.5M / $2.3B
function compactUsd(v: number): string {
  const n = Number(v) || 0
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${Math.round(n)}`
}

// ─── Dedup store persisten (tahan restart) ─────────────────────────────────
type SentStore = { map: Record<string, number>; loaded: boolean; sending: boolean }
const gkey = '__crypycryptMemeTgSent__' as const
const gstore = globalThis as typeof globalThis & { [gkey]?: SentStore }
function store(): SentStore {
  return (gstore[gkey] ??= { map: {}, loaded: false, sending: false })
}

const STORE_DIR = DATA_DIR
const STORE_PATH = path.join(STORE_DIR, 'meme-telegram-sent.json')
const MAX_KEYS = 5000

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
    console.warn('[memeTg] gagal baca dedup store:', (e as Error)?.message)
  }
}

function persistStore(): void {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true })
    fs.writeFileSync(STORE_PATH, JSON.stringify(store().map))
  } catch (e) {
    console.warn('[memeTg] gagal simpan dedup store:', (e as Error)?.message)
  }
}

function alreadySent(addr: string): boolean {
  return Object.prototype.hasOwnProperty.call(store().map, addr)
}

function markSent(addr: string): void {
  const s = store()
  s.map[addr] = Date.now()
  const keys = Object.keys(s.map)
  if (keys.length > MAX_KEYS) {
    // Eviksi entri terlama (Object.keys mempertahankan urutan sisip untuk
    // key non-indeks seperti address base58).
    keys.slice(0, keys.length - MAX_KEYS).forEach((k) => delete s.map[k])
  }
  persistStore()
}

// ─── Inline keyboard (URL buttons + Copy CA callback) ──────────────────────
function buildKeyboard(t: any): any[][] {
  const addr = String(t?.address || '')
  const dex = String(t?.dexUrl || '') || `https://dexscreener.com/solana/${addr}`
  const x = `https://x.com/search?q=%24${encodeURIComponent(String(t?.symbol || ''))}`
  return [
    [
      { text: '📈 GMGN', url: `https://gmgn.ai/sol/token/${addr}` },
      { text: '📊 DexScreener', url: dex },
    ],
    [
      { text: '𝕏 Open X', url: x },
      // callback_data maks 64 byte: "copyca:" (7) + mint solana (44) = 51 ✓
      { text: '📋 Copy CA', callback_data: `copyca:${addr}` },
    ],
  ]
}

function bucketMeta(b: string): { emoji: string; label: string } {
  switch (b) {
    case 'NEW_BONDING': return { emoji: '🌱', label: 'NEW BONDING' }
    case 'BONDING_RADAR': return { emoji: '📡', label: 'BONDING RADAR' }
    case 'MOMENTUM': return { emoji: '🚀', label: 'MOMENTUM' }
    default: return { emoji: '🔎', label: 'RADAR' }
  }
}

// ─── Caption HTML (dijaga < 1024 char agar muat di pesan bergambar) ────────
function buildCaption(t: any): string {
  const bm = bucketMeta(String(t?.bucket || ''))
  const ch1h = Number(t?.priceChange1h || 0)
  return [
    `${bm.emoji} <b>${bm.label}</b> · SOL`,
    `${esc(t?.name)} (<b>$${esc(t?.symbol)}</b>/SOL)`,
    `<code>${esc(t?.address)}</code>`,
    ``,
    `💸 MC ${compactUsd(t?.mcap)} · LP ${compactUsd(t?.liquidity)}`,
    `🔗 Bonding ${Number(t?.bondingProgress || 0).toFixed(0)}% · ${esc(t?.bondingStage || '-')}`,
    `🤖 AI ${Number(t?.aiScore || 0).toFixed(0)}/100 · ${esc(t?.aiSignal || '-')}`,
    `📈 1H ${ch1h >= 0 ? '+' : ''}${ch1h.toFixed(1)}% · Vol24 ${compactUsd(t?.volume24h)}`,
    `👥 Holders ${Number(t?.totalHolders || 0)} · Top10 ${Number(t?.top10HolderPct || 0).toFixed(1)}%`,
  ].join('\n')
}

// ─── Transport Telegram ────────────────────────────────────────────────────
function threadField(): Record<string, number> {
  const id = TG.topicId()
  return id > 0 ? { message_thread_id: id } : {}
}

async function sendText(text: string, keyboard: any[][] | null, attempt = 0): Promise<boolean> {
  try {
    const body: any = {
      chat_id: TG.chatId(),
      ...threadField(),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }
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
      console.warn('[memeTg] sendMessage HTTP', res.status)
      return false
    }
    return true
  } catch (e) {
    console.warn('[memeTg] sendMessage gagal:', String((e as Error)?.message || e).slice(0, 120))
    return false
  }
}

async function sendPhoto(photo: string, caption: string | null, keyboard: any[][] | null, attempt = 0): Promise<boolean> {
  try {
    const body: any = { chat_id: TG.chatId(), ...threadField(), photo }
    if (caption) {
      body.caption = caption
      body.parse_mode = 'HTML'
    }
    if (keyboard) body.reply_markup = { inline_keyboard: keyboard }
    const res = await fetch(`https://api.telegram.org/bot${TG.botToken()}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TG.sendTimeoutMs),
    })
    if (res.status === 429 && attempt < 2) {
      const b = await res.json().catch(() => null)
      await sleep(Math.min(30, Number(b?.parameters?.retry_after) || 5) * 1000)
      return sendPhoto(photo, caption, keyboard, attempt + 1)
    }
    if (!res.ok) {
      console.warn('[memeTg] sendPhoto HTTP', res.status)
      return false
    }
    return true
  } catch (e) {
    console.warn('[memeTg] sendPhoto gagal:', String((e as Error)?.message || e).slice(0, 120))
    return false
  }
}

/**
 * Kirim satu alert token. Foto + caption + tombol bila ada logo & caption muat;
 * kalau tidak, fallback ke teks. Bila foto gagal (URL rusak), fallback teks
 * agar sinyal tetap tersampaikan (dan bisa ditandai sudah dikirim).
 */
export async function sendMemeAlert(t: any): Promise<boolean> {
  if (!TG.botToken()) return false
  const caption = buildCaption(t)
  const keyboard = buildKeyboard(t)
  const img = String(t?.logoUrl || '').trim()

  if (!img) return sendText(caption, keyboard)

  if (caption.length <= TG.captionLimit) {
    const ok = await sendPhoto(img, caption, keyboard)
    if (ok) return true
    return sendText(caption, keyboard) // foto gagal → tetap kirim teks
  }

  // Caption kepanjangan untuk foto: kirim foto polos, lalu teks lengkap + tombol.
  await sendPhoto(img, null, null)
  return sendText(caption, keyboard)
}

/**
 * Saring + kirim sinyal kuat dari semesta token radar. Dipanggil fire-and-forget
 * dari /api/meme-tokens setelah `enriched` dibangun. Tidak pernah melempar.
 * Guard `sending` mencegah dispatch paralel (mis. beberapa cacheKey rebuild
 * bersamaan) sehingga tidak ada double-send / race pada dedup store.
 */
export function dispatchMemeRadarAlerts(tokens: any[]): void {
  try {
    if (!CFG.enabled()) return
    if (!TG.botToken()) return

    const s = store()
    if (s.sending) return // sudah ada dispatch berjalan
    loadStore()

    const minAi = CFG.minAiScore()
    const minLiq = CFG.minLiquidity()

    const qualified = (Array.isArray(tokens) ? tokens : []).filter((t) => {
      const addr = String(t?.address || '')
      if (!addr) return false
      if (alreadySent(addr)) return false        // dedup permanen
      if (t?.bucket === 'NONE') return false
      if (t?.holderGate === 'FAIL') return false
      if (t?.rugged) return false
      if (Number(t?.aiScore || 0) < minAi) return false
      if (Number(t?.liquidity || 0) < minLiq) return false
      return true
    })
    if (qualified.length === 0) return

    // Prioritaskan skor AI tertinggi, batasi per siklus agar tidak spam.
    qualified.sort((a, b) => Number(b?.aiScore || 0) - Number(a?.aiScore || 0))
    const batch = qualified.slice(0, CFG.maxPerCycle())

    s.sending = true
    void (async () => {
      try {
        for (const t of batch) {
          const ok = await sendMemeAlert(t)
          if (ok) markSent(String(t.address))
          await sleep(TG.minIntervalMs)
        }
      } catch (e) {
        console.warn('[memeTg] dispatch error:', String((e as Error)?.message || e).slice(0, 120))
      } finally {
        s.sending = false
      }
    })()
  } catch (e) {
    console.warn('[memeTg] dispatch guard error:', String((e as Error)?.message || e).slice(0, 120))
  }
}

/**
 * Handler webhook Telegram — menjawab tombol "Copy CA" (callback_data
 * `copyca:<address>`) dengan menampilkan address sebagai alert. Dipakai oleh
 * app/api/telegram/webhook/route.ts. No-op bila bukan callback Copy CA.
 */
export async function handleTelegramCallback(update: any): Promise<void> {
  try {
    const cq = update?.callback_query
    if (!cq || typeof cq.data !== 'string' || !cq.data.startsWith('copyca:')) return
    const address = cq.data.slice('copyca:'.length)
    const token = TG.botToken()
    if (!token) return
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cq.id, text: address, show_alert: true }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) {
    console.warn('[memeTg] callback error:', String((e as Error)?.message || e).slice(0, 120))
  }
}
