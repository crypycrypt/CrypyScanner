"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface WhaleData {
  id: string
  symbol: string
  name: string
  rank: number
  priceUSD: number
  priceChange24h: number
  volumeUSD: number
  marketCap: number
  volMcRatio: number
  signals?: string[]
  lastUpdated: string
  image?: string
  whaleLevel: string
}

interface WhalePanelData {
  whales: WhaleData[]
  totalVolume: number
  whaleCount: number
  megaCount: number
  bullish: number
  bearish: number
  fetchedAt?: string
}

function formatUSD(v: number): string {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K'
  return '$' + v.toFixed(0)
}

function formatPrice(p: number): string {
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

function whaleBadge(ratio: number) {
  if (ratio >= 2) return { label: '🐳 Mega Whale', bg: '#7f1d1d', color: '#fca5a5' }
  if (ratio >= 1) return { label: '🐋 Whale', bg: '#1e1b4b', color: '#a5b4fc' }
  if (ratio >= 0.5) return { label: '🦈 Shark', bg: '#172554', color: '#93c5fd' }
  return { label: '🐬 Dolphin', bg: '#164e63', color: '#67e8f9' }
}

const THRESHOLDS = [
  { label: 'Semua', value: 0 },
  { label: '>$1M', value: 1e6 },
  { label: '>$5M', value: 5e6 },
  { label: '>$10M', value: 1e7 },
  { label: '>$50M', value: 5e7 },
  { label: '>$100M', value: 1e8 },
]

export default function WhaleActivityMonitor() {
  const [data, setData] = useState<WhalePanelData>({
    whales: [],
    totalVolume: 0,
    whaleCount: 0,
    megaCount: 0,
    bullish: 0,
    bearish: 0
  })
  const [filterMin, setFilterMin] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 180000) // 3 minutes
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const response = await fetch('/api/whale-screen')
      
      if (!response.ok) {
        throw new Error('Failed to fetch data from whale-screen API')
      }
      
      const result = await response.json()
      
      setData({
        whales: result.whales,
        totalVolume: result.summary.totalVolume,
        whaleCount: result.summary.whaleCount,
        megaCount: result.summary.megaCount,
        bullish: result.summary.bullish,
        bearish: result.summary.bearish,
        fetchedAt: result.fetchedAt
      })
    } catch (error) {
      console.error('Error fetching whale data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredWhales = data.whales.filter(w => w.volumeUSD >= filterMin)

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
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <span id="whaleTs" style={{fontSize: '11px', color: '#475569'}}>
            {data.fetchedAt ? 'Update: ' + new Date(data.fetchedAt).toLocaleTimeString('id-ID') : ''}
          </span>
          <button onClick={fetchData} className="screener-refresh-btn">↻ Refresh</button>
        </div>
      </div>

      {/* Summary KPI row */}
      <div className="whale-kpi-row">
        <div className="whale-kpi-card">
          <div className="whale-kpi-val">{data.whaleCount}</div>
          <div className="whale-kpi-label">🐋 Coin Terdeteksi</div>
        </div>
        <div className="whale-kpi-card" style={{'--kc': '#fca5a5'} as any}>
          <div className="whale-kpi-val" style={{color: '#fca5a5'}}>{data.megaCount}</div>
          <div className="whale-kpi-label">🐳 Mega Whale (Vol/MC >200%)</div>
        </div>
        <div className="whale-kpi-card">
          <div className="whale-kpi-val" style={{color: '#67e8f9'}}>{formatUSD(data.totalVolume)}</div>
          <div className="whale-kpi-label">💰 Total Volume Anomali</div>
        </div>
        <div className="whale-kpi-card">
          <div className="whale-kpi-val" style={{color: '#4ade80'}}>{data.bullish} 🟢 / {data.bearish} 🔴</div>
          <div className="whale-kpi-label">📊 Bullish / Bearish</div>
        </div>
      </div>

      {/* Filter threshold */}
      <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap'}}>
        <span style={{fontSize: '12px', color: '#64748b', fontWeight: '600'}}>Filter volume:</span>
        {THRESHOLDS.map(t => (
          <button 
            key={t.value}
            className={`whale-filter-btn ${filterMin === t.value ? 'whale-filter-btn--active' : ''}`}
            onClick={() => setFilterMin(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Whale feed table */}
      <div style={{overflowX: 'auto', borderRadius: '12px', border: '1px solid #1e293b'}}>
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
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{textAlign: 'center', padding: '32px', color: '#475569'}}>
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-neon"></div>
                  <p className="mt-2 text-slate-400">Memuat whale data…</p>
                </td>
              </tr>
            ) : filteredWhales.length === 0 ? (
              <tr>
                <td colSpan={10} style={{textAlign: 'center', padding: '32px', color: '#475569'}}>
                  Tidak ada whale activity dengan threshold ini
                </td>
              </tr>
            ) : (
              filteredWhales.map((whale) => {
                const badge = whaleBadge(whale.volMcRatio)
                const ch24 = whale.priceChange24h ?? 0
                const signals = whale.signals || []
                
                return (
                  <tr key={whale.id} className="whale-row">
                    <td>
                      <span 
                        className="whale-level-badge" 
                        style={{background: badge.bg, color: badge.color}}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        {whale.image ? (
                          <img 
                            src={whale.image} 
                            alt={whale.symbol} 
                            width={24} 
                            height={24} 
                            style={{borderRadius: '50%', objectFit: 'cover'}} 
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                            {whale.symbol.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div style={{fontWeight: '700', color: '#f1f5f9', fontSize: '13px'}}>
                            {whale.symbol?.toUpperCase()}
                          </div>
                          <div style={{fontSize: '11px', color: '#64748b'}}>{whale.name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{color: '#64748b', fontSize: '12px'}}>#{whale.rank || '?'}</td>
                    <td style={{color: '#e2e8f0', fontWeight: '600'}}>{formatPrice(whale.priceUSD)}</td>
                    <td style={{color: ch24 > 0 ? '#22c55e' : ch24 < 0 ? '#ef4444' : '#94a3b8', fontWeight: '700'}}>
                      {ch24 > 0 ? '+' : ''}{ch24.toFixed(2)}%
                    </td>
                    <td style={{color: '#67e8f9', fontWeight: '600'}}>{formatUSD(whale.volumeUSD)}</td>
                    <td>
                      <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                        <span style={{fontWeight: '700', color: whale.volMcRatio >= 1 ? '#fca5a5' : whale.volMcRatio >= 0.5 ? '#a5b4fc' : '#93c5fd', fontSize: '14px'}}>
                          {(whale.volMcRatio * 100).toFixed(1)}%
                        </span>
                        <div style={{height: '4px', background: '#1e293b', borderRadius: '2px', width: '80px', overflow: 'hidden'}}>
                          <div style={{height: '100%', background: whale.volMcRatio >= 1 ? '#ef4444' : '#3b82f6', width: `${Math.min(whale.volMcRatio * 50, 100)}%`, borderRadius: '2px', transition: 'width 0.5s'}}></div>
                        </div>
                      </div>
                    </td>
                    <td style={{color: '#94a3b8', fontSize: '12px'}}>{formatUSD(whale.marketCap)}</td>
                    <td>
                      <div style={{display: 'flex', flexWrap: 'wrap', gap: '3px'}}>
                        {signals.map((s, i) => (
                          <span key={i} className="screener-signal">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{display: 'flex', gap: '4px'}}>
                        <button className="screener-act-btn" title="Analisa">📊</button>
                        <a href={`https://www.coingecko.com/en/coins/${whale.id}`} target="_blank" className="screener-act-btn" title="CoinGecko">🦎</a>
                        <a href={`https://www.tradingview.com/chart/?symbol=${whale.symbol?.toUpperCase()}USDT`} target="_blank" className="screener-act-btn" title="TradingView">📈</a>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Educational note */}
      <div className="whale-note">
        <div style={{fontWeight: '600', marginBottom: '4px'}}>📚 Cara Baca Whale Activity</div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '8px', fontSize: '11px', color: '#64748b'}}>
          <div>🐳 <strong style={{color: '#fca5a5'}}>Mega Whale</strong> — Vol/MC >200%: pergerakan luar biasa, high risk</div>
          <div>🐋 <strong style={{color: '#a5b4fc'}}>Whale</strong> — Vol/MC >100%: akumulasi besar terdeteksi</div>
          <div>🦈 <strong style={{color: '#93c5fd'}}>Shark</strong> — Vol/MC >50%: volume di atas normal signifikan</div>
          <div>🐬 <strong style={{color: '#67e8f9'}}>Dolphin</strong> — Vol/MC >25%: aktivitas di atas rata-rata</div>
          <div>📉 Harga turun + volume tinggi = <strong>akumulasi whale</strong> (beli saat retail panic)</div>
          <div>📈 Harga naik + volume tinggi = <strong>distribusi/pump</strong> (whale jual ke retail)</div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{marginTop: '12px', fontSize: '10px', color: '#334155', textAlign: 'center'}}>
        ⚠️ Data berdasarkan volume anomali CoinGecko — bukan data on-chain langsung. Gunakan sebagai referensi, bukan sinyal trading tunggal.
      </div>
    </div>
  )
}