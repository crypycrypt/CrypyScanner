"use client"

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTopCoinsForFutures } from '../../lib/useFuturesAnalysis'
import { getFuturesAnalysis } from '../crypto-scanner/FuturesAnalysis'

interface SignalBadge {
  label: string
  hint: string
  color: string
  bg: string
}

function fmtBadgePrice(n: number): string {
  if (!n || !Number.isFinite(n)) return '—'
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

// Replica of the former LiveMarketIndicators.getTradingSignal() — actionable signal badge per coin
function getTradingSignal(coin: any): SignalBadge {
  const price = coin.current_price || 0
  const ch24h = coin.price_change_percentage_24h || 0
  const ch7d = coin.price_change_percentage_7d_in_currency || 0
  const prices = coin.sparkline_in_7d?.price || []
  const volRatio = coin.market_cap ? coin.total_volume / coin.market_cap : 0

  let support: number | null = null
  let resistance: number | null = null
  if (prices.length >= 10) {
    const sorted = [...prices].sort((a: number, b: number) => a - b)
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

  const fmt = fmtBadgePrice

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

// Futures recommendation: explicit LONG / SHORT decision with leverage
function getFuturesRecommendation(coin: any): SignalBadge {
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

function SignalBadgeCell({ badge }: { badge: SignalBadge }) {
  return (
    <div className="inline-flex flex-col items-start gap-0.5" style={{ color: badge.color }}>
      <span className="text-xs font-semibold px-2 py-0.5 rounded-md border" style={{ backgroundColor: badge.bg, borderColor: badge.color + '40' }}>
        {badge.label}
      </span>
      <span className="text-[10px] text-slate-400 leading-tight">{badge.hint}</span>
    </div>
  )
}

interface WhaleData {
  id: string
  symbol: string
  name: string
  priceUSD: number
  priceChange24h: number
  priceChange7d?: number
  volumeUSD: number
  marketCap: number
  volMcRatio: number
  signals: string[]
  rank: number
  image: string
  lastUpdated: string
}

interface WhalePanelData {
  whales: WhaleData[]
  summary?: {
    whaleCount: number
    megaCount: number
    totalVolume: number
    bullish: number
    bearish: number
  }
  fetchedAt: string
}

// Volume-based threshold filter options (matching crypto-scanner whale-panel.js)
const THRESHOLDS = [
  { label: 'Semua', value: 0 },
  { label: '>$1M', value: 1e6 },
  { label: '>$5M', value: 5e6 },
  { label: '>$10M', value: 1e7 },
  { label: '>$50M', value: 5e7 },
  { label: '>$100M', value: 1e8 },
]

function fmtUSD(v: number): string {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K'
  return '$' + v.toFixed(0)
}

function fmtPrice(p: number): string {
  if (!p && p !== 0) return '$—'
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (p >= 1) return '$' + p.toFixed(3)
  if (p >= 0.001) return '$' + p.toFixed(5)
  return '$' + p.toFixed(8)
}

function timeAgo(isoTs: string): string {
  if (!isoTs) return ''
  const diff = (Date.now() - new Date(isoTs).getTime()) / 1000
  if (diff < 60) return Math.floor(diff) + 'd lalu'
  if (diff < 3600) return Math.floor(diff / 60) + 'm lalu'
  if (diff < 86400) return Math.floor(diff / 3600) + 'j lalu'
  return Math.floor(diff / 86400) + ' hari lalu'
}

// Whale level badge (matching crypto-scanner whale-panel.js)
function whaleBadge(ratio: number) {
  if (ratio >= 2) return { label: '🐳 Mega Whale', bg: '#7f1d1d', color: '#fca5a5' }
  if (ratio >= 1) return { label: '🐋 Whale', bg: '#1e1b4b', color: '#a5b4fc' }
  if (ratio >= 0.5) return { label: '🦈 Shark', bg: '#172554', color: '#93c5fd' }
  return { label: '🐬 Dolphin', bg: '#164e63', color: '#67e8f9' }
}

function colorCh(v: number): string {
  return v > 0 ? '#22c55e' : v < 0 ? '#ef4444' : '#94a3b8'
}

export default function WhaleActivityMonitor() {
  const [filterMin, setFilterMin] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  const { data, isLoading, error, refetch } = useQuery<WhalePanelData>({
    queryKey: ['whale-activity'],
    queryFn: async () => {
      const res = await fetch('/api/whale-screen')
      if (!res.ok) throw new Error('Failed to fetch whale data')
      return res.json()
    },
    refetchInterval: 3 * 60 * 1000, // 3 minutes (matching crypto-scanner)
    staleTime: 2 * 60 * 1000,
  })

  // Signal/Futures badges — merged in from the former standalone "Live Market
  // Indicators" section. Keyed by CoinGecko id so each whale row can look up
  // its matching sparkline-based coin data (only covers the top-50 by market cap).
  const { data: signalCoins } = useTopCoinsForFutures()
  const signalCoinMap = new Map<string, any>((signalCoins || []).map((c: any) => [c.id, c]))

  useEffect(() => {
    if (data?.whales) {
      console.log('Whale data loaded:', data.whales.length)
    }
  }, [data])

  // Use summary from API if available, otherwise compute from whales
  const whales = data?.whales || []
  const summary = data?.summary || {
    whaleCount: whales.length,
    megaCount: whales.filter((w: WhaleData) => w.volMcRatio >= 2).length,
    totalVolume: whales.reduce((s: number, w: WhaleData) => s + (w.volumeUSD ?? 0), 0),
    bullish: whales.filter((w: WhaleData) => (w.priceChange24h ?? 0) > 0).length,
    bearish: whales.filter((w: WhaleData) => (w.priceChange24h ?? 0) < 0).length,
  }

  // Filter by volume threshold
  const filterThreshold = THRESHOLDS.find(t => t.value === filterMin)?.value || 0
  const filteredWhales = whales.filter((w: WhaleData) => (w.volumeUSD ?? 0) >= filterThreshold)
  const totalPages = Math.ceil(filteredWhales.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const pagedWhales = filteredWhales.slice(startIndex, startIndex + itemsPerPage)

  const loading = isLoading || !data
  const hasError = !!error

  return (
    <div className="whale-wrap">
      {/* Header */}
      <div className="whale-header">
        <div>
          <h2 className="whale-title">🐋 Whale Activity Monitor</h2>
          <p className="whale-subtitle">
            Deteksi akumulasi besar via anomali volume CoinGecko — update setiap 3 menit
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#475569' }}>
            {data?.fetchedAt ? 'Update: ' + new Date(data.fetchedAt).toLocaleTimeString('id-ID') : ''}
          </span>
          <button onClick={() => refetch()} className="screener-refresh-btn">↻ Refresh</button>
        </div>
      </div>

      {/* Summary KPI row */}
      <div className="whale-kpi-row">
        <div className="whale-kpi-card">
          <div className="whale-kpi-val">{summary.whaleCount}</div>
          <div className="whale-kpi-label">🐋 Coin Terdeteksi</div>
        </div>
        <div className="whale-kpi-card" style={{ '--kc': '#fca5a5' } as any}>
          <div className="whale-kpi-val" style={{ color: '#fca5a5' }}>{summary.megaCount}</div>
          <div className="whale-kpi-label">🐳 Mega Whale (Vol/MC {'>'}200%)</div>
        </div>
        <div className="whale-kpi-card">
          <div className="whale-kpi-val" style={{ color: '#67e8f9' }}>{fmtUSD(summary.totalVolume)}</div>
          <div className="whale-kpi-label">💰 Total Volume Anomali</div>
        </div>
        <div className="whale-kpi-card">
          <div className="whale-kpi-val" style={{ color: '#4ade80' }}>{summary.bullish} 🟢 / {summary.bearish} 🔴</div>
          <div className="whale-kpi-label">📊 Bullish / Bearish</div>
        </div>
      </div>

      {/* Filter threshold */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Filter volume:</span>
        {THRESHOLDS.map(t => (
          <button
            key={t.label}
            onClick={() => {
              setFilterMin(t.value)
              setCurrentPage(1)
            }}
            className={`whale-filter-btn ${filterMin === t.value ? 'whale-filter-btn--active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Whale feed table */}
      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #1e293b' }}>
        <table className="whale-table">
          <thead>
            <tr>
              <th>Level</th>
              <th>Coin</th>
              <th>Rank</th>
              <th>Harga</th>
              <th>24h Δ</th>
              <th>Volume 24h</th>
              <th>Vol/MC Ratio</th>
              <th>Market Cap</th>
              <th>Sinyal</th>
              <th>Trading Signal</th>
              <th>⚡ Futures</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {hasError ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '32px' }}>
                  <div className="pt-empty">
                    <div className="pt-empty-icon">🐳</div>
                    <div className="pt-empty-title">Gagal memuat whale data</div>
                    <div className="pt-empty-sub">{(error as Error)?.message || 'Server tidak tersedia'}</div>
                    <button onClick={() => refetch()} className="screener-refresh-btn" style={{ marginTop: '16px' }}>
                      ↻ Coba Lagi
                    </button>
                  </div>
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '32px', color: '#475569' }}>
                  <div className="screener-loading">
                    <span className="g-spinner"></span>
                    <span>Memuat whale data…</span>
                  </div>
                </td>
              </tr>
            ) : filteredWhales.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '32px', color: '#475569' }}>
                  <div className="pt-empty">
                    <div className="pt-empty-icon">🐳</div>
                    <div className="pt-empty-title">Tidak ada whale activity</div>
                    <div className="pt-empty-sub">Tidak ada whale activity dengan threshold ini</div>
                  </div>
                </td>
              </tr>
            ) : (
              pagedWhales.map((whale: WhaleData) => {
                const badge = whaleBadge(whale.volMcRatio)
                const ch24 = whale.priceChange24h ?? 0
                const signals = whale.signals || []
                const signalCoin = signalCoinMap.get(whale.id)

                return (
                  <tr key={whale.id} className="whale-row">
                    <td>
                      <span
                        className="whale-level-badge"
                        style={{ backgroundColor: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                          src={whale.image || ''}
                          alt={whale.symbol}
                          width={24}
                          height={24}
                          style={{ borderRadius: '50%', objectFit: 'cover' }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '13px' }}>{whale.symbol?.toUpperCase()}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{whale.name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '12px' }}>#{whale.rank || '?'}</td>
                    <td style={{ color: '#e2e8f0', fontWeight: 600 }}>${fmtPrice(whale.priceUSD)}</td>
                    <td style={{ color: colorCh(ch24), fontWeight: 700 }}>
                      {ch24 > 0 ? '+' : ''}{ch24.toFixed(2)}%
                    </td>
                    <td style={{ color: '#67e8f9', fontWeight: 600 }}>{fmtUSD(whale.volumeUSD)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: whale.volMcRatio >= 1 ? '#fca5a5' : whale.volMcRatio >= 0.5 ? '#a5b4fc' : '#93c5fd',
                            fontSize: '14px',
                          }}
                        >
                          {(whale.volMcRatio * 100).toFixed(1)}%
                        </span>
                        <div style={{ height: '4px', background: '#1e293b', borderRadius: '2px', width: '80px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              background: whale.volMcRatio >= 1 ? '#ef4444' : '#3b82f6',
                              width: `${Math.min(whale.volMcRatio * 50, 100)}%`,
                              borderRadius: '2px',
                              transition: 'width 0.5s',
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '12px' }}>{fmtUSD(whale.marketCap)}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {signals.map((s, i) => (
                          <span key={i} className="screener-signal">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {signalCoin ? (
                        <SignalBadgeCell badge={getTradingSignal(signalCoin)} />
                      ) : (
                        <span style={{ color: '#334155', fontSize: '11px' }}>—</span>
                      )}
                    </td>
                    <td>
                      {signalCoin ? (
                        <SignalBadgeCell badge={getFuturesRecommendation(signalCoin)} />
                      ) : (
                        <span style={{ color: '#334155', fontSize: '11px' }}>—</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => window.open(`https://www.coingecko.com/en/coins/${whale.id}`, '_blank')}
                          className="screener-act-btn"
                          title="CoinGecko"
                        >
                          🦎
                        </button>
                        <a
                          href={`https://www.tradingview.com/chart/?symbol=${whale.symbol?.toUpperCase()}USDT`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="screener-act-btn"
                          title="TradingView"
                        >
                          📈
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredWhales.length > itemsPerPage && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="screener-refresh-btn"
            style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
          >
            Previous
          </button>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="screener-refresh-btn"
            style={{ opacity: currentPage === totalPages ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
      )}

      {/* Educational note */}
      <div className="whale-note">
        <div style={{ fontWeight: 600, marginBottom: '4px' }}>📚 Cara Baca Whale Activity</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '11px', color: '#64748b' }}>
          <div>🐳 <strong style={{ color: '#fca5a5' }}>Mega Whale</strong> — Vol/MC {'>'}200%: pergerakan luar biasa, high risk</div>
          <div>🐋 <strong style={{ color: '#a5b4fc' }}>Whale</strong> — Vol/MC {'>'}100%: akumulasi besar terdeteksi</div>
          <div>🦈 <strong style={{ color: '#93c5fd' }}>Shark</strong> — Vol/MC {'>'}50%: volume di atas normal signifikan</div>
          <div>🐬 <strong style={{ color: '#67e8f9' }}>Dolphin</strong> — Vol/MC {'>'}25%: aktivitas di atas rata-rata</div>
          <div>📉 Harga turun + volume tinggi = <strong>akumulasi whale</strong> (beli saat retail panic)</div>
          <div>📈 Harga naik + volume tinggi = <strong>distribusi/pump</strong> (whale jual ke retail)</div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop: '12px', fontSize: '10px', color: '#334155', textAlign: 'center' }}>
        ⚠️ Data berdasarkan volume anomali CoinGecko — bukan data on-chain langsung. Gunakan sebagai referensi, bukan sinyal trading tunggal.
      </div>
    </div>
  )
}
