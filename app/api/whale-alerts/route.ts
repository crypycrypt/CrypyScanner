import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RawAlert = Record<string, any>

export async function GET() {
  try {
    const response = await fetch('http://127.0.0.1:3001/api/whale/alerts', { cache: 'no-store', signal: AbortSignal.timeout(8_000) })
    if (!response.ok) throw new Error(`Whale service returned ${response.status}`)
    const payload = await response.json()
    const source: RawAlert[] = Array.isArray(payload) ? payload : Array.isArray(payload.alerts) ? payload.alerts : Array.isArray(payload.data) ? payload.data : []
    const alerts = source.map(alert => ({
      id: String(alert.id || `${alert.symbol || alert.token || 'unknown'}-${alert.ts || alert.timestamp || ''}`),
      symbol: String(alert.symbol || alert.token || alert.baseToken?.symbol || '').toUpperCase(),
      direction: String(alert.direction || alert.side || 'NEUTRAL'),
      subtype: String(alert.subtype || alert.type || 'WHALE_ALERT'),
      score: Number(alert.score || alert.strength || 0),
      usdValue: Number(alert.usdValue || alert.amountUsd || 0),
      label: String(alert.label || alert.reason || alert.subtype || 'Whale activity detected'),
      timestamp: alert.ts || alert.timestamp || new Date().toISOString(),
      demo: Boolean(alert.demo),
      source: String(alert.source || 'crypto-scanner'),
    })).filter(alert => alert.symbol)
    return NextResponse.json({ ok: true, alerts, liveAlerts: alerts.filter(alert => !alert.demo), fetchedAt: new Date().toISOString() })
  } catch (error: any) {
    return NextResponse.json({ ok: false, alerts: [], liveAlerts: [], error: error?.message || 'Whale feed unavailable', fetchedAt: new Date().toISOString() })
  }
}
