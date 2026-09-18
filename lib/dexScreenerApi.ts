// ══════════════════════════════════════════════════════════════════════════════
// DEXScreener API Client
// Mirrors functionality from crypto-scanner/dex-screener-api.js
// ══════════════════════════════════════════════════════════════════════════════

const BASE_URL = 'https://api.dexscreener.com/latest/dex'

async function _get(url: string, timeout = 10000): Promise<any> {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const r = await fetch(fullUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrypyCrypt/1.0)',
        'Accept': 'application/json'
      }
    })
    
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}: ${r.statusText}`)
    }
    
    return await r.json()
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

function parsePair(p: any) {
  if (!p) return null
  
  const base = p.baseToken
  const quote = p.quoteToken
  const pair = p.pair
  
  if (!base || !quote || !pair) return null
  
  const priceUsd = parseFloat(pair.priceUsd || '0')
  const priceChange = parseFloat(pair.priceChange?.h24 || '0')
  const priceChangePercent = parseFloat(pair.priceChange?.h24Percent || '0')
  
  const volumeH24 = parseFloat(pair.volume?.h24 || '0')
  const liquidityUsd = parseFloat(pair.liquidity?.usd || '0')
  const fdv = parseFloat(pair.fdv || '0')
  const marketCap = fdv > 0 ? fdv : liquidityUsd * 10 // Estimate MCap if FDV not available
  
  const txns5m = pair.txns?.m5 || 0
  
  return {
    id: pair.pairAddress,
    symbol: base.symbol,
    name: base.name || base.symbol,
    chain: p.chainId?.toUpperCase() || 'UNKNOWN',
    dex: p.dexId?.toUpperCase() || 'UNKNOWN',
    addr: pair.pairAddress?.slice(0, 8) + '...' + pair.pairAddress?.slice(-6) || 'N/A',
    price: priceUsd,
    change: priceChangePercent,
    mcap: formatCurrency(marketCap),
    fdv: formatCurrency(fdv),
    vol24: formatCurrency(volumeH24),
    liq: formatCurrency(liquidityUsd),
    h1: parseFloat(pair.priceChange?.h1Percent || '0'),
    h24: priceChangePercent,
    d7: parseFloat(pair.priceChange?.d7Percent || '0'),
    txns5m: txns5m,
    pairAddress: pair.pairAddress,
    baseToken: base,
    quoteToken: quote,
    url: pair.url,
    image: base.image || undefined
  }
}

function formatCurrency(value: number): string {
  if (value >= 1000000000) {
    return `$${(value / 1000000000).toFixed(1)}B`
  }
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`
  }
  return `$${value.toFixed(2)}`
}

export async function getTopGainers(chain = 'solana', period = '24h'): Promise<any[]> {
  try {
    // Search for trending tokens on the specified chain
    const queries = [
      'RAYDIUM', 'JUPITER', 'ORCA', 'METEORA', 'STEPN',
      'BONK', 'WIF', 'JTO', 'PYTH', 'JUP',
      'LDO', 'APE', 'KAITO', 'ORDI', 'YFI'
    ]
    
    const results = []
    
    for (const query of queries) {
      try {
        const data = await _get(`/search/?q=${encodeURIComponent(query)}`)
        if (data && data.pairs) {
          const pairs = data.pairs
            .filter((p: any) => p.chainId?.toLowerCase().includes(chain.toLowerCase()))
            .map(parsePair)
            .filter(Boolean)
            
          results.push(...pairs)
        }
      } catch (err) {
        console.warn(`Failed to search for ${query}:`, err)
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    // Remove duplicates and sort by 24h gain
    const uniquePairs = results.reduce((acc: any[], pair: any) => {
      if (!acc.find(p => p.id === pair.id)) {
        acc.push(pair)
      }
      return acc
    }, [])
    
    return uniquePairs
      .sort((a, b) => b.change - a.change)
      .slice(0, 50)
      
  } catch (err) {
    console.error('Failed to fetch top gainers:', err)
    return []
  }
}

export async function searchToken(query: string): Promise<any[]> {
  try {
    const data = await _get(`/search/?q=${encodeURIComponent(query)}`)
    if (data && data.pairs) {
      return data.pairs.map(parsePair).filter(Boolean).slice(0, 20)
    }
    return []
  } catch (err) {
    console.error('Failed to search token:', err)
    return []
  }
}

export async function getTokenPairs(mintOrAddress: string): Promise<any[]> {
  try {
    const data = await _get(`/tokens/${mintOrAddress}`)
    if (data && data.pairs) {
      return data.pairs.map(parsePair).filter(Boolean)
    }
    return []
  } catch (err) {
    console.error('Failed to fetch token pairs:', err)
    return []
  }
}

export async function getNewTokens(chain = 'solana'): Promise<any[]> {
  try {
    const data = await _get(`/search/?q=new&chainId=${chain}`)
    if (data && data.pairs) {
      return data.pairs
        .map(parsePair)
        .filter(Boolean)
        .filter((p: any) => p.txns5m > 0) // Only tokens with recent activity
        .slice(0, 30)
    }
    return []
  } catch (err) {
    console.error('Failed to fetch new tokens:', err)
    return []
  }
}

export async function getPair(pairAddress: string, chain = 'solana'): Promise<any> {
  try {
    const data = await _get(`/pairs/${chain}/${pairAddress}`)
    if (data && data.pair) {
      return parsePair(data.pair)
    }
    return null
  } catch (err) {
    console.error('Failed to fetch pair:', err)
    return null
  }
}

export async function getTrendingTokens(): Promise<any[]> {
  try {
    const data = await _get('/search/?q=trending')
    if (data && data.pairs) {
      return (Array.isArray(data.pairs) ? data.pairs : [])
        .slice(0, 50)
        .map(parsePair)
        .filter(Boolean)
    }
    return []
  } catch (err) {
    console.error('Failed to fetch trending tokens:', err)
    return []
  }
}

export async function getBoostedTokens(): Promise<any[]> {
  try {
    const data = await _get('/search/?q=boosted')
    if (data && data.pairs) {
      return (Array.isArray(data.pairs) ? data.pairs : [])
        .slice(0, 50)
        .map(parsePair)
        .filter(Boolean)
    }
    return []
  } catch (err) {
    console.error('Failed to fetch boosted tokens:', err)
    return []
  }
}

export async function getTopBoosted(): Promise<any[]> {
  try {
    const data = await _get('/search/?q=topboosted')
    if (data && data.pairs) {
      return (Array.isArray(data.pairs) ? data.pairs : [])
        .slice(0, 50)
        .map(parsePair)
        .filter(Boolean)
    }
    return []
  } catch (err) {
    console.error('Failed to fetch top boosted tokens:', err)
    return []
  }
}