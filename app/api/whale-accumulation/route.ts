import { NextRequest, NextResponse } from 'next/server'

type EcosystemMeta = {
  name: string
  symbol: string
  emoji: string
  chain: string
  color: string
  cgIds: string[]
}

const ECOSYSTEM_MAP: Record<string, EcosystemMeta> = {
  solana: {
    name: 'Solana', symbol: 'SOL', emoji: '◎', chain: 'solana', color: '#9945FF',
    cgIds: ['dogwifhat', 'bonk', 'jupiter', 'raydium', 'pyth-network', 'jito-governance-token', 'orca', 'popcat', 'book-of-meme', 'samoyedcoin', 'fartcoin', 'zerebro', 'ai16z', 'griffain', 'goat', 'arc', 'io-net', 'render-token'],
  },
  'the-open-network': {
    name: 'TON', symbol: 'TON', emoji: '💎', chain: 'ton', color: '#0088CC',
    cgIds: ['dogs-1', 'not', 'hamster-kombat', 'ston-fi', 'gram', 'tonkeeper'],
  },
  ethereum: {
    name: 'Ethereum', symbol: 'ETH', emoji: 'Ξ', chain: 'ethereum', color: '#627EEA',
    cgIds: ['uniswap', 'chainlink', 'aave', 'lido-dao', 'maker', 'curve-dao-token', 'pendle', 'eigenlayer', 'ether-fi', 'renzo', 'kelp-dao-restaked-eth'],
  },
  binancecoin: {
    name: 'BNB Chain', symbol: 'BNB', emoji: '🟡', chain: 'bsc', color: '#F3BA2F',
    cgIds: ['pancakeswap-token', 'trust-wallet-token', 'venus', 'alpaca-finance', 'bake', 'four-token'],
  },
  sui: {
    name: 'Sui', symbol: 'SUI', emoji: '💧', chain: 'sui', color: '#6FBCF0',
    cgIds: ['cetus-protocol', 'navi-protocol', 'bucket-protocol', 'aftermath-finance', 'scallop-2', 'turbos-finance'],
  },
  aptos: {
    name: 'Aptos', symbol: 'APT', emoji: '🔵', chain: 'aptos', color: '#00C2FF',
    cgIds: ['thala', 'aries-markets', 'pancakeswap-token', 'abel-finance'],
  },
  'avalanche-2': {
    name: 'Avalanche', symbol: 'AVAX', emoji: '🔺', chain: 'avalanche', color: '#E84142',
    cgIds: ['trader-joe-2', 'benqi', 'gmx', 'vector-finance', 'platypus-finance'],
  },
  'injective-protocol': {
    name: 'Injective', symbol: 'INJ', emoji: '🌊', chain: 'injective', color: '#00A3FF',
    cgIds: ['black-panther', 'ninja-protocol', 'helix'],
  },
  near: {
    name: 'NEAR', symbol: 'NEAR', emoji: '🟩', chain: 'near', color: '#00EC97',
    cgIds: ['aurora-near', 'ref-finance', 'meta-pool', 'linear-protocol'],
  },
  arbitrum: {
    name: 'Arbitrum', symbol: 'ARB', emoji: '🔷', chain: 'arbitrum', color: '#28A0F0',
    cgIds: ['gmx', 'radiant-capital', 'dopex', 'jones-dao', 'plutus-dao'],
  },
  base: {
    name: 'Base', symbol: 'BASE', emoji: '🔵', chain: 'base', color: '#0052FF',
    cgIds: ['aerodrome-finance', 'moonwell-artemis', 'based-brett', 'degen-base', 'toshi-on-base', 'higher', 'ski-mask-dog', 'virtuals-protocol', 'luna-by-virtuals', 'aixbt-by-virtuals', 'game-by-virtuals'],
  },
  'hyperliquid': {
    name: 'Hyperliquid', symbol: 'HYPE', emoji: '⚡', chain: 'hyperliquid', color: '#00FF88',
    cgIds: ['hyperliquid', 'purr-hyperliquid', 'ferocious', 'hfun'],
  },
  'polygon-ecosystem-token': {
    name: 'Polygon', symbol: 'POL', emoji: '🟣', chain: 'polygon', color: '#8247E5',
    cgIds: ['quickswap', 'aavegotchi', 'gains-network', 'dystopia', 'sphere-finance', 'maticverse'],
  },
  optimism: {
    name: 'Optimism', symbol: 'OP', emoji: '🔴', chain: 'optimism', color: '#FF0420',
    cgIds: ['velodrome-finance', 'beethoven-x', 'kwenta', 'lyra-finance', 'exactly-protocol', 'sonne-finance'],
  },
  cosmos: {
    name: 'Cosmos', symbol: 'ATOM', emoji: '⚛️', chain: 'cosmos', color: '#2E3148',
    cgIds: ['osmosis', 'celestia', 'dydx', 'injective-protocol', 'sei-network', 'kava', 'akash-network', 'stargaze', 'stride', 'quicksilver', 'neutron-3', 'coreum', 'persistence'],
  },
  'berachain-bera': {
    name: 'Berachain', symbol: 'BERA', emoji: '🐻', chain: 'berachain', color: '#FF8A00',
    cgIds: ['berachain-bera', 'infrared-finance', 'kodiak-finance', 'berps', 'honey-berachain', 'd2-finance'],
  },
  'virtual-protocol': {
    name: 'AI Agents (VIRTUAL)', symbol: 'VIRTUAL', emoji: '🤖', chain: 'base', color: '#8B5CF6',
    cgIds: ['virtuals-protocol', 'luna-by-virtuals', 'game-by-virtuals', 'aixbt-by-virtuals', 'vader-ai', 'sekoia', 'lolcat', 'padre', 'dasha', 'misato', 'orbit-claude', 'toshi-on-base'],
  },
  'io-net': {
    name: 'DePIN (IO)', symbol: 'IO', emoji: '🌐', chain: 'solana', color: '#00D4FF',
    cgIds: ['io-net', 'render-token', 'helium', 'helium-mobile', 'iotex', 'fetch-ai', 'nosana', 'akash-network', 'grass', 'hivemapper'],
  },
  'ondo-finance': {
    name: 'RWA (ONDO)', symbol: 'ONDO', emoji: '🏦', chain: 'ethereum', color: '#1A56DB',
    cgIds: ['ondo-finance', 'polymath-network', 'centrifuge', 'maple', 'truefi', 'goldfinch', 'credix-finance', 'toucan-protocol'],
  },
}

