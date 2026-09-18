import { NextRequest, NextResponse } from 'next/server'
import { notifyTelegram } from '../../../lib/telegramNotify'
import type { WhaleAlert } from '../../../lib/whaleAlertEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const fmtPct = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
const fmtVol = (v: number) => (v * 100).toFixed(1) + '%'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const alerts: WhaleAlert[] = Array.isArray(body?.alerts) ? body.alerts : []
    if (!alerts.length) {
      return NextResponse.json({ ok: false, error: 'Tidak ada sinyal untuk dikirim' }, { status: 400 })
    }

    const timeStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    const buys = alerts.filter((a) => a.action === 'BUY')
    const sells = alerts.filter((a) => a.action === 'SELL')

    const lines = alerts
      .map((a, i) => {
        const emoji = a.action === 'BUY' ? '🟢' : a.action === 'SELL' ? '🔴' : '🟡'
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
        const dir = a.action === 'BUY' ? 'AKUMULASI' : a.action === 'SELL' ? 'DISTRIBUSI' : 'WATCH'
        const score = a.action === 'BUY' ? a.buyScore : a.action === 'SELL' ? a.sellScore : Math.max(a.buyScore, a.sellScore)
        const top2 = (a.reasons || []).slice(0, 2).map((r) => `  • ${r}`).join('\n')
        return (
          `${medal} ${emoji} <b>${a.name}</b> (${a.symbol})  Score: <b>${score}/60</b>\n` +
          `   ${dir} · 1H: ${fmtPct(a.ch1h)} · 24H: ${fmtPct(a.ch24h)} · Vol/MC: ${fmtVol(a.volRatio)}\n` +
          (top2 || '')
        )
      })
      .join('\n\n')

    const msg =
      `🐋 <b>WHALE ACCUMULATION RADAR</b>\n` +
      `🕐 ${timeStr} WIB\n` +
      `📊 ${alerts.length} sinyal · ${buys.length} BUY · ${sells.length} SELL\n\n` +
      `${lines}\n\n` +
      `⚠️ <i>Bukan financial advice. DYOR sebelum trading.</i>`

    notifyTelegram('trade', msg, `whale-radar-${Date.now()}`)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Gagal mengirim' }, { status: 500 })
  }
}
