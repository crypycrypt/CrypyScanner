"use client"

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

async function fetchNarratives(): Promise<any> {
  const res = await fetch('/api/meme-narratives')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

function getStateColor(state: string): string {
  switch (state) {
    case 'EARLY': return 'text-[#55aaff]'
    case 'ACCELERATING': return 'text-[#baff38]'
    case 'PEAKING': return 'text-[#ffc85b]'
    case 'DECLINING': return 'text-[#ff5d69]'
    default: return 'text-[#648176]'
  }
}

function getStateLabel(state: string): string {
  switch (state) {
    case 'EARLY': return 'EARLY'
    case 'ACCELERATING': return 'ACCELERATING'
    case 'PEAKING': return 'PEAKING'
    case 'DECLINING': return 'DECLINING'
    default: return state
  }
}

function formatNumber(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

export default function MemeNarrativeRadar() {
  const [selectedNarrative, setSelectedNarrative] = useState<any>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['meme-narratives'],
    queryFn: fetchNarratives,
    refetchInterval: 45_000,
    staleTime: 30_000,
  })

  const narratives = data?.narratives || []
  const trending = data?.trending || []

  return (
    <div className="meme-terminal">
      {/* Top Bar */}
      <div className="meme-topbar">
        <div className="logo">
          <span className="dot"></span>
          TRENCH<span className="lime">OS</span>
        </div>
        <div className="sep"></div>
        <div className="brand">NARRATIVE INTELLIGENCE</div>
        <div className="chain">SOLANA · MEME NARRATIVE RADAR</div>
        <div className="topRight">
          <div className="stat">
            <label>ACTIVE NARRATIVES</label>
            <b>{narratives.length}</b>
          </div>
          <div className="stat">
            <label>TOP NARRATIVE</label>
            <b className="live">{data?.topNarrative || 'N/A'}</b>
          </div>
          <div className="stat">
            <label>STATUS</label>
            <b className="live">● LIVE</b>
          </div>
          <div className="nav">
            <button onClick={() => window.location.href = '/meme-scanner'}>SCANNER</button>
            <button onClick={() => window.location.href = '/meme-wallets'}>WALLETS</button>
            <button className="active">NARRATIVE</button>
            <button onClick={() => window.location.href = '/meme-risk'}>RISK</button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 mb-4 items-center">
        <button
          onClick={() => refetch()}
          className="bg-[#06140e] border border-[#173b2b] text-[#6c8d80] rounded px-3 py-1 text-xs font-bold cursor-pointer hover:border-[#607c2b] hover:text-[#baff38]"
        >
          REFRESH
        </button>
        <span className="text-xs text-[#648176]">
          {data?.fetchedAt ? `Updated: ${new Date(data.fetchedAt).toLocaleTimeString()}` : ''}
        </span>
      </div>

      {/* Narrative Grid */}
      <div className="meme-panel">
        <div className="head">
          <span>NARRATIVE VELOCITY MATRIX</span>
          <span className="muted">{narratives.length} categories tracked</span>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-8 text-[#475569]">
              <span className="g-spinner lg"></span> Loading narratives...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-[#f87171]">
              Error loading data. <button onClick={() => refetch()} className="underline">Retry</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {narratives.map((n: any) => (
                <div
                  key={n.name}
                  className="bg-[#06140e] border border-[#173b2b] rounded p-4 cursor-pointer hover:border-[#baff38] transition-colors"
                  onClick={() => setSelectedNarrative(n)}
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: n.color }}
                      />
                      <span className="font-bold text-[#d8eee5]">{n.name}</span>
                    </div>
                    <span className={`text-xs font-bold ${getStateColor(n.state)}`}>
                      {getStateLabel(n.state)}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#648176]">Velocity</span>
                      <span className="text-[#d8eee5]">{n.velocity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#648176]">Tokens Launched</span>
                      <span className="text-[#d8eee5]">{n.tokensLaunched}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#648176]">Volume Growth</span>
                      <span className={n.volumeGrowth >= 0 ? 'text-green' : 'text-red'}>
                        {n.volumeGrowth >= 0 ? '+' : ''}{n.volumeGrowth}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#648176]">Smart Money</span>
                      <span className="text-[#d8eee5]">{n.smartMoneyParticipation}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#648176]">Total Volume</span>
                      <span className="text-[#d8eee5]">{formatNumber(n.totalVolume)}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-[#648176] text-xs mb-1">Velocity Bar</div>
                    <div className="h-2 bg-[#10271d] rounded">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${Math.min(100, n.velocity / 2)}%`,
                          background: n.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trending from CoinGecko */}
      <div className="meme-panel">
        <div className="head">
          <span>TRENDING (COINGECKO)</span>
          <span className="muted">Top searched tokens</span>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {trending.map((t: any, i: number) => (
              <div key={t.id || i} className="flex items-center gap-3">
                <span className="text-[#648176] text-xs w-5">#{i + 1}</span>
                {t.thumb && <img src={t.thumb} alt={t.symbol} className="w-5 h-5 rounded" />}
                <span className="font-bold text-[#d8eee5]">{t.symbol?.toUpperCase()}</span>
                <span className="text-[#648176] text-xs">{t.name}</span>
                <span className="text-[#baff38] text-xs ml-auto">Score: {t.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Narrative Detail Modal */}
      {selectedNarrative && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#06140e] border border-[#173b2b] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-[#0d2119] flex justify-between items-center">
              <h3 className="font-bold text-[#baff38] text-lg">
                {selectedNarrative.name} Narrative
              </h3>
              <button
                onClick={() => setSelectedNarrative(null)}
                className="text-[#648176] hover:text-[#d8eee5]"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-[#030c08] border border-[#173b2b] rounded p-3">
                  <div className="text-[#56766a] text-xs">VELOCITY</div>
                  <div className="text-2xl font-bold text-[#baff38]">{selectedNarrative.velocity}</div>
                </div>
                <div className="bg-[#030c08] border border-[#173b2b] rounded p-3">
                  <div className="text-[#56766a] text-xs">TOKENS LAUNCHED</div>
                  <div className="text-2xl font-bold text-[#d8eee5]">{selectedNarrative.tokensLaunched}</div>
                </div>
                <div className="bg-[#030c08] border border-[#173b2b] rounded p-3">
                  <div className="text-[#56766a] text-xs">VOLUME GROWTH</div>
                  <div className={`text-2xl font-bold ${selectedNarrative.volumeGrowth >= 0 ? 'text-green' : 'text-red'}`}>
                    {selectedNarrative.volumeGrowth >= 0 ? '+' : ''}{selectedNarrative.volumeGrowth}%
                  </div>
                </div>
                <div className="bg-[#030c08] border border-[#173b2b] rounded p-3">
                  <div className="text-[#56766a] text-xs">SMART MONEY</div>
                  <div className="text-2xl font-bold text-[#55aaff]">{selectedNarrative.smartMoneyParticipation}%</div>
                </div>
              </div>

              <div className="mb-4">
                <span className={`px-2 py-1 rounded text-xs font-bold ${getStateColor(selectedNarrative.state)}`}>
                  {getStateLabel(selectedNarrative.state)}
                </span>
              </div>

              <h4 className="text-[#baff38] font-bold mb-2 text-sm">RELATED TOKENS</h4>
              <div className="space-y-2">
                {selectedNarrative.tokens?.map((t: any) => (
                  <div key={t.address} className="flex justify-between items-center py-2 border-b border-[#0d2119]">
                    <div>
                      <span className="font-bold text-[#baff38]">{t.symbol}</span>
                      <span className="text-[#648176] text-xs ml-2">{t.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[#d8eee5] text-xs">{formatNumber(t.liquidity)} liq</div>
                      <div className={t.priceChange24h >= 0 ? 'text-green' : 'text-red'}>
                        {t.priceChange24h >= 0 ? '+' : ''}{t.priceChange24h.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )) || <div className="text-xs text-[#648176]">No tokens found</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
