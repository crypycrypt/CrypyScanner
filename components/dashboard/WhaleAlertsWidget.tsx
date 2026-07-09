"use client"
import { useEffect, useState } from 'react'

interface WhaleAccumulationData {
  id: string
  symbol: string
  name: string
  price: number
  ch24h: number
  volume: number
  marketCap: number
  volMcRatio: number
  image?: string
  score: number
  signals: string[]
  stealthAccumulation: boolean
  absorptionAtSupport: boolean
  volumeAnomaly: boolean
  nearSupport: boolean
  type: 'ACCUMULATING' | 'WATCHING'
  ecoEmoji: string
  ecoName: string
}

interface WhaleAccumulationResponse {
  tokens: WhaleAccumulationData[]
  fetchedAt: string
  total: number
}

function fmtP(n: number | null): string {
  return n == null ? '—' : '$' + (n < 0.01 ? n.toFixed(6) : n < 1 ? n.toFixed(4) : n.toFixed(2))
}

function fmtCh(n: number | null): string {
  return n == null ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

function chColor(n: number | null): string {
  return n && n > 0 ? '#4ade80' : n && n < 0 ? '#f87171' : '#94a3b8'
}

export default function WhaleAlertsWidget() {
  const [data, setData] = useState<WhaleAccumulationResponse>({
    tokens: [],
    fetchedAt: '',
    total: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000) // 5 minutes
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const response = await fetch('/api/whale-accumulation')
      
      if (!response.ok) {
        throw new Error('Failed to fetch whale accumulation data')
      }
      
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching whale accumulation data:', error)
    } finally {
      setLoading(false)
    }
  }

  const accumulatingCount = data.tokens.filter(t => t.type === 'ACCUMULATING').length
  const watchingCount = data.tokens.filter(t => t.type === 'WATCHING').length

  return (
    <div id="whaleAccPanel">
      {/* Header */}
      <div className="wa-header">
        <h2>🐋 Whale Accumulation Radar</h2>
        <span className="wa-badge acc">🐋 {accumulatingCount} Accumulating</span>
        <span className="wa-badge hot">👀 {watchingCount} Watching</span>
        <button className="wa-refresh-btn" onClick={fetchData}>🔄 Refresh</button>
        <span style={{fontSize: '11px', color: '#334155', marginLeft: 'auto'}}>
          {data.fetchedAt ? 'Updated ' + new Date(data.fetchedAt).toLocaleTimeString() : ''}
        </span>
      </div>

      {/* Body */}
      <div className="wa-body">
        {/* Alert bar */}
        {data.tokens.length > 0 && (
          <div className="wa-alert-bar">
            <span className="wa-alert-label">🔍 Top Signals:</span>
            {data.tokens.slice(0, 6).map(token => (
              <span key={token.id} className="wa-alert-pill">
                🐋 {token.symbol} <span style={{fontSize: '10px', opacity: '.7'}}>@{token.ecoName || '?'}</span>
              </span>
            ))}
          </div>
        )}

        {/* Cards grid */}
        <div className="wa-grid">
          {loading ? (
            <div className="wa-loading">🐋 Scanning whale activity…</div>
          ) : data.tokens.length === 0 ? (
            <div className="wa-empty">
              Tidak ada sinyal akumulasi whale saat ini.<br />
              <span style={{fontSize: '12px'}}>Coba refresh atau tunggu pasar bergerak.</span>
            </div>
          ) : (
            data.tokens.map(token => {
              const scorePct = Math.min(100, (token.score ?? 0) * 10)
              const img = token.image ? (
                <img src={token.image} className="wa-tok-img" alt={token.symbol} />
              ) : (
                <span style={{fontSize: '28px'}}>🪙</span>
              )

              const chips = [
                token.stealthAccumulation ? <span key="stealth" className="wa-sig-chip stealth">🕵️ Stealth Accum</span> : null,
                token.absorptionAtSupport ? <span key="absorb" className="wa-sig-chip absorb">📥 Absorbing</span> : null,
                token.volumeAnomaly ? <span key="volspike" className="wa-sig-chip volspike">🔥 Vol Anomaly</span> : null,
                token.nearSupport ? <span key="support" className="wa-sig-chip support">🟣 Near Support</span> : null,
              ].filter(Boolean)

              return (
                <div key={token.id} className="wa-card">
                  {/* Token header */}
                  <div className="wa-card-top">
                    {img}
                    <div>
                      <div className="wa-tok-sym">{token.symbol}</div>
                      <div className="wa-tok-eco">{token.ecoEmoji || ''} {token.ecoName || '?'}</div>
                    </div>
                    <div className="wa-tok-price">
                      <div className="price">{fmtP(token.price)}</div>
                      <div className="ch" style={{color: chColor(token.ch24h)}}>{fmtCh(token.ch24h)}</div>
                    </div>
                  </div>

                  {/* Score bars */}
                  <div className="wa-score-row">
                    <span className="wa-score-label">Whale Score</span>
                    <div className="wa-score-bar-bg">
                      <div 
                        className="wa-score-bar" 
                        style={{width: `${scorePct}%`}}
                      />
                    </div>
                    <span className="wa-score-val">{token.score ?? 0}/10</span>
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
                    <span className="wa-score-val" style={{color: '#c084fc'}}>
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
