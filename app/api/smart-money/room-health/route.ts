import { NextRequest, NextResponse } from 'next/server'

// Simulated room health metrics
// In production, these would be computed from:
// - Follow Rate: how many desk wallets copied a whale entry (on-chain copy ratio)
// - Edge Decay: how fast the copy alpha degrades over time (time-decay model)
// - Fill Quality: slippage vs whale entry price (DEX swap analysis)

function generateRoomHealth() {
  // Generate values with some correlation to simulate realistic trading room dynamics
  const baseTime = Date.now()
  const cycle = Math.sin(baseTime / 60000) * 0.3 + 0.7 // oscillates between 0.4 and 1.0

  const followRate = Math.round(60 + Math.random() * 30 * cycle)
  const edgeDecay = Math.round(40 + Math.random() * 40 * cycle)
  const fillQuality = Math.round(55 + Math.random() * 35 * cycle)

  return {
    followRate: Math.min(100, Math.max(0, followRate)),
    edgeDecay: Math.min(100, Math.max(0, edgeDecay)),
    fillQuality: Math.min(100, Math.max(0, fillQuality)),
    // Additional context
    totalWhales: Math.floor(Math.random() * 50) + 20,
    copiedEntries: Math.floor(Math.random() * 30) + 10,
    avgSlippage: (Math.random() * 2.5).toFixed(2),
    lastUpdated: new Date().toISOString(),
  }
}

let cache: any = null
let cacheTs = 0
const TTL = 10_000 // 10 seconds

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'

  if (!forceRefresh && cache && Date.now() - cacheTs < TTL) {
    return NextResponse.json({ ok: true, cached: true, ...cache })
  }

  try {
    // Simulate slight delay
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100))

    const metrics = generateRoomHealth()

    const result = {
      metrics,
      fetchedAt: new Date().toISOString(),
    }

    cache = result
    cacheTs = Date.now()

    return NextResponse.json({ ok: true, cached: false, ...result })
  } catch (error: any) {
    console.error('/api/smart-money/room-health error:', error?.message ?? error)
    if (cache) return NextResponse.json({ ok: true, cached: true, stale: true, ...cache })
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch room health' },
      { status: 500 }
    )
  }
}
