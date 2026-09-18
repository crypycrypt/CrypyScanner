"use client"

import { useState } from 'react'
import { useTopCoinsForFutures } from '../../lib/useFuturesAnalysis'
import { getFuturesAnalysis } from '../crypto-scanner/FuturesAnalysis'

interface Badge {
  label: string
  hint: string
  color: string
  bg: string
}

function fmtPrice(n: number): string {
  if (!n || !Number.isFinite(n)) return '—'
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

// Replica of reference getTradingSignal() — actionable signal badge per coin
function getTradingSignal(coin: any): Badge {
  const price = coin.current_price || 0
  const ch24h = coin.price_change_percentage_24h || 0
  const ch7d = coin.price_change_percentage_7d_in_currency || 0
  const prices = coin.sparkline_in_7d?.price || []
  const volRatio = coin.market_cap ? coin.total_volume / coin.market_cap : 0

  let support: number | null = null
  let resistance: number | null = null
  if (prices.length >= 10) {
    const sorted = [...prices].sort((a, b) => a - b)
    support = sorted[Math.floor(sorted.length * 0.1)]
    resistance = sorted[Math.floor(sorted.length * 0.9)]
  }

  const low7d = prices.length ? Math.min(...prices) : price * 0.85
  const high7d = prices.length ? Math.max(...prices) : price * 1.15
  const range = high7d - low7d || 1
  const posInRange = (price - low7d) / range

  const nearSupport = posInRange < 0.2
  const nearResistance = posInRange > 0.8
  const midZone = posInRange >= 0.35 && posInRange <= 0.65

  const strongBull = ch24h > 5 && ch7d > 10 && volRatio > 0.1
  const mildBull = ch24h > 0 && ch7d > 0
  const strongBear = ch24h < -5 && ch7d < -10
  const highRisk = volRatio > 0.5 || Math.abs(ch24h) > 15

  const fmt = fmtPrice

  if (highRisk && ch24h < -10) {
    return { label: '⚠️ Risiko Tinggi', hint: 'Volatilitas ekstrem, hindari entry', color: '#f87171', bg: 'rgba(239,68,68,0.15)' }
  }

  if (strongBull && nearSupport) {
    const tp = fmt(support ? support * 1.15 : price * 1.12)
    const sl = fmt(support ? support * 0.96 : price * 0.95)
    return { label: `🟢 Beli di ${fmt(price)}`, hint: `TP ${tp} · SL ${sl}`, color: '#4ade80', bg: 'rgba(34,197,94,0.15)' }
  }

  if (mildBull && nearSupport && !highRisk) {
    const tp = fmt(price * 1.08)
    return { label: `🟢 Beli di ${fmt(price)}`, hint: `TP ${tp} · konfirmasi volume`, color: '#4ade80', bg: 'rgba(34,197,94,0.15)' }
  }

  if (nearResistance && mildBull) {
    const waitPrice = fmt(resistance ? resistance * 0.92 : price * 0.92)
    return { label: '⏳ Tunggu pullback', hint: `Entry ideal ≈ ${waitPrice}`, color: '#facc15', bg: 'rgba(234,179,8,0.15)' }
  }

  if (midZone && ch24h > 0 && ch24h < 3) {
    const entryIdeal = fmt(support ? support * 1.01 : price * 0.96)
    return { label: `⏳ Tunggu di ${entryIdeal}`, hint: 'Belum ada konfirmasi breakout', color: '#facc15', bg: 'rgba(234,179,8,0.15)' }
  }

  if (nearResistance && (strongBear || ch24h < -3)) {
    const sl = fmt(resistance ? resistance * 1.03 : price * 1.03)
    return { label: '🔴 Jual / Hindari', hint: `Resistensi kuat, SL ${sl}`, color: '#f87171', bg: 'rgba(239,68,68,0.15)' }
  }

  if (strongBear) {
    const reboundZone = fmt(low7d * 1.05)
    return { label: '🔴 Distribusi', hint: `Tunggu rebound ≈ ${reboundZone}`, color: '#f87171', bg: 'rgba(239,68,68,0.15)' }
  }

  if (mildBull && midZone) {
    const tp = fmt(resistance || price * 1.08)
    return { label: '🔵 Hold', hint: `Target ${tp}, tahan posisi`, color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' }
  }

  if (ch24h < -3) {
    const waitEntry = fmt(low7d * 1.02)
    return { label: '⏳ Tunggu sinyal', hint: `Entry aman ≈ ${waitEntry}`, color: '#facc15', bg: 'rgba(234,179,8,0.15)' }
  }

  return { label: '🔵 Netral', hint: 'Pantau pergerakan volume', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' }
}

// Replica of reference getWhaleActivityStatus() — Accumulation/Distribution/Neutral
function getWhaleStatus(coin: any): Badge {
  const change24h = coin.price_change_percentage_24h || 0
  const ratio = coin.market_cap ? coin.total_volume / coin.market_cap : 0
  if (ratio > 0.2 && change24h > 0) return { label: '🟢 Accumulation', hint: 'Vol/MC tinggi + naik', color: '#4ade80', bg: 'rgba(34,197,94,0.15)' }
  if (ratio > 0.2 && change24h < 0) return { label: '🔴 Distribution', hint: 'Vol/MC tinggi + turun', color: '#f87171', bg: 'rgba(239,68,68,0.15)' }
  return { label: '🟡 Neutral', hint: 'Volume normal', color: '#facc15', bg: 'rgba(234,179,8,0.15)' }
}

// Futures recommendation: explicit LONG / SHORT decision with leverage
function getFuturesRecommendation(coin: any): Badge {
  const f = getFuturesAnalysis(coin)
  if (f.isNeutral) {
    return { label: '⚪ Hindari Futures', hint: 'Tunggu konfirmasi breakout', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' }
  }
  const isLong = f.direction.startsWith('long')
  const weak = f.direction.includes('weak') ? ' (Lemah)' : ''
  const label = isLong ? '🟢 Ambil LONG' : '🔴 Ambil SHORT'
  return {
    label: label + weak,
    hint: `Leverage ${f.leverage}×`,
    color: isLong ? '#4ade80' : '#f87171',
    bg: isLong ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'
  }
}

function BadgeCell({ badge }: { badge: Badge }) {
  return (
    <div className="inline-flex flex-col items-start gap-0.5" style={{ color: badge.color }}>
      <span className="text-xs font-semibold px-2 py-0.5 rounded-md border" style={{ backgroundColor: badge.bg, borderColor: badge.color + '40' }}>
        {badge.label}
      </span>
      <span className="text-[10px] text-slate-400 leading-tight">{badge.hint}</span>
    </div>
  )
}

export default function LiveMarketIndicators() {
  const { data: coins, isLoading, error } = useTopCoinsForFutures()
  const [limit, setLimit] = useState(15)

  return (
    <div className="card-glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">📊 Live Market Indicators</h3>
        <div className="flex gap-2">
          {[10, 15, 25].map(n => (
            <button
              key={n}
              onClick={() => setLimit(n)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${limit === n ? 'bg-[#3b82f6] text-white' : 'bg-[rgba(255,255,255,0.05)] text-slate-300 hover:bg-[rgba(255,255,255,0.1)]'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#3b82f6] mr-2"></div>
          Memuat data market...
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-40 text-red-400">
          Gagal memuat data market. Coba lagi nanti.
        </div>
      )}

      {!isLoading && !error && coins && (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.05)] text-xs text-slate-400 uppercase tracking-wider">
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">Token</th>
                <th className="text-right px-3 py-2">Price</th>
                <th className="text-right px-3 py-2">24H%</th>
                <th className="text-left px-3 py-2">Signal</th>
                <th className="text-left px-3 py-2">⚡ Futures</th>
                <th className="text-left px-3 py-2">Whale</th>
              </tr>
            </thead>
            <tbody>
              {coins.slice(0, limit).map((coin: any, i: number) => {
                const signal = getTradingSignal(coin)
                const futures = getFuturesRecommendation(coin)
                const whale = getWhaleStatus(coin)
                return (
                  <tr key={coin.id} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="px-3 py-2.5 text-slate-500">#{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <img
                          src={coin.image}
                          alt={coin.symbol}
                          className="w-6 h-6 rounded-full"
                          onError={(e) => {
                            const t = e.target as HTMLImageElement
                            t.style.display = 'none'
                          }}
                        />
                        <div>
                          <div className="font-medium text-slate-100">{coin.symbol?.toUpperCase()}</div>
                          <div className="text-[10px] text-slate-500 max-w-[110px] truncate">{coin.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-100">${coin.current_price?.toLocaleString()}</td>
                    <td className={`px-3 py-2.5 text-right ${coin.price_change_percentage_24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {coin.price_change_percentage_24h >= 0 ? '+' : ''}{coin.price_change_percentage_24h?.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5"><BadgeCell badge={signal} /></td>
                    <td className="px-3 py-2.5"><BadgeCell badge={futures} /></td>
                    <td className="px-3 py-2.5"><BadgeCell badge={whale} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
