import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Real BTC direction data source.
 * Fetches hourly BTCUSDT klines from Binance public API and returns the
 * close-price series for client-side MA/EMA/RSI/support-resistance rendering.
 * No hardcoded / fake price data.
 */
const BINANCE_KLINES = 'https://api.binance.com/api/v3/klines'

export async function GET() {
  try {
    const url = new URL(BINANCE_KLINES)
    url.searchParams.set('symbol', 'BTCUSDT')
    url.searchParams.set('interval', '1h')
    url.searchParams.set('limit', '100')

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`)

    const candles: any[] = await res.json()
    if (!Array.isArray(candles) || candles.length < 40) {
      throw new Error('Insufficient kline data')
    }

    const closes = candles.map((c) => parseFloat(c[4]))
    const currentPrice = closes[closes.length - 1] || 0
    const prevPrice = closes.length > 1 ? closes[closes.length - 2] || currentPrice : currentPrice

    return NextResponse.json({
      ok: true,
      symbol: 'BTCUSDT',
      interval: '1h',
      currentPrice,
      changePct: prevPrice ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0,
      closes,
      time: Date.now(),
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to fetch BTC direction data' },
      { status: 502 }
    )
  }
}