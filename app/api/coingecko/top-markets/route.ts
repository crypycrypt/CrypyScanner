import { NextRequest, NextResponse } from 'next/server'

const COINGECKO_API = 'https://api.coingecko.com/api/v3'

// Server-side cache to avoid hammering CoinGecko and to make search/pagination fast
const cache = new Map<string, { data: any[]; ts: number }>()
const CACHE_DURATION = 60_000 // 1 minute

const MAX_PER_PAGE = 250 // CoinGecko free-tier max per page

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const vsCurrency = sp.get('vs_currency') || 'usd'
    const limit = Math.min(parseInt(sp.get('limit') || '1000', 10), 1000)

    const cacheKey = `top-${vsCurrency}-${limit}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_DURATION) {
      return NextResponse.json({ ok: true, coins: cached.data, total: cached.data.length, cached: true })
    }

    const pageCount = Math.ceil(limit / MAX_PER_PAGE)

    // Fetch all pages in parallel for speed
    const pageRequests = Array.from({ length: pageCount }, (_, i) => {
      const url = new URL(`${COINGECKO_API}/coins/markets`)
      url.searchParams.set('vs_currency', vsCurrency)
      url.searchParams.set('order', 'market_cap_desc')
      url.searchParams.set('per_page', String(MAX_PER_PAGE))
      url.searchParams.set('page', String(i + 1))
      url.searchParams.set('sparkline', 'true')
      url.searchParams.set('price_change_percentage', '1h,24h,7d')
      return fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }).then((r) => {
        if (!r.ok) throw new Error(`CoinGecko HTTP ${r.status}`)
        return r.json()
      })
    })

    const results = await Promise.allSettled(pageRequests)

    // Collect all successful pages
    const allCoins: any[] = []
    for (const result of results) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        allCoins.push(...result.value)
      }
    }

    // Deduplicate by id
    const seen = new Set<string>()
    const unique = allCoins.filter((c: any) => {
      if (!c || seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })

    const coins = unique.slice(0, limit)

    cache.set(cacheKey, { data: coins, ts: Date.now() })

    return NextResponse.json({ ok: true, coins, total: coins.length, cached: false })
  } catch (error: any) {
    console.error('/api/coingecko/top-markets error:', error?.message ?? error)
    return NextResponse.json(
      { ok: false, coins: [], total: 0, error: error?.message || 'Failed to fetch market data' },
      { status: 500 }
    )
  }
}
