import { NextRequest, NextResponse } from 'next/server'

// ─── Meme Narrative Engine ───────────────────────────────────────
// Fetches real data from DexScreener and CoinGecko to track
// narrative/category momentum for Solana meme coins.

const DEXSCREENER_SEARCH = 'https://api.dexscreener.com/latest/dex/search'
const COINGECKO_API = 'https://api.coingecko.com/api/v3'

const cache = new Map<string, { data: any; ts: number }>()
const CACHE_DURATION = 45_000 // 45 seconds

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

// ─── Narrative classification ───────────────────────────────────
function classifyNarrative(name: string, symbol: string): string {
  const text = `${name} ${symbol}`.toLowerCase()
  if (text.includes('frog')) return 'FROG'
  if (text.includes('dog') || text.includes('wif') || text.includes('shib') || text.includes('inu')) return 'DOG'
  if (text.includes('cat') || text.includes('popcat') || text.includes('meow') || text.includes('samoyed')) return 'CAT'
  if (text.includes('ai') || text.includes('agent') || text.includes('bot')) return 'AI'
  if (text.includes('politi') || text.includes('trump') || text.includes('biden') || text.includes('maga')) return 'POLITICAL'
  if (text.includes('sport') || text.includes('nba') || text.includes('nfl') || text.includes('soccer')) return 'SPORTS'
  if (text.includes('game') || text.includes('play') || text.includes('nft')) return 'GAMING'
  if (text.includes('food') || text.includes('banana') || text.includes('pizza')) return 'FOOD'
  if (text.includes('art') || text.includes('pixel')) return 'ART'
  if (text.includes('music') || text.includes('song')) return 'MUSIC'
  return 'MEME'
}

// ─── Narrative queries for DexScreener search ─────────────────────
const NARRATIVE_QUERIES = [
  { name: 'FROG', query: 'frog', color: '#22e58a' },
  { name: 'DOG', query: 'dog', color: '#baff38' },
  { name: 'CAT', query: 'cat', color: '#a78bfa' },
  { name: 'AI', query: 'ai', color: '#55aaff' },
  { name: 'POLITICAL', query: 'trump', color: '#ff5d69' },
  { name: 'GAMING', query: 'game', color: '#8a4fff' },
  { name: 'FOOD', query: 'banana', color: '#ffc85b' },
  { name: 'MEME', query: 'meme', color: '#22e58a' },
]

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'

  if (!forceRefresh && cache.has('narratives')) {
    const cached = cache.get('narratives')!
    if (Date.now() - cached.ts < CACHE_DURATION) {
      return NextResponse.json({ ok: true, cached: true, ...cached.data })
    }
  }

  try {
    // Step 1: Fetch from DexScreener for each narrative
    const narrativeResults = await Promise.allSettled(
      NARRATIVE_QUERIES.map(async (narr) => {
        const data = await fetchJson(`${DEXSCREENER_SEARCH}?q=${encodeURIComponent(narr.query)}`, 8_000)
        const pairs = (data?.pairs || []).filter((p: any) => p.chainId === 'solana')

        // Compute narrative metrics
        const totalVolume = pairs.reduce((sum: number, p: any) => sum + parseFloat(p.volume?.h24 || 0), 0)
        const totalLiquidity = pairs.reduce((sum: number, p: any) => sum + parseFloat(p.liquidity?.usd || 0), 0)
        const totalTokens = pairs.length
        const avgPriceChange = pairs.length > 0
          ? pairs.reduce((sum: number, p: any) => sum + parseFloat(p.priceChange?.h24 || 0), 0) / pairs.length
          : 0

        // Velocity: how fast volume is growing (proxy: volume / liquidity ratio)
        const velocity = totalLiquidity > 0 ? (totalVolume / totalLiquidity) * 100 : 0

        // Smart money participation (proxy: buy ratio across pairs)
        const totalBuys = pairs.reduce((sum: number, p: any) => sum + (p.txns?.h1?.buys || 0), 0)
        const totalSells = pairs.reduce((sum: number, p: any) => sum + (p.txns?.h1?.sells || 0), 0)
        const totalTx = totalBuys + totalSells
        const smartMoneyParticipation = totalTx > 0 ? (totalBuys / totalTx) * 100 : 50

        // Determine narrative state
        let state: 'EARLY' | 'ACCELERATING' | 'PEAKING' | 'DECLINING'
        if (velocity > 50 && avgPriceChange > 10) state = 'ACCELERATING'
        else if (velocity > 30 && avgPriceChange > 0) state = 'EARLY'
        else if (avgPriceChange < -10) state = 'DECLINING'
        else if (velocity < 10) state = 'PEAKING'
        else state = 'EARLY'

        return {
          name: narr.name,
          narrative: narr.name,
          color: narr.color,
          velocity: Math.round(velocity),
          tokensLaunched: totalTokens,
          volumeGrowth: Math.round(avgPriceChange * 10) / 10,
          smartMoneyParticipation: Math.round(smartMoneyParticipation),
          totalVolume,
          totalLiquidity,
          avgPriceChange: Math.round(avgPriceChange * 100) / 100,
          state,
          tokens: pairs.slice(0, 10).map((p: any) => ({
            address: p.baseToken?.address || '',
            symbol: p.baseToken?.symbol || '???',
            name: p.baseToken?.name || 'Unknown',
            price: parseFloat(p.priceUsd || 0),
            priceChange1h: parseFloat(p.priceChange?.h1 || 0),
            priceChange24h: parseFloat(p.priceChange?.h24 || 0),
            volume24h: parseFloat(p.volume?.h24 || 0),
            liquidity: parseFloat(p.liquidity?.usd || 0),
            buys1h: p.txns?.h1?.buys || 0,
            sells1h: p.txns?.h1?.sells || 0,
            dexUrl: p.url || '',
          })),
        }
      })
    )

    // Step 2: Fetch CoinGecko trending for additional context
    const cgTrending = await fetchJson(`${COINGECKO_API}/search/trending`, 8_000)
    const cgTrendingTokens = (cgTrending?.coins || []).slice(0, 10).map((c: any) => ({
      id: c.item?.id,
      symbol: c.item?.symbol,
      name: c.item?.name,
      thumb: c.item?.thumb,
      score: c.item?.score,
    }))

    // Step 3: Build narrative list
    const narratives = narrativeResults
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as any).value)
      .sort((a, b) => b.velocity - a.velocity)

    const result = {
      narratives,
      trending: cgTrendingTokens,
      totalNarratives: narratives.length,
      topNarrative: narratives[0]?.name || 'N/A',
      fetchedAt: new Date().toISOString(),
    }

    cache.set('narratives', { data: result, ts: Date.now() })

    return NextResponse.json({ ok: true, cached: false, ...result })
  } catch (error: any) {
    console.error('/api/meme-narratives error:', error?.message ?? error)
    if (cache.has('narratives')) {
      const cached = cache.get('narratives')!
      return NextResponse.json({ ok: true, cached: true, stale: true, ...cached.data })
    }
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch narrative data' },
      { status: 500 }
    )
  }
}
