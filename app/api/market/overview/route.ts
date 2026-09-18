import { NextRequest, NextResponse } from 'next/server'

const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const FNG_API = 'https://api.alternative.me/fng/'

const cache = new Map<string, { data: any; ts: number }>()
const CACHE_DURATION = 60_000 // 1 minute

function formatMoney(v: number): string {
  if (!v || isNaN(v)) return 'N/A'
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(2)}T`
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  return `$${v.toFixed(0)}`
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const vsCurrency = sp.get('vs_currency') || 'usd'
  const cacheKey = `overview-${vsCurrency}`

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_DURATION) {
    return NextResponse.json({ ok: true, ...cached.data, cached: true })
  }

  try {
    const [globalRes, btcEthRes, fngRes] = await Promise.allSettled([
      fetch(`${COINGECKO_API}/global`, { headers: { Accept: 'application/json' }, cache: 'no-store' }),
      fetch(
        `${COINGECKO_API}/coins/markets?vs_currency=${vsCurrency}&ids=bitcoin,ethereum&order=market_cap_desc&per_page=2&page=1&sparkline=false&price_change_percentage=24h`,
        { headers: { Accept: 'application/json' }, cache: 'no-store' }
      ),
      fetch(FNG_API, { headers: { Accept: 'application/json' }, cache: 'no-store' }),
    ])

    let btc = { price: 0, change24h: 0 }
    let eth = { price: 0, change24h: 0 }
    if (btcEthRes.status === 'fulfilled' && btcEthRes.value.ok) {
      const coins = await btcEthRes.value.json()
      const btcCoin = coins.find((c: any) => c.id === 'bitcoin')
      const ethCoin = coins.find((c: any) => c.id === 'ethereum')
      if (btcCoin) btc = { price: btcCoin.current_price || 0, change24h: btcCoin.price_change_percentage_24h || 0 }
      if (ethCoin) eth = { price: ethCoin.current_price || 0, change24h: ethCoin.price_change_percentage_24h || 0 }
    }

    let totalMcap = 0
    let totalVolume = 0
    let btcDominance = 0
    let ethDominance = 0
    let activeCryptos = 0
    if (globalRes.status === 'fulfilled' && globalRes.value.ok) {
      const globalData = await globalRes.value.json()
      const d = globalData?.data || {}
      totalMcap = d.total_market_cap?.[vsCurrency] || 0
      totalVolume = d.total_volume?.[vsCurrency] || 0
      btcDominance = d.market_cap_percentage?.btc || 0
      ethDominance = d.market_cap_percentage?.eth || 0
      activeCryptos = d.active_cryptocurrencies || 0
    }

    let fng = null
    let fngLabel = 'N/A'
    if (fngRes.status === 'fulfilled' && fngRes.value.ok) {
      const fngData = await fngRes.value.json()
      const item = fngData?.data?.[0]
      if (item) {
        fng = parseInt(item.value, 10)
        fngLabel = item.value_classification || 'N/A'
      }
    }

    const data = {
      btc,
      eth,
      totalMcap,
      totalMcapLabel: formatMoney(totalMcap),
      totalVolume,
      totalVolumeLabel: formatMoney(totalVolume),
      btcDominance,
      ethDominance,
      activeCryptos,
      fng,
      fngLabel,
    }

    cache.set(cacheKey, { data, ts: Date.now() })

    return NextResponse.json({ ok: true, ...data, cached: false })
  } catch (error: any) {
    console.error('/api/market/overview error:', error?.message ?? error)
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch market overview' },
      { status: 500 }
    )
  }
}
