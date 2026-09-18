"use client"
import { useEffect, useState, useRef } from 'react'

interface WhaleAccumulationData {
  id: string
  symbol: string
  name: string
  price: number
  ch1h?: number
  ch24h: number
  ch7d?: number
  volume: number
  volume24h?: number
  marketCap: number
  volMcRatio: number
  image?: string
  score: number
  confidence: number
  signals: string[]
  stealthAccumulation: boolean
  absorptionAtSupport: boolean
  volumeAnomaly: boolean
  nearSupport: boolean
  type: 'ACCUMULATING' | 'WATCHING' | 'NORMAL'
  label?: string
  color?: string
  ecoSymbol?: string
  ecoColor?: string
  ecoEmoji: string
  ecoName: string
}

interface WhaleAccumulationResponse {
  ok?: boolean
  cached?: boolean
  stale?: boolean
  tokens: WhaleAccumulationData[]
  topAccumulating?: WhaleAccumulationData[]
  accumulatingCount?: number
  watchingCount?: number
  fetchedAt: string
  total: number
  whaleAccumulators?: any[]
  dexAccumulating?: any[]
  boostedTokens?: any[]
}

function fmtP(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + (n < 0.01 ? n.toFixed(6) : n < 1 ? n.toFixed(4) : n.toFixed(2))
}

