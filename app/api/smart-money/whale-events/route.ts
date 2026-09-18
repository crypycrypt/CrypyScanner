import { NextRequest, NextResponse } from 'next/server'

// Simulated whale event data
// In production, this would query on-chain Solana data for large wallet movements
// using Helius/Gelius RPC, Jupiter API for swap data, and whale wallet tracking

type NodeStatus = 'Watching' | 'Copying' | 'Profit' | 'Loss' | 'Entry' | 'Exit' | 'Warning'
type EventType = 'WHALE MOVE' | 'ENTRY' | 'EXIT' | 'WARNING'

const TOKENS = ['FROG69', 'BONK', 'WIF', 'JUP', 'RENDER', 'JTO', 'PYTH', 'BONK', 'W', 'SAMO']
const ACTIONS = [
  'just opened',
  'just closed',
  'added liquidity to',
  'swapped into',
  'accumulated',
  'distributed',
  'opened position in',
  'exited position in',
]
const STATUSES: NodeStatus[] = ['Watching', 'Copying', 'Profit', 'Loss', 'Entry', 'Exit', 'Warning']
const EVENT_TYPES: EventType[] = ['WHALE MOVE', 'ENTRY', 'EXIT', 'WARNING']

function generateNodes(count: number = 12) {
  return Array.from({ length: count }).map((_, i) => ({
    id: `node-${i}`,
    shortAddr:
      Math.random().toString(36).substring(2, 6) +
      '...' +
      Math.random().toString(36).substring(2, 6),
    status: STATUSES[Math.floor(Math.random() * STATUSES.length)] as NodeStatus,
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 70,
    solAmount: +(Math.random() * 5).toFixed(1),
    token: TOKENS[Math.floor(Math.random() * TOKENS.length)],
    lastEvent: '',
  }))
}

function generateEvent(): any {
  const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]
  const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)]
  const token = TOKENS[Math.floor(Math.random() * TOKENS.length)]
  const amount = (Math.random() * 5).toFixed(1)

  return {
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    wallet:
      Math.random().toString(36).substring(2, 6) +
      '...' +
      Math.random().toString(36).substring(2, 6),
    action,
    amount,
    token,
    timestamp: Date.now(),
  }
}

let cache: any = null
let cacheTs = 0
const TTL = 8_000 // 8 seconds

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'

  if (!forceRefresh && cache && Date.now() - cacheTs < TTL) {
    return NextResponse.json({ ok: true, cached: true, ...cache })
  }

  try {
    // Simulate slight delay
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100))

    const nodes = generateNodes(12)
    const events = Array.from({ length: 3 }).map(() => generateEvent())

    const result = {
      nodes,
      events,
      fetchedAt: new Date().toISOString(),
    }

    cache = result
    cacheTs = Date.now()

    return NextResponse.json({ ok: true, cached: false, ...result })
  } catch (error: any) {
    console.error('/api/smart-money/whale-events error:', error?.message ?? error)
    if (cache) return NextResponse.json({ ok: true, cached: true, stale: true, ...cache })
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch whale events' },
      { status: 500 }
    )
  }
}
