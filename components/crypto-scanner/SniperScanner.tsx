"use client"
import { useState, useEffect } from 'react'
import { useSniperScanner } from '../../lib/realTimeHooks'

interface SniperCoin {
  symbol: string;
  signal: string;
  price: number;
  ch24h: number;
  score: number;
  rsi: number;
  volRatio: number;
  signals: {
    [key: string]: {
      active: boolean;
      label: string;
    };
  };
}

export default function SniperScanner() {
  const { data, isLoading } = useSniperScanner()
  const [timeframe, setTimeframe] = useState('1h')
  const [topN, setTopN] = useState(100)
  const [lastScan, setLastScan] = useState<Date | null>(null)

  useEffect(() => {
    if (data && data.length > 0) {
      setLastScan(new Date())
    }
  }, [data])

  const coins = (data || []) as SniperCoin[]
  
  // Categorize coins by score
  const snipers = coins.filter(c => c.score >= 80)
  const watches = coins.filter(c => c.score >= 60 && c.score < 80)
  const setups = coins.filter(c => c.score >= 40 && c.score < 60)

  const allToShow = [...snipers, ...watches, ...setups]
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    })
  }

  const formatPrice = (price: number) => {
    if (price < 0.01) return price.toFixed(6)
    if (price < 1) return price.toFixed(4)
    return price.toFixed(2)
  }

  return (
    <div className="space-y-4">
      {/* Header with timeframe selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="font-bold text-lg">Sniper Scanner</h3>
          <p className="text-xs text-slate-400">
            Confluence-based bottom detector · Mencari setup reversal terbaik
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Timeframe selector */}
          <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
            {['15m', '1h', '4h'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  timeframe === tf 
                    ? 'bg-blue-600 text-blue-100' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          
          {/* Top N selector */}
          <select 
            value={topN}
            onChange={(e) => setTopN(parseInt(e.target.value))}
            className="bg-slate-800/50 border border-slate-700 rounded-md px-3 py-1 text-xs text-slate-300"
          >
            <option value={50}>Top 50</option>
            <option value={100}>Top 100</option>
            <option value={200}>Top 200</option>
          </select>
          
          <button 
            onClick={() => window.location.reload()}
            className="px-3 py-1 text-xs rounded-md bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="text-xs text-slate-400">
            📡 Scan selesai {lastScan ? formatTime(lastScan) : '–'} · 
            <b className="text-slate-300 ml-1">{coins.length} coin</b> dipindai
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold">
              🎯 {snipers.length} Sniper
            </span>
            <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold">
              👀 {watches.length} Watch
            </span>
            <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs font-bold">
              📋 {setups.length} Setup
            </span>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-2/3 mb-3"></div>
              <div className="h-3 bg-slate-700 rounded w-1/2 mb-2"></div>
              <div className="h-2 bg-slate-700 rounded w-full mb-4"></div>
              <div className="h-3 bg-slate-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!isLoading && allToShow.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-2">😴</div>
          <p>Belum ada setup yang cukup kuat saat ini.</p>
          <p className="text-xs mt-1">Coba timeframe berbeda atau tunggu kondisi market lebih jelas.</p>
        </div>
      )}

      {!isLoading && allToShow.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allToShow.map((coin) => {
            const isSniper = coin.score >= 80
            const isWatch = coin.score >= 60 && coin.score < 80
            const borderColor = isSniper ? '#f59e0b' : isWatch ? '#3b82f6' : '#8b5cf6'
            const scoreColor = isSniper ? '#f59e0b' : isWatch ? '#3b82f6' : '#8b5cf6'
            const chColor = coin.ch24h >= 0 ? '#10b981' : '#ef4444'
            const scorePct = Math.min(100, coin.score)
            
            const activeSignals = Object.values(coin.signals).filter(s => s.active)
            
            return (
              <div 
                key={coin.symbol}
                className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] hover:border-opacity-100"
                style={{
                  borderLeftColor: borderColor,
                  borderLeftWidth: '3px'
                }}
                onClick={() => {
                  // Open chart functionality would go here
                  console.log('Open chart for:', coin.symbol)
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-white text-lg">{coin.symbol}</div>
                    <div 
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ 
                        background: `${borderColor}22`, 
                        color: borderColor 
                      }}
                    >
                      {coin.signal}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white">${formatPrice(coin.price)}</div>
                    <div className="text-xs" style={{ color: chColor }}>
                      {coin.ch24h >= 0 ? '+' : ''}{coin.ch24h.toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Score bar */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-400">Confluence Score</span>
                    <span className="text-sm font-bold" style={{ color: scoreColor }}>
                      {coin.score}<span className="text-xs text-slate-400">/100</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${scorePct}%`,
                        background: `linear-gradient(90deg, ${scoreColor}88, ${scoreColor})`
                      }}
                    ></div>
                  </div>
                </div>

                {/* Signal badges */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {activeSignals.length > 0 ? (
                    activeSignals.map((signal, i) => (
                      <span 
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ 
                          background: `${scoreColor}22`,
                          color: scoreColor
                        }}
                      >
                        ✓ {signal.label}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">Belum ada sinyal kuat</span>
                  )}
                </div>

                {/* Meta: RSI + Volume */}
                <div className="flex gap-3 pt-3 border-t border-slate-700">
                  <div className="flex-1 text-center">
                    <div className="text-xs text-slate-400">RSI</div>
                    <div 
                      className="text-sm font-bold"
                      style={{
                        color: coin.rsi < 30 ? '#10b981' : coin.rsi > 70 ? '#ef4444' : '#94a3b8'
                      }}
                    >
                      {coin.rsi}
                    </div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="text-xs text-slate-400">Vol Ratio</div>
                    <div 
                      className="text-sm font-bold"
                      style={{
                        color: coin.volRatio >= 2 ? '#f59e0b' : '#94a3b8'
                      }}
                    >
                      {coin.volRatio}x
                    </div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="text-xs text-slate-400">Sinyal</div>
                    <div className="text-sm font-bold text-slate-300">
                      {activeSignals.length}/6
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-blue-400">📊 Chart →</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bottom note */}
      {!isLoading && allToShow.length > 0 && (
        <div className="text-center text-xs text-slate-500 pt-4">
          ℹ️ Score ≥80 = Sniper Zone · ≥60 = Watch · ≥40 = Setup terbentuk · Klik kartu untuk buka chart
        </div>
      )}
    </div>
  )
}