function fmtCh(n: number | null | undefined): string {
  if (n == null) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

function chColor(n: number | null | undefined): string {
  if (n == null) return '#94a3b8'
  return n > 0 ? '#4ade80' : n < 0 ? '#f87171' : '#94a3b8'
}

function getAction(token: WhaleAccumulationData): 'BUY' | 'SELL' | 'WATCH' {
  if (token.type === 'ACCUMULATING') return 'BUY'
  if (token.type === 'WATCHING') return 'WATCH'
  return 'WATCH'
}

export default function WhaleAlertsWidget() {
  const [data, setData] = useState<WhaleAccumulationResponse>({
    ok: true,
    tokens: [],
    topAccumulating: [],
    accumulatingCount: 0,
    watchingCount: 0,
    fetchedAt: '',
    total: 0
  })
  const [loading, setLoading] = useState(true)
  const alertBadgeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000) // 5 minutes
    return () => clearInterval(interval)
  }, [])

  // Update global alert badge visibility
  useEffect(() => {
    const badge = alertBadgeRef.current
    if (!badge) return
    const accCount = data.accumulatingCount ?? 0
    if (accCount > 0) {
      badge.classList.add('visible')
      badge.textContent = `🐋 ${accCount} Whale Accum`
    } else {
      badge.classList.remove('visible')
    }
  }, [data.accumulatingCount])

  async function fetchData(force = false) {
    try {
      setLoading(true)
      const response = await fetch(force ? '/api/whale-accumulation?refresh=1' : '/api/whale-accumulation')

      if (!response.ok) {
        throw new Error('Failed to fetch whale accumulation data')
      }

      const result = await response.json()
      if (result.ok === false) {
        throw new Error(result.error || 'Failed to fetch whale accumulation data')
      }
      setData(result)
    } catch (error) {
      console.error('Error fetching whale accumulation data:', error)
    } finally {
      setLoading(false)
    }
  }

  const topAccumulating = data.topAccumulating ?? data.tokens.filter(t => t.type === 'ACCUMULATING').slice(0, 12)
  const accumulatingCount = data.accumulatingCount ?? data.tokens.filter(t => t.type === 'ACCUMULATING').length
  const watchingCount = data.watchingCount ?? data.tokens.filter(t => t.type === 'WATCHING').length

  return (
    <div id="whaleAccPanel">
      {/* Global alert badge (visible in header area when whales are accumulating) */}
      <div
        id="whaleAlertBadge"
        ref={alertBadgeRef}
        onClick={() => {
          const panel = document.getElementById('whaleAccPanel')
          if (panel) panel.scrollIntoView({ behavior: 'smooth' })
        }}
      >
        🐋 0 Whale Accum
      </div>

      {/* Header */}
      <div className="wa-header">
        <h2>🐋 Whale Accumulation Radar</h2>
        <span className="wa-badge acc">🐋 {accumulatingCount} Accumulating</span>
        <span className="wa-badge hot">👀 {watchingCount} Watching</span>
        <button className="wa-refresh-btn" onClick={() => fetchData(true)}>🔄 Refresh</button>
        <span style={{ fontSize: '11px', color: '#334155', marginLeft: 'auto' }}>
          {data.fetchedAt ? 'Updated ' + new Date(data.fetchedAt).toLocaleTimeString() : ''}{data.cached ? ' · cached' : ''}{data.stale ? ' · stale' : ''}
        </span>
      </div>

      {/* Body */}
      <div className="wa-body">
        {/* Alert bar */}
        {topAccumulating.length > 0 && (
          <div className="wa-alert-bar">
            <span className="wa-alert-label">🔍 Top Signals:</span>
            {topAccumulating.slice(0, 6).map(token => (
              <span key={token.id} className="wa-alert-pill">
                🐋 {token.symbol} <span style={{ fontSize: '10px', opacity: '.7' }}>@{token.ecoName || '?'}</span>
              </span>
            ))}
          </div>
        )}

        {/* Cards grid */}
        <div className="wa-grid">
          {loading ? (
            <div className="wa-loading">🐋 Scanning whale activity…</div>
          ) : topAccumulating.length === 0 ? (
            <div className="wa-empty">
              Tidak ada sinyal akumulasi whale saat ini.<br />
              <span style={{ fontSize: '12px' }}>Coba refresh atau tunggu pasar bergerak.</span>
            </div>
          ) : (
            topAccumulating.map(token => {
              const scorePct = Math.min(100, token.score ?? 0)
              const action = getAction(token)
              const img = token.image ? (
                <img src={token.image} className="wa-tok-img" alt={token.symbol} />
              ) : (
                <span style={{ fontSize: '28px' }}>🪙</span>
              )

              const chips = [
                token.stealthAccumulation ? <span key="stealth" className="wa-sig-chip stealth">🕵️ Stealth Accum</span> : null,
                token.absorptionAtSupport ? <span key="absorb" className="wa-sig-chip absorb">📥 Absorbing</span> : null,
                token.volumeAnomaly ? <span key="volspike" className="wa-sig-chip volspike">🔥 Vol Anomaly</span> : null,
                token.nearSupport ? <span key="support" className="wa-sig-chip support">🟣 Near Support</span> : null,
              ].filter(Boolean)

              return (
                <div key={token.id} className="wa-card" data-action={action}>
                  {/* Token header */}
                  <div className="wa-card-top">
                    {img}
                    <div>
                      <div className="wa-tok-sym">{token.symbol}</div>
                      <div className="wa-tok-eco">
                        {token.ecoEmoji || ''} {token.ecoName || token.ecoSymbol || '?'}
                        {token.ecoColor && (
                          <span
                            className="wa-eco-badge"
                            style={{
                              background: `rgba(${parseInt(token.ecoColor.slice(1, 3), 16)}, ${parseInt(token.ecoColor.slice(3, 5), 16)}, ${parseInt(token.ecoColor.slice(5, 7), 16)}, 0.2)`,
                              color: token.ecoColor,
                              border: `1px solid ${token.ecoColor}40`,
                            }}
                          >
                            {token.ecoSymbol || ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="wa-tok-price">
                      <div className="price">{fmtP(token.price)}</div>
                      <div className="ch" style={{ color: chColor(token.ch24h) }}>{fmtCh(token.ch24h)}</div>
                      {token.ch1h != null && (
                        <div className="ch" style={{ color: chColor(token.ch1h), fontSize: '10px' }}>{fmtCh(token.ch1h)}</div>
                      )}
                    </div>
                  </div>

                  {/* Score bars */}
                  <div className="wa-score-row">
                    <span className="wa-score-label">Whale Score</span>
                    <div className="wa-score-bar-bg">
                      <div
                        className="wa-score-bar"
                        style={{ width: `${scorePct}%` }}
                      />
                    </div>
                    <span className="wa-score-val">{token.score ?? 0}/100</span>
                  </div>

                  <div className="wa-score-row">
                    <span className="wa-score-label">Confidence</span>
                    <div className="wa-score-bar-bg">
                      <div
                        className="wa-score-bar"
                        style={{
                          width: `${Math.min(100, token.confidence ?? 0)}%`,
                          background: 'linear-gradient(90deg,#06b6d4,#22d3ee)'
                        }}
                      />
                    </div>
                    <span className="wa-score-val" style={{ color: '#22d3ee' }}>
                      {token.confidence ?? 0}%
                    </span>
                  </div>

                  <div className="wa-score-row">
                    <span className="wa-score-label">Vol/MCap</span>
                    <div className="wa-score-bar-bg">
                      <div
                        className="wa-score-bar"
                        style={{
                          width: `${Math.min(100, (token.volMcRatio ?? 0) * 200)}%`,
                          background: 'linear-gradient(90deg,#7c3aed,#c084fc)'
                        }}
                      />
                    </div>
                    <span className="wa-score-val" style={{ color: '#c084fc' }}>
                      {((token.volMcRatio ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Signal chips */}
                  {chips.length > 0 && (
                    <div className="wa-signals">
                      {chips}
                    </div>
                  )}

                  {/* Type badge */}
                  <span className={`wa-type-badge ${token.type}`}>
                    {token.type === 'ACCUMULATING' ? '🐋 Accumulating' : '👀 Watching'}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="wa-footer">
          Data from CoinGecko · Score = kombinasi Vol Spike + Price Flat + Near Support · Bukan financial advice
        </div>
      </div>
    </div>
  )
}
