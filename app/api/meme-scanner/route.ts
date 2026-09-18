import { NextRequest, NextResponse } from 'next/server'
import { evaluateMemeAlert, type MemeAlert } from '../../../lib/memeScanner'
import {
  forgetOutcome, getTrackerSnapshot, refreshOutcomes, startMemeOutcomeHeartbeat, trackAlert,
} from '../../../lib/memeOutcomeTracker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Minimal shape guard for incoming MemeAlert payloads ──────────────────
function parseAlert(body: any): { ok: true; alert: MemeAlert } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body harus JSON object MemeAlert' }
  const num = (v: any, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
  if (!body.contractAddress || typeof body.contractAddress !== 'string') {
    return { ok: false, error: 'contractAddress wajib diisi (string)' }
  }
  const alert: MemeAlert = {
    timestamp: typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString(),
    category: String(body.category ?? 'MANUAL TEST'),
    name: String(body.name ?? body.symbol ?? 'UNKNOWN'),
    symbol: String(body.symbol ?? '???'),
    contractAddress: String(body.contractAddress),
    chain: String(body.chain ?? 'SOL'),
    platform: String(body.platform ?? 'Unknown'),
    ageMinutes: num(body.ageMinutes),
    bondingPct: typeof body.bondingPct === 'number' ? body.bondingPct : undefined,
    graduated: Boolean(body.graduated),
    mcUsd: num(body.mcUsd),
    lpUsd: num(body.lpUsd),
    vol1mUsd: num(body.vol1mUsd),
    change1mPct: num(body.change1mPct),
    change5mPct: num(body.change5mPct),
    buys: num(body.buys),
    sells: num(body.sells),
    buySellRatio: num(body.buySellRatio),
    holderCount: num(body.holderCount),
    top10Pct: num(body.top10Pct),
    topHolders: Array.isArray(body.topHolders) ? body.topHolders.map((v: any) => num(v)) : [],
    smartCount: num(body.smartCount),
    kolCount: num(body.kolCount),
    insiderCount: num(body.insiderCount),
    botPct: num(body.botPct),
    sniperCount: num(body.sniperCount),
    bundlePct: num(body.bundlePct),
    organicPct: num(body.organicPct),
    buyerCount: num(body.buyerCount),
    creatorLaunches: num(body.creatorLaunches),
    devHoldPct: num(body.devHoldPct),
    xUrl: typeof body.xUrl === 'string' ? body.xUrl : undefined,
  }
  return { ok: true, alert }
}

// GET → tracker snapshot (dashboard). Also arms the hourly heartbeat as a
// fallback, same pattern as the paper-trader route.
export async function GET() {
  startMemeOutcomeHeartbeat()
  return NextResponse.json(getTrackerSnapshot())
}

// POST ?action=evaluate       → run veto+score on one MemeAlert (body), track it
// POST ?action=evaluate-batch → same for an array of alerts (radar feed);
//                               server-side tracking is idempotent per address
// POST ?action=refresh        → force refreshOutcomes() now (cron-style)
// POST ?action=forget         → drop one tracked record (?address=0x...)
export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action')

  if (action === 'evaluate') {
    let body: any
    try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'Body bukan JSON valid' }, { status: 400 }) }
    const parsed = parseAlert(body)
    if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
    const verdict = evaluateMemeAlert(parsed.alert)
    const tracked = trackAlert(parsed.alert, verdict.decision, verdict.score, verdict.reason)
    return NextResponse.json({ ok: true, ...verdict, alert: parsed.alert, tracked })
  }

  if (action === 'evaluate-batch') {
    let body: any
    try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'Body bukan JSON valid' }, { status: 400 }) }
    const items: any[] = Array.isArray(body?.alerts) ? body.alerts : []
    if (!items.length) return NextResponse.json({ ok: false, error: 'Body harus { alerts: MemeAlert[] }' }, { status: 400 })
    const results = items.slice(0, 100).map(raw => {
      const parsed = parseAlert(raw)
      if (!parsed.ok) return { ok: false, error: parsed.error }
      const verdict = evaluateMemeAlert(parsed.alert)
      trackAlert(parsed.alert, verdict.decision, verdict.score, verdict.reason)
      return { ok: true, contractAddress: parsed.alert.contractAddress, symbol: parsed.alert.symbol, ...verdict }
    })
    return NextResponse.json({ ok: true, count: results.length, results })
  }

  if (action === 'refresh') {
    return NextResponse.json({ ok: true, report: await refreshOutcomes() })
  }

  if (action === 'forget') {
    const address = request.nextUrl.searchParams.get('address')
    if (!address) return NextResponse.json({ ok: false, error: 'Parameter ?address= wajib' }, { status: 400 })
    return NextResponse.json({ ok: forgetOutcome(address) })
  }

  return NextResponse.json({ ok: false, error: 'Unknown action (evaluate | refresh | forget)' }, { status: 400 })
}
