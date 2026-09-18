import { NextResponse } from 'next/server'

type SignalMap = Record<string, { active: boolean; score: number; label: string }>

async function getSniperPairs(topN = 100) {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    const data = await response.json()

    if (!Array.isArray(data)) throw new Error('Invalid Binance ticker response')

    return data
      .filter((ticker: any) =>
        ticker.symbol.endsWith('USDT') &&
        !ticker.symbol.includes('DOWN') &&
        !ticker.symbol.includes('UP') &&
        !ticker.symbol.includes('BEAR') &&
        !ticker.symbol.includes('BULL') &&
        parseFloat(ticker.quoteVolume) > 500_000
      )
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, topN)
      .map((ticker: any) => ticker.symbol.replace('USDT', ''))
  } catch (error: any) {
    console.warn('[Sniper] Gagal fetch pairs dari Binance:', error?.message ?? error)
    return ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'AVAX', 'ADA', 'LINK', 'DOGE', 'OP', 'ARB', 'SUI', 'NEAR', 'APT']
  }
}

function calcRSI(closes: number[], period = 14) {
  if (closes.length < period + 1) return 50

  let gains = 0
  let losses = 0

  for (let i = closes.length - period; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1]
    if (delta >= 0) gains += delta
    else losses -= delta
  }

  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100

  return 100 - 100 / (1 + avgGain / avgLoss)
}

function analyzeSniper(candles: any[]) {
  if (!candles || candles.length < 30) return null

  const last = candles.length - 1
  const opens = candles.map(c => parseFloat(c[1]))
  const highs = candles.map(c => parseFloat(c[2]))
  const lows = candles.map(c => parseFloat(c[3]))
  const closes = candles.map(c => parseFloat(c[4]))
  const volumes = candles.map(c => parseFloat(c[5]))

  const price = closes[last]
  const ch24hBaseIndex = Math.max(0, last - 24)
  const ch24h = closes[ch24hBaseIndex] ? (price - closes[ch24hBaseIndex]) / closes[ch24hBaseIndex] * 100 : 0

  const recentLow = Math.min(...lows.slice(last - 20, last - 1))
  const sweepCandle = lows[last] < recentLow && closes[last] > recentLow
  const sweepScore = sweepCandle ? 25 : 0

  const avgVol = volumes.slice(last - 20, last).reduce((sum, volume) => sum + volume, 0) / 20
  const volRatio = volumes[last] / (avgVol || 1)
  const volScore = volRatio >= 2.5 ? 20 : volRatio >= 1.8 ? 12 : volRatio >= 1.3 ? 6 : 0

  const body = Math.abs(closes[last] - opens[last])
  const lowerWick = Math.min(opens[last], closes[last]) - lows[last]
  const bullCandle = closes[last] > opens[last] && lowerWick >= 1.5 * body
  const engulf = closes[last] > opens[last - 1] && opens[last] < closes[last - 1]
  const candleScore = bullCandle || engulf ? 15 : 0

  const prev5High = Math.max(...highs.slice(last - 6, last - 1))
  const bosUp = closes[last] > prev5High
  const bosScore = bosUp ? 20 : 0

  let fvgScore = 0
  for (let i = last - 5; i <= last - 1; i++) {
    if (i < 2) continue
    const fvgLow = highs[i - 2]
    const fvgHigh = lows[i]
    if (fvgHigh > fvgLow && price >= fvgLow && price <= fvgHigh + (fvgHigh - fvgLow) * 2) {
      fvgScore = 10
      break
    }
  }

  const rsiNow = calcRSI(closes.slice(0, last + 1))
  const rsiPrev = calcRSI(closes.slice(0, last - 5))
  const priceMakesLowerLow = closes[last] < Math.min(...closes.slice(last - 10, last - 1))
  const rsiDivergence = priceMakesLowerLow && rsiNow > rsiPrev + 3
  const rsiScore = (rsiNow < 35 ? 6 : 0) + (rsiDivergence ? 4 : 0)

  const score = sweepScore + volScore + candleScore + bosScore + fvgScore + rsiScore

  let signal = 'WAIT'
  let signalColor = '#94a3b8'
  if (score >= 80) { signal = '🎯 SNIPER'; signalColor = '#f59e0b' }
  else if (score >= 60) { signal = '👀 WATCH'; signalColor = '#3b82f6' }
  else if (score >= 40) { signal = '📋 SETUP'; signalColor = '#8b5cf6' }

  const signals: SignalMap = {
    sweep: { active: sweepScore > 0, score: sweepScore, label: 'Liquidity Sweep' },
    volume: { active: volScore > 0, score: volScore, label: `Volume Spike ${volRatio.toFixed(1)}x` },
    candle: { active: candleScore > 0, score: candleScore, label: bullCandle ? 'Hammer' : 'Bullish Engulfing' },
    bos: { active: bosScore > 0, score: bosScore, label: 'BOS ke Atas' },
    fvg: { active: fvgScore > 0, score: fvgScore, label: 'Di Area FVG/Demand' },
    rsi: { active: rsiScore > 0, score: rsiScore, label: `RSI ${rsiNow.toFixed(0)}${rsiDivergence ? ' + Divergence' : ''}` },
  }

  const candlesOut = candles.map((c) => ({
    time: Math.floor(c[0] / 1000),
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }))

  return {
    score,
    signal,
    signalColor,
    price,
    ch24h: +ch24h.toFixed(2),
    rsi: +rsiNow.toFixed(1),
    volRatio: +volRatio.toFixed(2),
    signals,
    closes,
    candles: candlesOut,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tf = searchParams.get('tf') || '1h'
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200)
  const validTf = ['15m', '1h', '4h'].includes(tf) ? tf : '1h'
  const klineLimit = validTf === '4h' ? 60 : 50

  try {
    const pairs = await getSniperPairs(limit)
    const batchSize = 20
    let allResults: any[] = []

    for (let i = 0; i < pairs.length; i += batchSize) {
      const batch = pairs.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(async (symbol: string) => {
          const url = new URL('https://api.binance.com/api/v3/klines')
          url.searchParams.set('symbol', `${symbol}USDT`)
          url.searchParams.set('interval', validTf)
          url.searchParams.set('limit', String(klineLimit))

          const response = await fetch(url.toString(), {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(12_000),
          })
          const candles = await response.json()
          if (!Array.isArray(candles)) return null

          const analysis = analyzeSniper(candles)
          if (!analysis) return null

          return { symbol, ...analysis }
        })
      )

      allResults = allResults.concat(batchResults)
      if (i + batchSize < pairs.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    const coins = allResults
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => result.value)
      .sort((a, b) => b.score - a.score)

    return NextResponse.json({
      ok: true,
      coins,
      tf: validTf,
      timeframe: validTf,
      scannedAt: Date.now(),
      totalScanned: pairs.length,
      limit,
    })
  } catch (error: any) {
    console.error('Sniper scan error:', error)
    return NextResponse.json({ ok: false, error: error?.message || 'Failed to scan sniper setups' }, { status: 500 })
  }
}
