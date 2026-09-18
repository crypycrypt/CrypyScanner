"use client"

import { useQuery } from '@tanstack/react-query'
import { MemeToken } from '../../lib/meme/types'

async function fetchTokenDetail(mint: string): Promise<any> {
  const res = await fetch(`/api/meme-tokens?limit=1&refresh=1`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data = await res.json()
  const token = data.tokens?.find((t: MemeToken) => t.address === mint) || data.tokens?.[0]
  return { ...data, token }
}

function formatPrice(v: number): string {
  if (v === 0) return '$0.0000'
  if (v < 0.01) return `$${v.toFixed(6)}`
  if (v < 1) return `$${v.toFixed(4)}`
  return `$${v.toFixed(2)}`
}

function formatNumber(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function SignalBadge({ signal }: { signal: string }) {
  const cls = {
    'STRONG BUY': 'meme-signal-strong-buy',
    'CONDITIONAL BUY': 'meme-signal-conditional-buy',
    'WATCH': 'meme-signal-watch',
    'WAIT': 'meme-signal-wait',
    'AVOID': 'meme-signal-avoid',
    'EXIT WATCH': 'meme-signal-exit-watch',
  }[signal] || 'meme-signal-wait'
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{signal}</span>
}

function RiskBadge({ score }: { score: number }) {
  let level: string, color: string
  if (score >= 70) { level = 'CRITICAL'; color = 'meme-risk-critical' }
  else if (score >= 50) { level = 'HIGH'; color = 'meme-risk-high' }
  else if (score >= 30) { level = 'MEDIUM'; color = 'meme-risk-medium' }
  else { level = 'LOW'; color = 'meme-risk-low' }
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${color}`}>{level} ({score})</span>
}

export default function MemeTokenDetail({ mint }: { mint: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['meme-token-detail', mint],
    queryFn: () => fetchTokenDetail(mint),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const token: MemeToken | undefined = data?.token

  if (isLoading) {
    return (
      <div className="meme-terminal">
        <div className="meme-panel">
          <div className="head">TOKEN DETAIL</div>
          <div className="p-8 text-center text-[#475569]">
            <span className="g-spinner lg"></span> Loading token data...
          </div>
        </div>
      </div>
    )
  }

  if (error || !token) {
    return (
      <div className="meme-terminal">
        <div className="meme-panel">
          <div className="head">TOKEN DETAIL</div>
          <div className="p-8 text-center text-[#f87171]">
            Token not found or error loading data.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="meme-terminal">
      {/* Token Header */}
      <div className="meme-panel">
        <div className="head">
          <span>TOKEN DETAIL · {token.symbol}</span>
          <span className="muted">{token.freshness}</span>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <div>
              <div className="text-2xl font-bold text-[#baff38]">{token.symbol}</div>
              <div className="text-[#648176] text-sm">{token.name}</div>
            </div>
            <div className="text-3xl font-bold text-[#d8eee5]">{formatPrice(token.price)}</div>
            <div className={token.priceChange1h >= 0 ? 'text-green' : 'text-red'}>
              {token.priceChange1h >= 0 ? '+' : ''}{token.priceChange1h.toFixed(2)}%
            </div>
            <SignalBadge signal={token.aiSignal} />
            <RiskBadge score={token.riskScore} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#06140e] border border-[#173b2b] rounded p-3">
              <div className="text-[#56766a] text-xs">LIQUIDITY</div>
              <div className="text-xl font-bold text-[#d8eee5]">{formatNumber(token.liquidity)}</div>
            </div>
            <div className="bg-[#06140e] border border-[#173b2b] rounded p-3">
              <div className="text-[#56766a] text-xs">VOLUME 24H</div>
              <div className="text-xl font-bold text-[#d8eee5]">{formatNumber(token.volume24h)}</div>
            </div>
            <div className="bg-[#06140e] border border-[#173b2b] rounded p-3">
              <div className="text-[#56766a] text-xs">BUY/SELL RATIO</div>
              <div className="text-xl font-bold text-[#d8eee5]">{token.buySellRatio}%</div>
            </div>
            <div className="bg-[#06140e] border border-[#173b2b] rounded p-3">
              <div className="text-[#56766a] text-xs">HOLDERS</div>
              <div className="text-xl font-bold text-[#d8eee5]">{token.holderCount || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Score Breakdown */}
      <div className="meme-panel">
        <div className="head">
          <span>AI SCORE BREAKDOWN</span>
          <span className="muted">{token.aiScore}/100 · Confidence {token.aiConfidence}%</span>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {Object.entries(token.aiBreakdown).map(([key, val]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-[#648176] text-xs w-40">{key.replace(/_/g, ' ').toUpperCase()}</span>
                <div className="flex-1 h-2 bg-[#10271d] rounded">
                  <div
                    className="h-full rounded bg-[#baff38]"
                    style={{ width: `${(val / 15) * 100}%` }}
                  />
                </div>
                <span className="text-[#d8eee5] text-xs w-12">+{val}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-[#648176]">
            FINAL SCORE = {Object.values(token.aiBreakdown).reduce((a, b) => a + b, 0)}/100
          </div>
        </div>
      </div>

      {/* Risk Analysis */}
      <div className="meme-panel">
        <div className="head">
          <span>RISK ANALYSIS</span>
          <span className="muted">Score {token.riskScore}/100</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {Object.entries(token.riskLevels).map(([key, level]) => {
              const cls = {
                LOW: 'meme-risk-low',
                MEDIUM: 'meme-risk-medium',
                HIGH: 'meme-risk-high',
                CRITICAL: 'meme-risk-critical',
              }[level as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'] || 'meme-risk-low'
              return (
                <div key={key} className="text-center">
                  <div className="text-[#648176] text-xs mb-1">{key.toUpperCase()}</div>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${cls}`}>{level}</span>
                </div>
              )
            })}
          </div>
          <div className="space-y-1">
            {token.riskFlags.length > 0 ? (
              token.riskFlags.map((flag, i) => (
                <div key={i} className="text-xs text-[#ff5d69]">⚠ {flag}</div>
              ))
            ) : (
              <div className="text-xs text-[#22e58a]">No significant risk flags detected</div>
            )}
          </div>
        </div>
      </div>

      {/* Entry Timing */}
      <div className="meme-panel">
        <div className="head">
          <span>ENTRY TIMING</span>
          <span className="muted">{token.entryPhase} · Quality {token.entryQuality}/100</span>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="text-xs text-[#648176]">EARLY</div>
            <div className="flex-1 h-2 bg-[#10271d] rounded">
              <div
                className="h-full rounded bg-[#baff38]"
                style={{
                  width: token.entryPhase === 'EARLY' ? '20%' : token.entryPhase === 'CURRENT' ? '50%' : '80%',
                  marginLeft: token.entryPhase === 'EARLY' ? '0%' : token.entryPhase === 'CURRENT' ? '30%' : '60%',
                }}
              />
            </div>
            <div className="text-xs text-[#648176]">LATE</div>
          </div>
          <div className="space-y-1">
            {token.entryReasons.map((reason, i) => (
              <div key={i} className="text-xs text-[#d8eee5]">✓ {reason}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Exit Pressure */}
      <div className="meme-panel">
        <div className="head">
          <span>EXIT PRESSURE</span>
          <span className="muted">{token.exitPressure}/100 · {token.exitLevel}</span>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-4 bg-[#10271d] rounded">
              <div
                className="h-full rounded"
                style={{
                  width: `${token.exitPressure}%`,
                  background: token.exitPressure > 70 ? '#ff5d69' : token.exitPressure > 40 ? '#ffc85b' : '#22e58a',
                }}
              />
            </div>
            <span className="text-xs text-[#648176]">{token.exitPressure}/100</span>
          </div>
          <div className="space-y-1">
            {token.exitReasons.length > 0 ? (
              token.exitReasons.map((reason, i) => (
                <div key={i} className="text-xs text-[#ff5d69]">⚠ {reason}</div>
              ))
            ) : (
              <div className="text-xs text-[#22e58a]">No exit pressure detected</div>
            )}
          </div>
        </div>
      </div>

      {/* Token Info */}
      <div className="meme-panel">
        <div className="head">
          <span>TOKEN INFO</span>
          <span className="muted">DEX: {token.dexUrl ? 'DexScreener' : 'N/A'}</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#0d2119]">
              <span className="text-[#648176]">Mint Address</span>
              <span className="text-[#d8eee5]">{token.address}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#0d2119]">
              <span className="text-[#648176]">Pair Address</span>
              <span className="text-[#d8eee5]">{token.pairAddress || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#0d2119]">
              <span className="text-[#648176]">Age</span>
              <span className="text-[#d8eee5]">{token.age}m</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#0d2119]">
              <span className="text-[#648176]">Narrative</span>
              <span className="text-[#d8eee5]">{token.narrative}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#0d2119]">
              <span className="text-[#648176]">Sniper Activity</span>
              <span className="text-[#d8eee5]">{token.sniperActivity}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#0d2119]">
              <span className="text-[#648176]">Source</span>
              <span className="text-[#d8eee5]">{token.source}</span>
            </div>
          </div>
          {token.dexUrl && (
            <div className="mt-3">
              <a
                href={token.dexUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#55aaff] text-xs hover:underline"
              >
                View on DexScreener →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
