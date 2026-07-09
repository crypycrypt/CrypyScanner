import { NextRequest, NextResponse } from 'next/server'

const COINGECKO_API = 'https://api.coingecko.com/api/v3'

// Simple cache to avoid hitting rate limits
const cache = new Map()
const CACHE_DURATION = 60000 // 1 minute

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const vsCurrency = searchParams.get('vs_currency') || 'usd'
    const ids = searchParams.get('ids') || ''
    const perPage = searchParams.get('per_page') || '50'
    const page = searchParams.get('page') || '1'
    
    const cacheKey = `markets-${vsCurrency}-${ids}-${perPage}-${page}`
    const cached = cache.get(cacheKey)
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data)
    }
    
    // Build the CoinGecko URL
    const url = new URL(`${COINGECKO_API}/coins/markets`)
    url.searchParams.set('vs_currency', vsCurrency)
    if (ids) url.searchParams.set('ids', ids)
    url.searchParams.set('per_page', perPage)
    url.searchParams.set('page', page)
    url.searchParams.set('sparkline', 'false')
    url.searchParams.set('price_change_percentage', '1h,24h,7d')
    
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      // If API fails, return mock data
      console.warn('CoinGecko API failed, returning mock data')
      
      const mockIds = ids ? ids.split(',') : ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot']
      const mockData = mockIds.map((id, index) => ({
        id,
        symbol: id.substring(0, 3).toUpperCase(),
        name: id.charAt(0).toUpperCase() + id.slice(1),
        current_price: Math.random() * 1000 + 1,
        price_change_percentage_24h: (Math.random() - 0.5) * 20,
        price_change_percentage_1h_in_currency: (Math.random() - 0.5) * 10,
        price_change_percentage_7d_in_currency: (Math.random() - 0.5) * 30,
        total_volume: Math.random() * 1000000000,
        market_cap: Math.random() * 10000000000
      }))
      
      // Cache the mock data
      cache.set(cacheKey, {
        data: mockData,
        timestamp: Date.now()
      })
      
      return NextResponse.json(mockData)
    }
    
    const data = await response.json()
    
    // Cache the successful response
    cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    })
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('CoinGecko proxy error:', error)
    
    // Return mock data on error
    const mockIds = ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot']
    const mockData = mockIds.map((id, index) => ({
      id,
      symbol: id.substring(0, 3).toUpperCase(),
      name: id.charAt(0).toUpperCase() + id.slice(1),
      current_price: Math.random() * 1000 + 1,
      price_change_percentage_24h: (Math.random() - 0.5) * 20,
      price_change_percentage_1h_in_currency: (Math.random() - 0.5) * 10,
      price_change_percentage_7d_in_currency: (Math.random() - 0.5) * 30,
      total_volume: Math.random() * 1000000000,
      market_cap: Math.random() * 10000000000
    }))
    
    return NextResponse.json(mockData)
  }
}