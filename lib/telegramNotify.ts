// ══════════════════════════════════════════════════════════════════════════
//  TELEGRAM NOTIFY — notifikasi paper trading (bukan approval eksekusi live).
//
//  Modul TRANSPORT saja: paperTrader yang menyusun isi pesan, modul ini yang
//  mengirim ke Telegram. Sengaja terpisah dan tidak menyentuh alur approval
//  eksekusi yang sudah ada.
//
//  Config (dari user):
//    botToken      : diisi sendiri lewat env TELEGRAM_BOT_TOKEN di .env
//    chatId        : -1004431059985 (grup super, topic-enabled)
//    topicId       : 2   → topik TRADE  — sinyal dieksekusi (ENTRY) & close (EXIT)
//    walletTopicId : 294 → topik WALLET — event margin (likuidasi, circuit breaker)
//
//  Sifat:
//    • Fire-and-forget — TIDAK PERNAH melempar error ke pemanggil; kegagalan
//      kirim hanya di-console.warn supaya loop paper trader tidak pernah mati.
//    • No-op bila TELEGRAM_BOT_TOKEN belum diisi (warning console 1×/jam).
//    • Rate-limit internal: antrean FIFO dengan jeda 3s antar pesan
//      (≈20 pesan/menit = batas aman bot Telegram per grup) + retry 429
//      (menghormati retry_after, maks 2 percobaan).
//    • Dedup key (mis. `entry-BTC-<ts>`) tahan hot-reload via globalThis,
//      jadi HMR/dev tidak mengirim notifikasi ganda.
// ══════════════════════════════════════════════════════════════════════════

const TG_CONFIG = {
  chatId: '-1004431059985',
  topicId: 2,          // TRADE — entry/exit posisi paper
  walletTopicId: 294,  // WALLET — likuidasi & circuit breaker
  minIntervalMs: 3_000,
  maxQueue: 20,
  maxDedupKeys: 200,
  sendTimeoutMs: 10_000,
}

type QueueItem = { threadId: number; text: string }
type NotifyState = { queue: QueueItem[]; sending: boolean; sentKeys: string[]; lastNoTokenWarn: number }

const gkey = '__crypycryptTelegramNotify__' as const
const gstore = globalThis as typeof globalThis & { [gkey]?: NotifyState }
function st(): NotifyState {
  return gstore[gkey] ??= { queue: [], sending: false, sentKeys: [], lastNoTokenWarn: 0 }
}

const botToken = () => (process.env.TELEGRAM_BOT_TOKEN || '').trim()
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Kirim notifikasi ke grup Telegram user (topik TRADE atau WALLET).
 * Aman dipanggil dari mana saja: tidak pernah throw, no-op tanpa token.
 */
export function notifyTelegram(topic: 'trade' | 'wallet', text: string, dedupKey?: string): void {
  try {
    const s = st()
    if (dedupKey) {
      if (s.sentKeys.includes(dedupKey)) return
      s.sentKeys.push(dedupKey)
      if (s.sentKeys.length > TG_CONFIG.maxDedupKeys) s.sentKeys.splice(0, s.sentKeys.length - TG_CONFIG.maxDedupKeys)
    }
    if (!botToken()) {
      if (Date.now() - s.lastNoTokenWarn > 3_600_000) {
        s.lastNoTokenWarn = Date.now()
        console.warn('[telegramNotify] TELEGRAM_BOT_TOKEN belum diisi di .env — notifikasi paper trading dilewati')
      }
      return
    }
    if (s.queue.length >= TG_CONFIG.maxQueue) {
      console.warn('[telegramNotify] antrean penuh (≥20) — pesan dilewati agar tidak spam')
      return
    }
    s.queue.push({ threadId: topic === 'wallet' ? TG_CONFIG.walletTopicId : TG_CONFIG.topicId, text })
    void drain()
  } catch {
    // tidak boleh mengganggu loop paper trader
  }
}

async function drain(): Promise<void> {
  const s = st()
  if (s.sending) return
  s.sending = true
  try {
    while (s.queue.length) {
      const item = s.queue.shift()!
      await sendOnce(item.threadId, item.text)
      if (s.queue.length) await sleep(TG_CONFIG.minIntervalMs)
    }
  } finally {
    s.sending = false
  }
}

async function sendOnce(threadId: number, text: string, attempt = 0): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CONFIG.chatId,
        message_thread_id: threadId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TG_CONFIG.sendTimeoutMs),
    })
    if (res.status === 429 && attempt < 2) {
      const body = await res.json().catch(() => null)
      const retryAfter = Math.min(30, Number(body?.parameters?.retry_after) || 5)
      await sleep(retryAfter * 1000)
      return sendOnce(threadId, text, attempt + 1)
    }
    if (!res.ok) console.warn(`[telegramNotify] HTTP ${res.status} saat kirim notifikasi (thread ${threadId})`)
  } catch (err) {
    console.warn('[telegramNotify] gagal kirim:', String((err as Error)?.message || err).slice(0, 120))
  }
}
