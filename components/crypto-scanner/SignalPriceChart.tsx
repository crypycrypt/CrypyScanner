'use client'

import { useEffect, useRef } from 'react'

interface SignalPriceChartProps {
  symbol: string
}

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => unknown
    }
  }
}

const TV_SYMBOL_MAP: Record<string, string> = {
  BTC: 'BINANCE:BTCUSDT',
  ETH: 'BINANCE:ETHUSDT',
  BNB: 'BINANCE:BNBUSDT',
  SOL: 'BINANCE:SOLUSDT',
  XRP: 'BINANCE:XRPUSDT',
  ADA: 'BINANCE:ADAUSDT',
  DOGE: 'BINANCE:DOGEUSDT',
  MATIC: 'BINANCE:MATICUSDT',
  POL: 'BINANCE:POLUSDT',
  AVAX: 'BINANCE:AVAXUSDT',
  DOT: 'BINANCE:DOTUSDT',
  LINK: 'BINANCE:LINKUSDT',
  LTC: 'BINANCE:LTCUSDT',
  BCH: 'BINANCE:BCHUSDT',
  ARB: 'BINANCE:ARBUSDT',
  OP: 'BINANCE:OPUSDT',
  APT: 'BINANCE:APTUSDT',
  SUI: 'BINANCE:SUIUSDT',
  TON: 'BINANCE:TONUSDT',
  PEPE: 'BINANCE:PEPEUSDT',
  WIF: 'BINANCE:WIFUSDT',
  SHIB: 'BINANCE:SHIBUSDT',
  TRX: 'BINANCE:TRXUSDT',
}

function buildTVSymbol(symbol: string): string {
  const key = symbol.toUpperCase().replace(/USDT$/, '').replace(/USDC$/, '')
  return TV_SYMBOL_MAP[key] || `BINANCE:${key}USDT`
}

let tvScriptPromise: Promise<void> | null = null

function loadTradingView(): Promise<void> {
  if (window.TradingView) return Promise.resolve()
  if (tvScriptPromise) return tvScriptPromise

  tvScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src*="s3.tradingview.com/tv.js"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('TradingView script failed')))
      return
    }

    const s = document.createElement('script')
    s.src = 'https://s3.tradingview.com/tv.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('TradingView script failed'))
    document.head.appendChild(s)
  })

  return tvScriptPromise
}

export default function SignalPriceChart({ symbol }: SignalPriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<unknown>(null)
  const tvSymbol = buildTVSymbol(symbol)

  useEffect(() => {
    let cancelled = false

    loadTradingView()
      .then(() => {
        if (cancelled || !containerRef.current) return
        if (!window.TradingView) return

        // Remove any previously attached widget child nodes (e.g. hot-swap)
        containerRef.current.innerHTML = ''
        const inner = document.createElement('div')
        inner.id = `tv-chart-${symbol.toLowerCase().replace(/[^a-z0-9]/g, '')}`
        inner.style.height = '100%'
        inner.style.width = '100%'
        containerRef.current.appendChild(inner)

        widgetRef.current = new window.TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: '60',
          timezone: 'Asia/Jakarta',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#0d1117',
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          studies: ['RSI@tv-basicstudies', 'MACD@tv-basicstudies', 'BB@tv-basicstudies'],
          container_id: inner.id,
        })
      })
      .catch(() => {
        // Silent — chart area simply stays empty if the CDN is unreachable
      })

    return () => {
      cancelled = true
      // TradingView widget has no formal destroy; remove DOM + reference
      if (containerRef.current) containerRef.current.innerHTML = ''
      widgetRef.current = null
    }
  }, [symbol, tvSymbol])

  return (
    <div className="nx-chart-wrap">
      <div className="nx-ph">
        <div className="nx-pt">EXPERT CHART · {tvSymbol}</div>
        <div className="nx-meta">TRADINGVIEW · DARK · CANDLES + BB + RSI + MACD — REAL-TIME DATA</div>
      </div>
      <div ref={containerRef} className="nx-chart-pane nx-chart-pane--tv" />
    </div>
  )
}
