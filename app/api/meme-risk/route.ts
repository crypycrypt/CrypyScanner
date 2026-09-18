import { NextRequest, NextResponse } from 'next/server'

// ─── Meme Risk Engine ────────────────────────────────────────────
// Detects risk events for Solana meme coins using DexScreener data.
// All data is fetched from free public APIs — no hardcoded coins.

const DEXSCREENER_SEARCH = 'https://api.dexscreener.com/latest/dex/search'
const DEXSCREENER_TOKENS = 'https://api.dexscreener.com/latest/dex/tokens'

const cache = new Map<string, { data: any; ts: number }>()
const CACHE_DURATION = 25_000 // 25 seconds

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

type RiskType =
  | 'LIQUIDITY_REMOVAL'
  | 'DEPLOYER_SELL'
  | 'COORDINATED_EXIT'
  | 'BUNDLED_SUPPLY'
  | 'SUSPICIOUS_FUNDING'
  | 'RAPID_ROTATION'
  | 'ABNORMAL_SELL'
  | 'HOLDER_CONCENTRATION'

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

interface RiskEvent {
  id: string
  token: string
  tokenAddress: string
  type: RiskType
  severity: RiskLevel
  description: string
  detectedAt: string
  details: string
}

// ─── Risk detection from real token data ─────────────────────────
function detectRiskEvents(tokens: any[]): RiskEvent[] {
  const events: RiskEvent[] = []

  for (const token of tokens) {
    const liq = parseFloat(token.liquidity?.usd || 0)
    const vol24h = parseFloat(token.volume?.h24 || 0)
    const buys1h = token.txns?.h1?.buys || 0
    const sells1h = token.txns?.h1?.sells || 0
    const totalTx = buys1h + sells1h
    const buyRatio = totalTx > 0 ? buys1h / totalTx : 0.5
    const priceChange1h = parseFloat(token.priceChange?.h1 || 0)
    const priceChange24h = parseFloat(token.priceChange?.h24 || 0)
    const symbol = token.baseToken?.symbol || '???'
    const address = token.baseToken?.address || ''

    // Liquidity removal: low liquidity with high volume
    if (liq < 25_000 && vol24h > 50_000) {
      events.push({
        id: `risk-${address}-liq`,
        token: symbol,
        tokenAddress: address,
        type: 'LIQUIDITY_REMOVAL',
        severity: liq < 10_000 ? 'CRITICAL' : 'HIGH',
        description: `Low liquidity ($${Math.round(liq / 1000)}K) with high volume`,
        detectedAt: new Date().toISOString(),
        details: `Liquidity: $${Math.round(liq).toLocaleString()} | Volume 24h: $${Math.round(vol24h).toLocaleString()}`,
      })
    }

    // Abnormal sell: high sell ratio
    if (sells1h > buys1h * 2) {
      events.push({
        id: `risk-${address}-sell`,
        token: symbol,
        tokenAddress: address,
        type: 'ABNORMAL_SELL',
        severity: sells1h > buys1h * 3 ? 'CRITICAL' : 'HIGH',
        description: `Abnormal sell pressure (${Math.round(sells1h / Math.max(buys1h, 1))}x sells vs buys)`,
        detectedAt: new Date().toISOString(),
        details: `Buys: ${buys1h} | Sells: ${sells1h} | Sell ratio: ${Math.round(buyRatio * 100)}%`,
      })
    }

    // Coordinated exit: high sells with price drop
    if (sells1h > 20 && priceChange1h < -10) {
      events.push({
        id: `risk-${address}-exit`,
        token: symbol,
        tokenAddress: address,
        type: 'COORDINATED_EXIT',
        severity: priceChange1h < -20 ? 'CRITICAL' : 'HIGH',
        description: `Coordinated exit detected (${sells1h} sells, price down ${Math.round(priceChange1h)}%)`,
        detectedAt: new Date().toISOString(),
        details: `Price 1h: ${priceChange1h.toFixed(1)}% | Sells: ${sells1h}`,
      })
    }

    // Holder concentration: high volume with low unique buyers
    const uniqueBuyers = token.txns?.h1?.uniqueBuys || 0
    if (totalTx > 0 && uniqueBuyers / totalTx < 0.3 && totalTx > 30) {
      events.push({
        id: `risk-${address}-conc`,
        token: symbol,
        tokenAddress: address,
        type: 'HOLDER_CONCENTRATION',
        severity: 'MEDIUM',
        description: `Possible bundled supply (${Math.round(uniqueBuyers / totalTx * 100)}% unique buyers)`,
        detectedAt: new Date().toISOString(),
        details: `Total txns: ${totalTx} | Unique buyers: ${uniqueBuyers}`,
      })
    }

    // Rapid rotation: high volume with extreme price volatility
    if (Math.abs(priceChange1h) > 30 && vol24h > 100_000) {
      events.push({
        id: `risk-${address}-rot`,
        token: symbol,
        tokenAddress: address,
        type: 'RAPID_ROTATION',
        severity: Math.abs(priceChange1h) > 50 ? 'HIGH' : 'MEDIUM',
        description: `Rapid wallet rotation (price ${priceChange1h > 0 ? 'up' : 'down'} ${Math.round(Math.abs(priceChange1h))}% in 1h)`,
        detectedAt: new Date().toISOString(),
        details: `Price 1h: ${priceChange1h.toFixed(1)}% | Volume 24h: $${Math.round(vol24h).toLocaleString()}`,
      })
    }

    // Deployer risk: extreme volatility
    if (Math.abs(priceChange24h) > 80) {
      events.push({
        id: `risk-${address}-deployer`,
        token: symbol,
        tokenAddress: address,
        type: 'DEPLOYER_SELL',
        severity: Math.abs(priceChange24h) > 150 ? 'CRITICAL' : 'HIGH',
        description: `Extreme volatility (${priceChange24h > 0 ? 'up' : 'down'} ${Math.round(Math.abs(priceChange24h))}% in 24h)`,
        detectedAt: new Date().toISOString(),
        details: `Price 24h: ${priceChange24h.toFixed(1)}% | Possible deployer activity`,
      })
    }
  }

  return events.sort((a, b) => {
    const severityOrder: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }
    return severityOrder[b.severity] - severityOrder[a.severity]
  })
}

