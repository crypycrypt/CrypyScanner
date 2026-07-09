import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Use our proxy API to avoid rate limiting
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://your-production-domain.com'
      : 'http://localhost:3000'
    
    const response = await fetch(
      `${baseUrl}/api/coingecko/markets?vs_currency=usd&order=market_cap_desc&per_page=500&page=1&price_change_percentage=24h`
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    // Process data exactly like crypto-scanner's whale-panel.js
    const whales = data.map((coin: any) => {
      const volumeUSD = coin.total_volume || 0
      const marketCap = coin.market_cap || 1
      const volMcRatio = volumeUSD / marketCap
      
      // Determine whale level based on vol/mc ratio
      let whaleLevel = 'Dolphin'
      if (volMcRatio >= 2) whaleLevel = 'Mega Whale'
      else if (volMcRatio >= 1) whaleLevel = 'Whale'
      else if (volMcRatio >= 0.5) whaleLevel = 'Shark'

      // Generate signals based on price action and volume
      const signals: string[] = []
      const priceChange24h = coin.price_change_percentage_24h || 0
      
      if (volMcRatio > 0.2 && priceChange24h > 0) {
        signals.push('Accumulation')
      } else if (volMcRatio > 0.2 && priceChange24h < 0) {
        signals.push('Distribution')
      }
      
      if (volMcRatio > 1) {
        signals.push('Volume Anomaly')
      }
      
      if (priceChange24h > 10) {
        signals.push('Pump')
      } else if (priceChange24h < -10) {
        signals.push('Dump')
      }

      return {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        rank: coin.market_cap_rank,
        priceUSD: coin.current_price,
        priceChange24h: priceChange24h,
        volumeUSD: volumeUSD,
        marketCap: marketCap,
        volMcRatio: volMcRatio,
        image: coin.image,
        lastUpdated: coin.last_updated,
        signals: signals,
        whaleLevel: whaleLevel
      }
    }).filter((whale: any) => whale.volMcRatio > 0.1) // Relax filter to show more whale activity

    // Calculate summary stats exactly like crypto-scanner
    const whaleCount = whales.length
    const megaCount = whales.filter((w: any) => w.volMcRatio >= 2).length
    const totalVolume = whales.reduce((sum: number, w: any) => sum + w.volumeUSD, 0)
    const bullish = whales.filter((w: any) => w.priceChange24h > 0).length
    const bearish = whales.filter((w: any) => w.priceChange24h < 0).length

    return NextResponse.json({
      whales: whales,
      summary: {
        whaleCount,
        megaCount,
        totalVolume,
        bullish,
        bearish
      },
      fetchedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Whale screen API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch whale data' },
      { status: 500 }
    )
  }
}