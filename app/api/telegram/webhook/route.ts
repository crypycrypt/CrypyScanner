import { NextRequest, NextResponse } from 'next/server'
import { handleTelegramCallback } from '../../../../lib/meme/memeTelegramAlert'

// ─── Webhook Telegram (opsional) ───────────────────────────────────────────
// Menerima update dari Telegram dan menjawab tombol callback pada alert:
//   • "Copy CA" alert radar Meme (callback_data `copyca:<address>`)
// Agar tombol ini aktif, bot harus punya webhook publik yang mengarah ke
// endpoint ini:
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<DOMAIN>/api/telegram/webhook"
// Tanpa webhook pun alert tetap terkirim & CA tetap bisa disalin dari caption
// (ditulis sebagai <code> = tap-to-copy native Telegram).
//
// Selalu balas 200 {ok:true} supaya Telegram tidak retry beruntun.
export async function POST(request: NextRequest) {
  try {
    const update = await request.json().catch(() => null)
    if (update) await handleTelegramCallback(update)
  } catch {
    // abaikan — jangan bocorkan error ke Telegram
  }
  return NextResponse.json({ ok: true })
}

// GET ringan untuk health-check / verifikasi endpoint.
export async function GET() {
  return NextResponse.json({ ok: true, service: 'telegram-webhook' })
}