const WHALE_ACC_TTL = 4 * 60_000
let whaleAccCache: any = null
let whaleAccCacheTs = 0

function computeWhaleScore(c: any) {
  const ch1h = c.price_change_percentage_1h_in_currency ?? 0
  const ch24h = c.price_change_percentage_24h ?? 0
  const vol = c.total_volume ?? 0
  const mcap = c.market_cap ?? 0
  const high = c.high_24h ?? 0
  const low = c.low_24h ?? 0
  const price = c.current_price ?? 0

  // Filter out micro-caps (< $5M) to reduce false signals from manipulation
  if (!mcap || mcap < 5_000_000 || !vol) {
    return { score: 0, signals: [] as string[], type: 'NORMAL', label: '—', color: '#475569', volMcRatio: 0, confidence: 0 }
  }

  const volMcRatio = vol / mcap
  const priceAbsChange = Math.abs(ch24h)
  const pricePosFromLow = price > 0 && low > 0 && high > low ? (price - low) / (high - low) : null

  let score = 0
  const signals: string[] = []
  let signalCount = 0

  // Volume signals (base layer)
  if (volMcRatio > 0.5) {
    score += 20; signals.push('🔥 Extreme Vol Spike'); signalCount++
  } else if (volMcRatio > 0.3) {
    score += 15; signals.push('📈 High Vol/MCap'); signalCount++
  } else if (volMcRatio > 0.15) {
    score += 8; signals.push('📊 Above-avg Vol'); signalCount++
  }

  // Stealth accumulation: high volume but price barely moves
  if (volMcRatio > 0.15 && priceAbsChange < 1.5) {
    score += 25; signals.push('🐋 Stealth Accum'); signalCount++
  } else if (volMcRatio > 0.15 && priceAbsChange < 4) {
    score += 12; signals.push('👀 Low Price Move vs Vol'); signalCount++
  }

  // Absorption: price down but volume high = selling being absorbed
  if (ch24h < -2 && volMcRatio > 0.2) {
    score += 18; signals.push('🟢 Absorption'); signalCount++
  }

  // Support test: near 24h low with volume
  if (pricePosFromLow !== null && pricePosFromLow < 0.2 && volMcRatio > 0.12) {
    score += 15; signals.push('📍 Near Support'); signalCount++
  }

  // Reversal forming: 1h positive but 24h negative
  if (ch1h > 0.5 && ch24h < -1) {
    score += 10; signals.push('↗️ Reversal Forming'); signalCount++
  }

  // Volume sustainability: 1h volume is significant portion of 24h
  // This indicates sustained interest, not just a spike
  if (volMcRatio > 0.1 && ch1h > 0.3) {
    score += 8; signals.push('💧 Sustained Interest'); signalCount++
  }

  score = Math.min(100, score)

  // Confidence: based on number of distinct signals
  // More signals = higher confidence
  const confidence = Math.min(100, signalCount * 20 + (score > 50 ? 20 : 0))

  // Require at least 2 signals for ACCUMULATING to reduce false positives
  if (score >= 55 && signalCount >= 2) {
    return { score, signals, type: 'ACCUMULATING', label: '🐋 Accumulating', color: '#22c55e', volMcRatio: +volMcRatio.toFixed(3), confidence }
  }

  if (score >= 35 && signalCount >= 2) {
    return { score, signals, type: 'WATCHING', label: '👀 Watching', color: '#f59e0b', volMcRatio: +volMcRatio.toFixed(3), confidence }
  }

  return { score, signals, type: 'NORMAL', label: '—', color: '#475569', volMcRatio: +volMcRatio.toFixed(3), confidence }
}

