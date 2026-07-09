import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Use our proxy API to avoid rate limiting
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://your-production-domain.com'
      : 'http://localhost:3000'
    
    const response = await fetch(
      `${baseUrl}/api/coingecko/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&price_change_percentage=24h`
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    // Process data exactly like crypto-scanner's whale-accumulation.js
    const tokens = data.map((coin: any) => {
      const price = coin.current_price || 0
      const ch24h = coin.price_change_percentage_24h || 0
      const volume = coin.total_volume || 0
      const marketCap = coin.market_cap || 1
      const volMcRatio = volume / marketCap
      
      // Calculate whale score (0-10) based on multiple factors
      let score = 0
      
      // Volume/MC ratio factor (max 4 points)
      if (volMcRatio > 2) score += 4
      else if (volMcRatio > 1) score += 3
      else if (volMcRatio > 0.5) score += 2
      else if (volMcRatio > 0.25) score += 1
      
      // Price action factor (max 3 points)
      if (ch24h < -5 && ch24h > -15) score += 3 // Healthy dip
      else if (ch24h < -15) score += 1 // Too deep
      else if (ch24h > 0 && ch24h < 5) score += 2 // Mild uptrend
      
      // Market cap factor (max 3 points)
      if (marketCap < 100000000) score += 3 // Small cap = more whale impact
      else if (marketCap < 1000000000) score += 2 // Mid cap
      else if (marketCap < 10000000000) score += 1 // Large cap
      
      // Generate signals exactly like crypto-scanner
      const signals: string[] = []
      let stealthAccumulation = false
      let absorptionAtSupport = false
      let volumeAnomaly = false
      let nearSupport = false
      
      if (volMcRatio > 1 && Math.abs(ch24h) < 3) {
        signals.push('Stealth Accumulation')
        stealthAccumulation = true
      }
      
      if (ch24h < -5 && volMcRatio > 0.5) {
        signals.push('Absorption at Support')
        absorptionAtSupport = true
      }
      
      if (volMcRatio > 2) {
        signals.push('Volume Anomaly')
        volumeAnomaly = true
      }
      
      if (ch24h < -8 && ch24h > -20) {
        signals.push('Near Support')
        nearSupport = true
      }
      
      // Determine type based on score
      const type = score >= 6 ? 'ACCUMULATING' : 'WATCHING'
      
      return {
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: price,
        ch24h: ch24h,
        volume: volume,
        marketCap: marketCap,
        volMcRatio: volMcRatio,
        image: coin.image,
        score: Math.min(10, score),
        signals: signals,
        stealthAccumulation,
        absorptionAtSupport,
        volumeAnomaly,
        nearSupport,
        type,
        ecoEmoji: '🪙',
        ecoName: 'Crypto'
      }
    }).filter((token: any) => token.score >= 3) // Only show tokens with significant whale activity
    
    // Sort by score descending
    tokens.sort((a: any, b: any) => b.score - a.score)

    return NextResponse.json({
      tokens: tokens.slice(0, 50), // Limit to top 50
      fetchedAt: new Date().toISOString(),
      total: tokens.length
    })

  } catch (error) {
    console.error('Whale accumulation API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch whale accumulation data' },
      { status: 500 }
    )
  }
}