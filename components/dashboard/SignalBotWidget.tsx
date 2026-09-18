"use client"
import { useState } from 'react'
import { useSignalBotRealTime } from '../../lib/useSignalBotRealTime'
import Skeleton from '../ui/Skeleton'
import CoinIcon from '../ui/CoinIcon'
import Pagination from '../ui/Pagination'
import AnalyzeModal, { CoinAnalyzeData } from '../ui/AnalyzeModal'

const STATUS_TABS = ['ALL', 'LONG', 'SHORT', 'NEUTRAL']
const STATUS_COLOR: Record<string, {bg: string, text: string}> = {
  LONG: {bg: 'rgba(34,197,94,0.15)', text: '#4ade80'},
  SHORT: {bg: 'rgba(239,68,68,0.15)', text: '#f87171'},
  NEUTRAL: {bg: 'rgba(234,179,8,0.15)', text: '#facc15'},
}

const CONFIDENCE_COLORS = {
  high: '#22c55e',
  medium: '#eab308',
  low: '#ef4444'
}

export default function SignalBotWidget() {
  const { data: signals, isLoading } = useSignalBotRealTime()
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [analyzeOpen, setAnalyzeOpen] = useState(false)
  const [analyzeCoin, setAnalyzeCoin] = useState<CoinAnalyzeData | null>(null)
  
  const filtered = (signals ?? []).filter((r: any) => status === 'ALL' || r.signal === status)
  const pageSize = 6
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pagedRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return CONFIDENCE_COLORS.high
    if (confidence >= 60) return CONFIDENCE_COLORS.medium
    return CONFIDENCE_COLORS.low
  }

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'LONG': return '#22c55e'
      case 'SHORT': return '#ef4444'
      default: return '#eab308'
    }
  }

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString()}`
    if (price >= 1) return `$${price.toFixed(2)}`
    if (price >= 0.01) return `$${price.toFixed(4)}`
    return `$${price.toFixed(6)}`
  }

  const calculateProfitPct = (signal: any) => {
    if (!signal.currentPrice || !signal.entryHigh) return 0
    const entryPrice = signal.entryHigh
    const currentPrice = signal.currentPrice
    
    if (signal.signal === 'LONG') {
      return ((currentPrice - entryPrice) / entryPrice) * 100
    } else if (signal.signal === 'SHORT') {
      return ((entryPrice - currentPrice) / entryPrice) * 100
    }
    return 0
  }

  return (
    <div className="card-glass rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Signal Bot</h3>
        <div className="flex gap-1 border border-[rgba(255,255,255,0.1)] rounded-lg p-1">
          {STATUS_TABS.map(tab => (
            <button 
              key={tab}
              onClick={() => setStatus(tab)}
              className="px-3 py-1 text-xs font-medium rounded transition-colors"
              style={{
                backgroundColor: status === tab ? STATUS_COLOR[tab]?.bg || 'rgba(255,255,255,0.1)' : 'transparent',
                color: status === tab ? STATUS_COLOR[tab]?.text || 'white' : '#94a3b8'
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <Skeleton className="h-48 w-full rounded" />}
      
      {!isLoading && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No signal bot activities found
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.05)] text-xs text-slate-400">
                      <th className="text-left px-3 py-2">Coin</th>
                      <th className="text-left px-3 py-2">Signal</th>
                      <th className="text-left px-3 py-2">Confidence</th>
                      <th className="text-right px-3 py-2">Current Price</th>
                      <th className="text-right px-3 py-2">Entry Range</th>
                      <th className="text-right px-3 py-2">Stop Loss</th>
                      <th className="text-right px-3 py-2">Targets</th>
                      <th className="text-right px-3 py-2">Profit</th>
                      <th className="text-center px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((signal: any, i: number) => {
                      const profitPct = calculateProfitPct(signal)
                      return (
                        <tr key={signal.coinId} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <CoinIcon symbol={signal.coinSymbol} size={24} image={signal.image} />
                              <div>
                                <div className="font-medium">{signal.coinSymbol.toUpperCase()}</div>
                                <div className="text-xs text-slate-400">{signal.coinName}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              signal.signal === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' :
                              signal.signal === 'SHORT' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {signal.signal}
                            </span>
                            <div className="text-xs text-slate-400 mt-1">{signal.signalReason}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-[rgba(255,255,255,0.1)] rounded-full h-2">
                                <div 
                                  className="h-2 rounded-full transition-all"
                                  style={{
                                    width: `${signal.confidence}%`,
                                    backgroundColor: getConfidenceColor(signal.confidence)
                                  }}
                                />
                              </div>
                              <span className="text-xs font-medium" style={{color: getConfidenceColor(signal.confidence)}}>
                                {signal.confidence}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="font-medium">{formatPrice(signal.currentPrice)}</div>
                            <div className="text-xs" style={{color: signal.priceChange24h >= 0 ? '#22c55e' : '#ef4444'}}>
                              {signal.priceChange24h >= 0 ? '+' : ''}{signal.priceChange24h.toFixed(2)}%
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="text-xs text-slate-400">Entry:</div>
                            <div className="font-medium text-sm">
                              {formatPrice(signal.entryLow)} - {formatPrice(signal.entryHigh)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="text-xs text-slate-400">SL:</div>
                            <div className="font-medium text-sm">{formatPrice(signal.stopLoss)}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="text-xs text-slate-400">TP:</div>
                            <div className="font-medium text-sm">
                              {formatPrice(signal.tp1)} / {formatPrice(signal.tp2)} / {formatPrice(signal.tp3)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className={`font-medium text-sm ${
                              profitPct > 0 ? 'text-emerald-400' : 
                              profitPct < 0 ? 'text-red-400' : 'text-slate-400'
                            }`}>
                              {profitPct ? `${profitPct > 0 ? '+' : ''}${profitPct.toFixed(2)}%` : 'N/A'}
                            </div>
                            <div className="text-xs text-slate-400">R:R {signal.rr}</div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button 
                              onClick={() => {
                                setAnalyzeCoin({
                                  symbol: signal.coinSymbol,
                                  name: signal.coinName,
                                  price: formatPrice(signal.currentPrice),
                                  h1: signal.priceChange24h,
                                  h24: signal.priceChange24h,
                                  d7: 0
                                })
                                setAnalyzeOpen(true)
                              }}
                              className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                            >
                              Analyze
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              
              {totalPages > 1 && (
                <div className="mt-4 flex justify-center">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      <AnalyzeModal 
        open={analyzeOpen} 
        onClose={() => setAnalyzeOpen(false)} 
        coin={analyzeCoin} 
      />
    </div>
  )
}