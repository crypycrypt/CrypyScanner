import { NextRequest, NextResponse } from 'next/server'

// Simulated tracked wallets with dynamic data
// In production, this would query on-chain data from Solana RPC + wallet tracking services

const WALLET_POOL = [
  '27eb8a3f9c1d4e6b5a8f0c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f6e6',
  '2602a1b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e46b',
  '890e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e323',
  '840c2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e047',
  'b5b93c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e80f',
  '98f84d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0ce',
  '3a7f5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
  'c1b96f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e',
  'd2c07a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f',
  'e3d18b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a',
]

const STATUSES: string[] = ['COPYING', 'WATCH', 'STOP', 'PAUSED']
const STATUS_WEIGHTS = [0.3, 0.4, 0.15, 0.15] // COPYING, WATCH, STOP, PAUSED

function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

function generateSparkline(length: number = 12): number[] {
  const base = 50 + Math.random() * 20
  const data: number[] = []
  let current = base
  for (let i = 0; i < length; i++) {
    current += (Math.random() - 0.5) * 15
    current = Math.max(10, Math.min(100, current))
    data.push(Math.round(current))
  }
  return data
}

function generateWallets(count: number = 10) {
  return WALLET_POOL.slice(0, count).map((addr, i) => {
    const status = weightedRandom(STATUSES, STATUS_WEIGHTS)
    const isProfit = Math.random() > 0.3
    const solValue = isProfit
      ? +(Math.random() * 80 + 5).toFixed(1)
      : -(Math.random() * 15 + 0.5).toFixed(1)

    return {
      id: `wallet-${i + 1}`,
      rank: i + 1,
      address: addr,
      shortAddr: addr.slice(0, 4) + '...' + addr.slice(-4),
      sparkline: generateSparkline(),
      status,
      profitLoss: solValue,
      solValue: Math.abs(solValue),
      isProfit,
      lastActive: Math.floor(Math.random() * 300) + 's ago',
    }
  })
}

let cache: any = null
let cacheTs = 0
const TTL = 15_000 // 15 seconds

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'

  if (!forceRefresh && cache && Date.now() - cacheTs < TTL) {
    return NextResponse.json({ ok: true, cached: true, ...cache })
  }

  try {
    // Simulate slight delay for realism
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200))

    const wallets = generateWallets(10)

    // Sort by absolute SOL value (performance ranking)
    wallets.sort((a, b) => b.solValue - a.solValue)
    wallets.forEach((w, i) => {
      w.rank = i + 1
    })

    const result = {
      wallets,
      total: wallets.length,
      copyingCount: wallets.filter(w => w.status === 'COPYING').length,
      watchCount: wallets.filter(w => w.status === 'WATCH').length,
      fetchedAt: new Date().toISOString(),
    }

    cache = result
    cacheTs = Date.now()

    return NextResponse.json({ ok: true, cached: false, ...result })
  } catch (error: any) {
    console.error('/api/smart-money/tracked-wallets error:', error?.message ?? error)
    if (cache) return NextResponse.json({ ok: true, cached: true, stale: true, ...cache })
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch tracked wallets' },
      { status: 500 }
    )
  }
}
