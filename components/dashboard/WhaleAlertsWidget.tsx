"use client"
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { buildWhaleAlerts, WhaleAlert } from '../../lib/whaleAlertEngine'

type FilterKey = 'all' | 'BUY' | 'SELL' | 'WATCH'

function fmtPct(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}
function chColor(v: number): string {
  return v >= 0 ? '#4ade80' : '#f87171'
}

export default function WhaleAlertsWidget() {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const alertBadgeRef = useRef<HTMLDivElement>(null)

  const { data: coins, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['whale-alert-radar'],
    queryFn: async () => {
      const res = await fetch('/api/coingecko/top-markets?limit=150')
      if (!res.ok) throw new Error('Failed to fetch market data')
      const json = await res.json()
      if (json.ok === false) throw new Error(json.error || 'Failed to fetch market data')
      return json.coins as any[]
    },
    refetchInterval: 3 * 60 * 1000,
    staleTime: 60_000,
  })

  const alerts: WhaleAlert[] = coins ? buildWhaleAlerts(coins) : []
  const buyCount = alerts.filter((a) => a.action === 'BUY').length
  const sellCount = alerts.filter((a) => a.action === 'SELL').length
  const watchCount = alerts.filter((a) => a.action === 'WATCH').length

  useEffect(() => {
    const badge = alertBadgeRef.current
    if (!badge) return
    if (buyCount > 0) {
      badge.classList.add('visible')
      badge.textContent = `🐋 ${buyCount} Whale Accum`
    } else {
      badge.classList.remove('visible')
    }
  }, [buyCount])

  async function sendToTelegram() {
    if (!alerts.length) return
    setSendState('sending')
    try {
      const res = await fetch('/api/whale-alert-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts }),
      })
      const json = await res.json()
      setSendState(json.ok ? 'sent' : 'error')
    } catch {
      setSendState('error')
    }
    setTimeout(() => setSendState('idle'), 2500)
  }

  const visible = filter === 'all' ? alerts : alerts.filter((a) => a.action === filter)
  const maxScore = 60

  return (
    <div id="whaleAccPanel">
      <div
        id="whaleAlertBadge"
        ref={alertBadgeRef}
        onClick={() => document.getElementById('whaleAccPanel')?.scrollIntoView({ behavior: 'smooth' })}
      >
        🐋 0 Whale Accum
      </div>

      <div className="wa-header">
        <h2>
          Whale Accumulation Radar
          <span className="wa-live-dot" />
          <span className="wa-live-label">LIVE</span>
        </h2>
        <button className="wa-refresh-btn" onClick={() => refetch()}>{isFetching ? '⏳' : '🔄'} Refresh</button>
        <span className="wa-subtitle">
          Real-time volume spike &amp; price momentum detection
          {dataUpdatedAt ? ` · Update: ${new Date(dataUpdatedAt).toLocaleTimeString('id-ID')}` : ''}
        </span>
      </div>

      <div className="wa-body">
        {/* KPI row: Accumulation / Distribution / Neutral */}
        <div className="wa-kpis">
          <div className="wa-kpi-card accumulation">
            <span className="wa-kpi-label">Accumulation</span>
            <span className="wa-kpi-value">{buyCount}</span>
            <span className="wa-kpi-desc">Coins being bought</span>
          </div>
          <div className="wa-kpi-card distribution">
            <span className="wa-kpi-label">Distribution</span>
            <span className="wa-kpi-value">{sellCount}</span>
            <span className="wa-kpi-desc">Coins being sold</span>
          </div>
          <div className="wa-kpi-card neutral">
            <span className="wa-kpi-label">Neutral</span>
            <span className="wa-kpi-value">{watchCount}</span>
            <span className="wa-kpi-desc">Balanced behavior</span>
          </div>
        </div>

        {/* Alert filter/action header */}
        <div className="wa-alert-header">
          <div className="wa-alert-title">
            Whale Alert Signals
            <span className="wa-alert-status">
              {isLoading ? 'Scanning…' : `${alerts.length} signals · ${buyCount}↑ ${sellCount}↓ ${watchCount}~`}
            </span>
          </div>
          <div className="wa-filters">
            {(['all', 'BUY', 'SELL', 'WATCH'] as FilterKey[]).map((f) => (
              <button
                key={f}
                className={`wa-filter-chip ${filter === f ? 'active' : ''}`}
                data-f={f}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'BUY' ? '🟢 BUY' : f === 'SELL' ? '🔴 SELL' : '🟡 WATCH'}
              </button>
            ))}
            <button className="wa-tg-btn" onClick={sendToTelegram} disabled={sendState === 'sending' || !alerts.length}>
              {sendState === 'sending' ? '⏳ Mengirim…' : sendState === 'sent' ? '✅ Terkirim!' : sendState === 'error' ? '❌ Gagal' : '📱 Kirim ke Telegram'}
            </button>
          </div>
        </div>

        {/* Cards grid */}
        <div className="wa-grid">
          {isLoading ? (
            <div className="wa-loading">🐋 Scanning whale activity…</div>
          ) : visible.length === 0 ? (
            <div className="wa-empty">
              Belum ada whale spike kuat saat ini.<br />
              <span style={{ fontSize: '12px' }}>Coba refresh atau tunggu pasar bergerak.</span>
            </div>
          ) : (
            visible.map((alert) => {
              const isBuy = alert.action === 'BUY'
              const isSell = alert.action === 'SELL'
              const actionColor = isBuy ? '#4ade80' : isSell ? '#f87171' : '#fbbf24'
              const badgeCls = isBuy ? 'buy' : isSell ? 'sell' : 'watch'
              const actionIcon = isBuy ? '▲' : isSell ? '▼' : '◆'
              const dirText = isBuy ? '📈 Akumulasi Whale' : isSell ? '📉 Distribusi Whale' : '👁 Aktivitas Tinggi'
              const score = isBuy ? alert.buyScore : isSell ? alert.sellScore : Math.max(alert.buyScore, alert.sellScore)
              const scoreBarW = Math.min(100, Math.round((score / maxScore) * 100))
              const scoreColor = score >= 40 ? '#4ade80' : score >= 25 ? '#fbbf24' : '#94a3b8'

              return (
                <div key={alert.coinId} className="wa-card" data-action={alert.action}>
                  <div className="wa-card-header">
                    <div className="wa-coin-info">
                      {alert.image ? (
                        <img
                          src={alert.image} className="wa-coin-img" alt=""
                          onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
                        />
                      ) : (
                        <div className="wa-coin-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                          {(alert.symbol || '?')[0]}
                        </div>
                      )}
                      <div className="wa-coin-text">
                        <span className="wa-coin-name">{alert.name}</span>
                        <span className="wa-coin-sym">{alert.symbol}</span>
                      </div>
                    </div>
                    <span className={`wa-action-badge ${badgeCls}`}>{actionIcon} {alert.action}</span>
                  </div>

                  <div className="wa-dir-label" style={{ color: actionColor }}>{dirText}</div>

                  <div className="wa-score-row">
                    <div className="wa-score-bar-bg">
                      <div className="wa-score-bar" style={{ width: `${scoreBarW}%`, background: scoreColor }} />
                    </div>
                    <span className="wa-score-label" style={{ color: scoreColor }}>Score {score}/{maxScore}</span>
                  </div>

                  <div className="wa-stats-row">
                    <div className="wa-stat">
                      <span className="wa-stat-label">1H</span>
                      <span className="wa-stat-val" style={{ color: chColor(alert.ch1h) }}>{fmtPct(alert.ch1h)}</span>
                    </div>
                    <div className="wa-stat">
                      <span className="wa-stat-label">24H</span>
                      <span className="wa-stat-val" style={{ color: chColor(alert.ch24h) }}>{fmtPct(alert.ch24h)}</span>
                    </div>
                    <div className="wa-stat">
                      <span className="wa-stat-label">7D</span>
                      <span className="wa-stat-val" style={{ color: chColor(alert.ch7d) }}>{fmtPct(alert.ch7d)}</span>
                    </div>
                    <div className="wa-stat">
                      <span className="wa-stat-label">Vol/MCap</span>
                      <span className="wa-stat-val" style={{ color: '#f0b429' }}>{(alert.volRatio * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="wa-reasons">
                    {alert.reasons.map((r, i) => <span key={i} className="wa-reason-tag">{r}</span>)}
                    {alert.intradaySpike && <span className="wa-spike-badge">⚡ Spike</span>}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="wa-footer">
          Data dari CoinGecko · Score = kombinasi momentum + volume + posisi ATH · Bukan financial advice
        </div>
      </div>
    </div>
  )
}