// ─── Compute risk score for a token ──────────────────────────────
function computeRiskScore(token: any): { score: number; flags: string[]; levels: Record<string, RiskLevel> } {
  const flags: string[] = []
  const levels: Record<string, RiskLevel> = {}

  const liq = parseFloat(token.liquidity?.usd || 0)
  const buys1h = token.txns?.h1?.buys || 0
  const sells1h = token.txns?.h1?.sells || 0
  const totalTx = buys1h + sells1h
  const buyRatio = totalTx > 0 ? buys1h / totalTx : 0.5
  const priceChange1h = parseFloat(token.priceChange?.h1 || 0)
  const priceChange24h = parseFloat(token.priceChange?.h24 || 0)
  const uniqueBuyers = token.txns?.h1?.uniqueBuys || 0

  // Liquidity risk
  if (liq < 10_000) {
    levels.liquidity = 'HIGH'
    flags.push('Low liquidity (<$10K)')
  } else if (liq < 50_000) {
    levels.liquidity = 'MEDIUM'
    flags.push('Moderate liquidity (<$50K)')
  } else {
    levels.liquidity = 'LOW'
  }

  // Holder risk
  if (buyRatio < 0.3) {
    levels.holder = 'HIGH'
    flags.push('Heavy sell pressure')
  } else if (buyRatio < 0.45) {
    levels.holder = 'MEDIUM'
  } else {
    levels.holder = 'LOW'
  }

  // Deployer risk
  if (Math.abs(priceChange24h) > 100) {
    levels.deployer = 'HIGH'
    flags.push('Extreme volatility')
  } else if (Math.abs(priceChange24h) > 50) {
    levels.deployer = 'MEDIUM'
  } else {
    levels.deployer = 'LOW'
  }

  // Exit risk
  const sellExcess = sells1h > buys1h * 1.5
  if (sellExcess && priceChange1h < -10) {
    levels.exit = 'HIGH'
    flags.push('Coordinated exit pressure')
  } else if (sellExcess) {
    levels.exit = 'MEDIUM'
  } else {
    levels.exit = 'LOW'
  }

  // Cluster risk
  if (totalTx > 0 && uniqueBuyers / totalTx < 0.3 && totalTx > 30) {
    levels.cluster = 'HIGH'
    flags.push('Possible bot/bundled activity')
  } else if (totalTx > 0 && uniqueBuyers / totalTx < 0.5) {
    levels.cluster = 'MEDIUM'
  } else {
    levels.cluster = 'LOW'
  }

  // Calculate overall risk score (0 = lowest, 100 = extreme)
  let score = 0
  if (levels.liquidity === 'HIGH') score += 35
  else if (levels.liquidity === 'MEDIUM') score += 15
  if (levels.holder === 'HIGH') score += 25
  else if (levels.holder === 'MEDIUM') score += 10
  if (levels.deployer === 'HIGH') score += 20
  else if (levels.deployer === 'MEDIUM') score += 8
  if (levels.exit === 'HIGH') score += 15
  else if (levels.exit === 'MEDIUM') score += 7
  if (levels.cluster === 'HIGH') score += 10
  else if (levels.cluster === 'MEDIUM') score += 5

  score = Math.min(100, score)

  return { score, flags, levels }
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'
  const tokenAddress = request.nextUrl.searchParams.get('token')

  if (!forceRefresh && cache.has('meme-risk')) {
    const cached = cache.get('meme-risk')!
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
      const memeKeywords = ['dog', 'cat', 'pepe', 'frog', 'shib', 'inu', 'meme', 'bonk', 'wif', 'fart', 'ai', 'bot', 'token', 'coin']
      return memeKeywords.some(kw => name.includes(kw) || symbol.includes(kw))
    })

    // If a specific token is requested, fetch its pair data
    if (tokenAddress) {
      const tokenData = await fetchJson(`${DEXSCREENER_TOKENS}/${tokenAddress}`, 8_000)
      const tokenPairs = (tokenData?.pairs || []).filter((p: any) => p.chainId === 'solana')
      if (tokenPairs.length > 0) {
        const token = tokenPairs[0]
        const risk = computeRiskScore(token)
        return NextResponse.json({
          ok: true,
          token: {
            address: token.baseToken?.address || '',
            symbol: token.baseToken?.symbol || '???',
            name: token.baseToken?.name || 'Unknown',
            price: parseFloat(token.priceUsd || 0),
            priceChange1h: parseFloat(token.priceChange?.h1 || 0),
            priceChange24h: parseFloat(token.priceChange?.h24 || 0),
            liquidity: parseFloat(token.liquidity?.usd || 0),
            volume24h: parseFloat(token.volume?.h24 || 0),
            buys1h: token.txns?.h1?.buys || 0,
            sells1h: token.txns?.h1?.sells || 0,
            dexUrl: token.url || '',
          },
          riskScore: risk.score,
          riskFlags: risk.flags,
          riskLevels: risk.levels,
          fetchedAt: new Date().toISOString(),
        })
      }
    }

    // Detect risk events from all meme tokens
    const riskEvents = detectRiskEvents(memePairs)

    // Compute risk scores for all tokens
    const tokenRisks = memePairs.map((p: any) => {
      const risk = computeRiskScore(p)
      return {
        address: p.baseToken?.address || '',
        symbol: p.baseToken?.symbol || '???',
        name: p.baseToken?.name || 'Unknown',
        price: parseFloat(p.priceUsd || 0),
        priceChange1h: parseFloat(p.priceChange?.h1 || 0),
        priceChange24h: parseFloat(p.priceChange?.h24 || 0),
        liquidity: parseFloat(p.liquidity?.usd || 0),
        volume24h: parseFloat(p.volume?.h24 || 0),
        riskScore: risk.score,
        riskFlags: risk.flags,
        riskLevels: risk.levels,
        dexUrl: p.url || '',
      }
    })

    // Sort by risk score (highest risk first)
    tokenRisks.sort((a: any, b: any) => b.riskScore - a.riskScore)

    // Aggregate risk levels
    const riskSummary = {
      critical: tokenRisks.filter((t: any) => t.riskScore >= 70).length,
      high: tokenRisks.filter((t: any) => t.riskScore >= 50 && t.riskScore < 70).length,
      medium: tokenRisks.filter((t: any) => t.riskScore >= 30 && t.riskScore < 50).length,
      low: tokenRisks.filter((t: any) => t.riskScore < 30).length,
    }

    const result = {
      events: riskEvents.slice(0, 30),
      tokenRisks: tokenRisks.slice(0, 50),
      riskSummary,
      totalEvents: riskEvents.length,
      totalTokens: memePairs.length,
      fetchedAt: new Date().toISOString(),
    }

    cache.set('meme-risk', { data: result, ts: Date.now() })

    return NextResponse.json({ ok: true, cached: false, ...result })
  } catch (error: any) {
    console.error('/api/meme-risk error:', error?.message ?? error)
    if (cache.has('meme-risk')) {
      const cached = cache.get('meme-risk')!
      return NextResponse.json({ ok: true, cached: true, stale: true, ...cached.data })
    }
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch risk data' },
      { status: 500 }
    )
  }
}