async function fetchJson(url: string, timeoutMs: number) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  })

  return response.ok ? response.json() : null
}

async function fetchMarketsChunk(ids: string[], origin: string) {
  const directUrl = new URL('https://api.coingecko.com/api/v3/coins/markets')
  directUrl.searchParams.set('vs_currency', 'usd')
  directUrl.searchParams.set('ids', ids.join(','))
  directUrl.searchParams.set('price_change_percentage', '1h,24h')
  directUrl.searchParams.set('sparkline', 'false')
  directUrl.searchParams.set('per_page', '100')

  const direct = await fetchJson(directUrl.toString(), 12_000)
  if (Array.isArray(direct) && direct.length > 0) return direct

  const proxyUrl = new URL('/api/coingecko/markets', origin)
  proxyUrl.searchParams.set('vs_currency', 'usd')
  proxyUrl.searchParams.set('ids', ids.join(','))
  proxyUrl.searchParams.set('per_page', '100')
  proxyUrl.searchParams.set('page', '1')

  const proxied = await fetchJson(proxyUrl.toString(), 12_000)
  return Array.isArray(proxied) ? proxied : []
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'

  if (!forceRefresh && whaleAccCache && Date.now() - whaleAccCacheTs < WHALE_ACC_TTL) {
    return NextResponse.json({ ok: true, cached: true, ...whaleAccCache })
  }

  try {
    const allIds = [...new Set(Object.values(ECOSYSTEM_MAP).flatMap(e => e.cgIds))]
    const chunks = [allIds.slice(0, 100), allIds.slice(100, 200)].filter(c => c.length)

    const pages = await Promise.allSettled(chunks.map(ids => fetchMarketsChunk(ids, request.nextUrl.origin)))

    const coins: any[] = []
    pages.forEach(page => {
      if (page.status === 'fulfilled' && Array.isArray(page.value)) coins.push(...page.value)
    })

    const scored = coins.map(c => {
      const ws = computeWhaleScore(c)
      const ecoId = Object.keys(ECOSYSTEM_MAP).find(k => ECOSYSTEM_MAP[k].cgIds.includes(c.id))
      const ecoMeta = ecoId ? ECOSYSTEM_MAP[ecoId] : null

      return {
        id: c.id,
        symbol: c.symbol?.toUpperCase(),
        name: c.name,
        image: c.image,
        price: c.current_price,
        ch1h: +(c.price_change_percentage_1h_in_currency ?? 0).toFixed(2),
        ch24h: +(c.price_change_percentage_24h ?? 0).toFixed(2),
        volume: c.total_volume,
        volume24h: c.total_volume,
        marketCap: c.market_cap,
        high24h: c.high_24h,
        low24h: c.low_24h,
        ecoSymbol: ecoMeta?.symbol ?? '?',
        ecoName: ecoMeta?.name ?? '?',
        ecoEmoji: ecoMeta?.emoji ?? '',
        ecoColor: ecoMeta?.color ?? '#64748b',
        stealthAccumulation: ws.signals.some(signal => signal.includes('Stealth')),
        absorptionAtSupport: ws.signals.some(signal => signal.includes('Absorption')),
        volumeAnomaly: ws.signals.some(signal => signal.includes('Vol')),
        nearSupport: ws.signals.some(signal => signal.includes('Near 24h Low')),
        ...ws,
      }
    })
      .filter(t => t.score > 0)
      .sort((a, b) => b.score - a.score)

    const accumulating = scored.filter(t => t.type === 'ACCUMULATING')
    const watching = scored.filter(t => t.type === 'WATCHING')

    const result: any = {
      tokens: scored,
      total: scored.length,
      accumulatingCount: accumulating.length,
      watchingCount: watching.length,
      topAccumulating: accumulating.slice(0, 12),
      fetchedAt: new Date().toISOString(),
      whaleAccumulators: scored
        .filter(t => t.type !== 'NORMAL')
        .slice(0, 15)
        .map(t => ({
          id: t.id,
          symbol: t.symbol,
          name: t.name,
          image: t.image,
          price: t.price,
          priceChange24h: t.ch24h,
          priceChange7d: 0,
          volume24h: t.volume24h,
          marketCap: t.marketCap,
          volMcRatio: t.volMcRatio,
          signal: t.label,
          strength: t.score,
          confidence: t.confidence,
        })),
      dexAccumulating: [],
      boostedTokens: [],
    }

    const [dsRes, boostRes] = await Promise.allSettled([
      fetchJson('https://api.dexscreener.com/latest/dex/search?q=solana', 10_000),
      fetchJson('https://api.dexscreener.com/token-boosts/top/v1', 8_000),
    ])

    if (dsRes.status === 'fulfilled') {
      const pairs = dsRes.value?.pairs || []
      result.dexAccumulating = pairs
        .filter((p: any) => p.chainId === 'solana' && parseFloat(p.volume?.h1 || 0) > 10000 && parseFloat(p.priceChange?.h1 || 0) > 3)
        .map((p: any) => ({
          address: p.baseToken?.address,
          symbol: p.baseToken?.symbol,
          name: p.baseToken?.name,
          price: parseFloat(p.priceUsd || 0),
          priceChange1h: parseFloat(p.priceChange?.h1 || 0),
          priceChange24h: parseFloat(p.priceChange?.h24 || 0),
          volume1h: parseFloat(p.volume?.h1 || 0),
          volume24h: parseFloat(p.volume?.h24 || 0),
          liquidity: parseFloat(p.liquidity?.usd || 0),
          buys1h: p.txns?.h1?.buys || 0,
          sells1h: p.txns?.h1?.sells || 0,
          buyPressure: p.txns?.h1?.buys > 0 ? (p.txns.h1.buys / (p.txns.h1.buys + p.txns.h1.sells) * 100).toFixed(1) : 0,
          dexUrl: p.url,
        }))
        .filter((p: any) => parseFloat(p.buyPressure) > 55)
        .sort((a: any, b: any) => b.volume1h - a.volume1h)
        .slice(0, 20)
    }

    if (boostRes.status === 'fulfilled') {
      const boosts = Array.isArray(boostRes.value) ? boostRes.value : []
      result.boostedTokens = boosts
        .filter((t: any) => t.chainId === 'solana')
        .slice(0, 10)
        .map((t: any) => ({
          address: t.tokenAddress,
          symbol: t.symbol || t.tokenAddress?.slice(0, 6),
          name: t.description?.split('.')[0]?.slice(0, 40) || 'Unknown',
          totalBoost: t.totalAmount,
          icon: t.icon || null,
          url: t.url,
        }))
    }

    whaleAccCache = result
    whaleAccCacheTs = Date.now()

    return NextResponse.json({ ok: true, cached: false, ...result })
  } catch (error: any) {
    console.error('/api/whale-accumulation error:', error?.message ?? error)
    if (whaleAccCache) return NextResponse.json({ ok: true, cached: true, stale: true, ...whaleAccCache })
    return NextResponse.json({ ok: false, error: error?.message || 'Failed to fetch whale accumulation data' }, { status: 500 })
  }
}
