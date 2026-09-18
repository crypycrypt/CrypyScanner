import { NextRequest, NextResponse } from 'next/server'

// Simulated desk feed events
// In production, this would stream real-time on-chain events from:
// - Jupiter/Lifinity swap events
// - Raydium liquidity events
// - Whale wallet transaction monitoring
// - Copy trading execution logs

type EventType = 'WATCHER' | 'LADDER' | 'SNIPER' | 'STOP' | 'COPY' | 'EXIT' | 'ALERT'

interface DeskFeedEvent {
  id: string
  timestamp: string
  type: EventType
  wallet: string
  action: string
  amount: string
  token: string
  profit?: string
  details?: string
}

const EVENT_TYPES: EventType[] = ['WATCHER', 'LADDER', 'SNIPER', 'STOP', 'COPY', 'EXIT', 'ALERT']
const TOKENS = ['TURBOX', 'WIFINU', 'FROGX', 'FROG69', 'BONK', 'WIF', 'JUP', 'PEPECTO', 'GIGAINU', 'NYANLET']
const ACTIONS = [
  'opened',
  'closed',
  'added liquidity to',
  'swapped into',
  'accumulated',
  'distributed',
  'opened position in',
  'exited position in',
]

function generateEvent(): DeskFeedEvent {
  const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]
  const token = TOKENS[Math.floor(Math.random() * TOKENS.length)]
  const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)]
  const amount = (Math.random() * 5).toFixed(1)
  const isProfit = Math.random() > 0.4
  const profit = isProfit
    ? `+${(Math.random() * 3).toFixed(2)} SOL`
    : `-${(Math.random() * 0.5).toFixed(2)} SOL`

  const now = new Date()
  const timeStr = now.toTimeString().slice(0, 8)

  let wallet = ''
  let eventAction = ''
  let eventAmount = ''
  let eventToken = ''
  let eventProfit = ''
  let eventDetails = ''

  switch (type) {
    case 'WATCHER':
      wallet = Math.random().toString(36).substring(2, 6) + '...' + Math.random().toString(36).substring(2, 6)
      eventAction = action
      eventAmount = amount
      eventToken = token
      break
    case 'LADDER':
      eventToken = '$' + token
      eventAction = 'closed'
      eventProfit = profit
      break
    case 'SNIPER':
      eventToken = '$' + token
      eventAction = 'entry 40s after launch · out at graduation'
      eventDetails = 'sniper'
      break
    case 'STOP':
      eventToken = '$' + token
      eventAction = 'closed'
      eventProfit = profit
      break
    case 'COPY':
      wallet = Math.random().toString(36).substring(2, 6) + '...' + Math.random().toString(36).substring(2, 6)
      eventAction = action
      eventAmount = amount
      eventToken = token
      eventProfit = profit
      break
    case 'EXIT':
      wallet = Math.random().toString(36).substring(2, 6) + '...' + Math.random().toString(36).substring(2, 6)
      eventAction = 'exited position in'
      eventAmount = amount
      eventToken = token
      eventProfit = profit
      break
    case 'ALERT':
      eventToken = '$' + token
      eventAction = 'price alert triggered'
      eventDetails = 'alert'
      break
  }

  return {
    id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: timeStr,
    type,
    wallet,
    action: eventAction,
    amount: eventAmount,
    token: eventToken,
    profit: eventProfit,
    details: eventDetails,
  }
}

let cache: any = null
let cacheTs = 0
const TTL = 5_000 // 5 seconds

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'

  if (!forceRefresh && cache && Date.now() - cacheTs < TTL) {
    return NextResponse.json({ ok: true, cached: true, ...cache })
  }

  try {
    await new Promise(r => setTimeout(r, 30 + Math.random() * 70))

    // Generate 3-5 new events
    const count = 3 + Math.floor(Math.random() * 3)
    const events = Array.from({ length: count }).map(() => generateEvent())

    const result = {
      events,
      fetchedAt: new Date().toISOString(),
    }

    cache = result
    cacheTs = Date.now()

    return NextResponse.json({ ok: true, cached: false, ...result })
  } catch (error: any) {
    console.error('/api/smart-money/desk-feed error:', error?.message ?? error)
    if (cache) return NextResponse.json({ ok: true, cached: true, stale: true, ...cache })
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch desk feed' },
      { status: 500 }
    )
  }
}
