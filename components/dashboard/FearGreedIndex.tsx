"use client"
import { useState, useEffect } from 'react'

interface FearGreedData {
  fng: {
    value: number;
    value_classification: string;
    timestamp: string;
  };
  global: {
    total_market_cap: { usd: number };
    total_volume: { usd: number };
    market_cap_percentage: { btc: number; eth: number };
    market_cap_change_percentage_24h_usd: number;
  };
  prices: {
    btc: number;
    eth: number;
  };
  dxy: number;
  us10y: number;
}

const FNG_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Extreme Fear', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  1: { label: 'Fear', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  2: { label: 'Neutral', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  3: { label: 'Greed', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  4: { label: 'Extreme Greed', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }
}

export default function FearGreedIndex() {
  const [data, setData] = useState<FearGreedData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      // Real data from /api/market/overview (CoinGecko global + Alternative.me Fear&Greed)
      const res = await fetch('/api/market/overview', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const m = await res.json()

      const realData: FearGreedData = {
        fng: {
          value: typeof m.fng === 'number' ? m.fng : 0,
          value_classification: m.fngLabel || 'N/A',
          timestamp: new Date().toISOString()
        },
        global: {
          total_market_cap: { usd: m.totalMcap || 0 },
          total_volume: { usd: m.totalVolume || 0 },
          market_cap_percentage: { btc: m.btcDominance || 0, eth: m.ethDominance || 0 },
          market_cap_change_percentage_24h_usd: 0
        },
        prices: {
          btc: m.btc?.price || 0,
          eth: m.eth?.price || 0
        },
        dxy: 0,
        us10y: 0
      }

      setData(realData)
    } catch (error) {
      console.error('Error fetching Fear & Greed data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getFngLevel = (value: number) => {
    if (value <= 20) return 0
    if (value <= 40) return 1
    if (value <= 60) return 2
    if (value <= 80) return 3
    return 4
  }

  const fmtB = (n: number) => {
    if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    return n.toFixed(0)
  }

  const fmtK = (n: number) => {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
    return n.toFixed(0)
  }

  const fmtPct = (n: number, decimals = 2) => {
    return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`
  }

  const chgArrow = (n: number) => {
    return n >= 0 ? '↗' : '↘'
  }

  if (isLoading) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-slate-700 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-slate-700 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-center text-slate-500">
        ❌ Gagal memuat data Fear & Greed Index
      </div>
    )
  }

  const fngLevel = getFngLevel(data.fng.value)
  const fngInfo = FNG_LABELS[fngLevel]

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg">Indeks Ketakutan & Keserakahan</h3>
          <p className="text-xs text-slate-400">
            Sentimen pasar crypto global
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color: fngInfo.color }}>
            {data.fng.value}
          </div>
          <div className="text-xs" style={{ color: fngInfo.color }}>
            {fngInfo.label}
          </div>
        </div>
      </div>

      {/* Fear & Greed Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Extreme Fear</span>
          <span>Neutral</span>
          <span>Extreme Greed</span>
        </div>
        <div className="h-3 bg-gradient-to-r from-red-500 via-orange-400 via-yellow-400 via-green-400 to-emerald-500 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white/20 rounded-full transition-all duration-500"
            style={{ width: `${data.fng.value}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>

      {/* Market Overview */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Total Market Cap */}
        <div className="bg-slate-800/30 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">Total Market Cap</div>
          <div className="font-bold text-white">${fmtB(data.global.total_market_cap.usd)}</div>
          <div className="text-xs" style={{ color: data.global.market_cap_change_percentage_24h_usd >= 0 ? '#10b981' : '#ef4444' }}>
            {chgArrow(data.global.market_cap_change_percentage_24h_usd)} {fmtPct(data.global.market_cap_change_percentage_24h_usd)}
          </div>
        </div>

        {/* 24h Volume */}
        <div className="bg-slate-800/30 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">24h Volume</div>
          <div className="font-bold text-white">${fmtB(data.global.total_volume.usd)}</div>
          <div className="text-xs text-slate-500">Global</div>
        </div>

        {/* BTC Dominance */}
        <div className="bg-slate-800/30 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">BTC Dominance</div>
          <div className="font-bold text-white">{data.global.market_cap_percentage.btc.toFixed(1)}%</div>
          <div className="text-xs text-slate-500">Market Share</div>
        </div>

        {/* ETH Dominance */}
        <div className="bg-slate-800/30 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">ETH Dominance</div>
          <div className="font-bold text-white">{data.global.market_cap_percentage.eth.toFixed(1)}%</div>
          <div className="text-xs text-slate-500">Market Share</div>
        </div>
      </div>

      {/* Macro Indicators */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="text-xs text-slate-400 mb-2">Indikator Makro</div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="text-center">
            <div className="font-semibold">BTC</div>
            <div className="text-slate-300">${fmtK(data.prices.btc)}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">ETH</div>
            <div className="text-slate-300">${fmtK(data.prices.eth)}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">DXY</div>
            <div className="text-slate-300">{data.dxy.toFixed(1)}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">US 10Y</div>
            <div className="text-slate-300">{data.us10y.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="mt-4 text-xs text-slate-500 text-center">
        Terakhir diperbarui: {new Date(data.fng.timestamp).toLocaleTimeString('id-ID')}
      </div>
    </div>
  )
}