import { NextRequest, NextResponse } from 'next/server'

// ─── Meme Money Flow Engine ──────────────────────────────────────
// Tracks real-time money flow into/out of Solana meme coins
// using DexScreener and CoinGecko data.

const DEXSCREENER_SEARCH = 'https://api.dexscreener.com/latest/dex/search'
const COINGECKO_API = 'https://api.coingecko.com/api/v3'

const cache = new Map<string, { data: any; ts: number }>()
const CACHE_DURATION = 20_000 // 20 seconds

async function fetchJson(url: string, timeoutMs: number): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ─── Flow event types ────────────────────────────────────────────
type FlowType = 'SMART_MONEY' | 'WHALE' | 'RETAIL' | 'EXIT'

interface FlowBucket {
  type: FlowType
  label: string
  amount: number
  direction: 'in' | 'out'
  velocity: number
  color: string
}

// ─── Generate flow events from real token data ──────────────────
function computeFlowFromTokens(tokens: any[]): FlowBucket[] {
  const buckets: FlowBucket[] = [
    { type: 'SMART_MONEY', label: 'SMART MONEY', amount: 0, direction: 'in', velocity: 0, color: '#22e58a' },
    { type: 'WHALE', label: 'WHALES', amount: 0, direction: 'in', velocity: 0, color: '#55aaff' },
    { type: 'RETAIL', label: 'RETAIL', amount: 0, direction: 'in', velocity: 0, color: '#baff38' },
    { type: 'EXIT', label: 'EXITS', amount: 0, direction: 'out', velocity: 0, color: '#ff5d69' },
  ]

  for (const token of tokens) {
    const vol24h = parseFloat(token.volume?.h24 || 0)
    const buys1h = token.txns?.h1?.buys || 0
    const sells1h = token.txns?.h1?.sells || 0
    const totalTx = buys1h + sells1h
    const buyRatio = totalTx > 0 ? buys1h / totalTx : 0.5

    // Smart money: high volume + high buy ratio
    if (vol24h > 100_000 && buyRatio > 0.65) {
      buckets[0].amount += vol24h * 0.3
      buckets[0].velocity += buyRatio * 100
    }

    // Whales: very high volume
    if (vol24h > 500_000) {
      buckets[1].amount += vol24h * 0.2
      buckets[1].velocity += 50
    }

    // Retail: moderate volume
    if (vol24h > 10_000 && vol24h <= 500_000) {
      buckets[2].amount += vol24h * 0.15
      buckets[2].velocity += 30
    }

    // Exits: high sell ratio
    if (sells1h > buys1h * 1.5) {
      buckets[3].amount += vol24h * 0.1
      buckets[3].velocity += (sells1h / Math.max(buys1h, 1)) * 50
    }
  }

  // Normalize
  const count = Math.max(1, tokens.length)
  for (const b of buckets) {
    b.amount = Math.round(b.amount / count)
    b.velocity = Math.round(b.velocity / count)
  }

  return buckets
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'

  if (!forceRefresh && cache.has('money-flow')) {
    const cached = cache.get('money-flow')!
    if (Date.now() - cached.ts < CACHE_DURATION) {
      return NextResponse.json({ ok: true, cached: true, ...cached.data })
    }
  }

  try {
    // Fetch trending Solana meme tokens from DexScreener
    const dexData = await fetchJson(`${DEXSCREENER_SEARCH}?q=solana`, 10_000)
    const pairs = (dexData?.pairs || []).filter((p: any) => p.chainId === 'solana')

    // Filter for meme-like tokens
    const memePairs = pairs.filter((p: any) => {
      const name = (p.baseToken?.name || '').toLowerCase()
      const symbol = (p.baseToken?.symbol || '').toLowerCase()
      // Generic narrative terms only: no token symbols or curated coin list.
      const memeKeywords = ['dog', 'cat', 'frog', 'inu', 'meme', 'ai', 'bot', 'token', 'coin', 'ape', 'degen', 'wojak']
      return memeKeywords.some(kw => name.includes(kw) || symbol.includes(kw))
    })

    // Compute flow buckets
    const flowBuckets = computeFlowFromTokens(memePairs)

    // Compute aggregate flow velocity and momentum
    const totalInflow = flowBuckets.filter(b => b.direction === 'in').reduce((s, b) => s + b.amount, 0)
    const totalOutflow = flowBuckets.filter(b => b.direction === 'out').reduce((s, b) => s + b.amount, 0)
    const netFlow = totalInflow - totalOutflow

    const avgVelocity = flowBuckets.reduce((s, b) => s + b.velocity, 0) / flowBuckets.length
    const flowVelocity = Math.round((netFlow / Math.max(totalInflow, 1)) * 100)
    const flowMomentum = Math.round(avgVelocity)

    // Generate flow events (from real token data)
    const events = memePairs
      .slice(0, 20)
      .map((p: any) => {
        const vol24h = parseFloat(p.volume?.h24 || 0)
        const buys1h = p.txns?.h1?.buys || 0
        const sells1h = p.txns?.h1?.sells || 0
        const buyRatio = (buys1h + sells1h) > 0 ? buys1h / (buys1h + sells1h) : 0.5
        const priceChange1h = parseFloat(p.priceChange?.h1 || 0)

        let type: FlowType = 'RETAIL'
        let direction: 'in' | 'out' = 'in'
        let amount = vol24h * 0.1

        if (vol24h > 500_000 && buyRatio > 0.65) {
          type = 'SMART_MONEY'
          direction = 'in'
          amount = vol24h * 0.3
        } else if (vol24h > 500_000) {
          type = 'WHALE'
          direction = 'in'
          amount = vol24h * 0.2
        } else if (sells1h > buys1h * 1.5) {
          type = 'EXIT'
          direction = 'out'
          amount = vol24h * 0.15
        }

        return {
          id: `flow-${p.pairAddress || Math.random().toString(36).slice(2, 8)}`,
          type,
          token: p.baseToken?.symbol || '???',
          tokenAddress: p.baseToken?.address || '',
          direction,
          amount: Math.round(amount),
          priceChange1h,
          buyRatio: Math.round(buyRatio * 100),
          timestamp: new Date().toISOString(),
        }
      })
      .sort((a: any, b: any) => b.amount - a.amount)
      .slice(0, 15)

    const result = {
      buckets: flowBuckets,
      netFlow,
      totalInflow,
      totalOutflow,
      flowVelocity,
      flowMomentum,
      events,
      tokenCount: memePairs.length,
      fetchedAt: new Date().toISOString(),
    }

    cache.set('money-flow', { data: result, ts: Date.now() })

    return NextResponse.json({ ok: true, cached: false, ...result })
  } catch (error: any) {
    console.error('/api/meme-money-flow error:', error?.message ?? error)
    if (cache.has('money-flow')) {
      const cached = cache.get('money-flow')!
      return NextResponse.json({ ok: true, cached: true, stale: true, ...cached.data })
    }
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch money flow data' },
      { status: 500 }
    )
  }
}
