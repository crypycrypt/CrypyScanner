"use client"

import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { MemeToken } from '../../lib/meme/types'

// ─── Fetch meme tokens from API ──────────────────────────────────
async function fetchMemeTokens(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`/api/meme-tokens?${qs}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// ─── Signal badge ────────────────────────────────────────────────
function SignalBadge({ signal }: { signal: string }) {
  const cls = {
    'STRONG BUY': 'bg-[#14532d] text-[#86efac] border border-[#22c55e]',
    'CONDITIONAL BUY': 'bg-[#422006] text-[#fcd34d] border border-[#f59e0b]',
    'WATCH': 'bg-[#1e3a5f] text-[#93c5fd] border border-[#3b82f6]',
    'WAIT': 'bg-[#06140e] text-[#6c8d80] border border-[#173b2b]',
    'AVOID': 'bg-[#450a0a] text-[#fca5a5] border border-[#ef4444]',
    'EXIT WATCH': 'bg-[#422006] text-[#fcd34d] border border-[#f59e0b]',
  }[signal] || 'bg-[#06140e] text-[#6c8d80] border border-[#173b2b]'

  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{signal}</span>
}

// ─── Risk badge ──────────────────────────────────────────────────
function RiskBadge({ score }: { score: number }) {
  let level: string
  let color: string
  if (score >= 70) { level = 'CRITICAL'; color = 'bg-[#450a0a] text-[#fca5a5] border border-[#ef4444]' }
  else if (score >= 50) { level = 'HIGH'; color = 'bg-[#422006] text-[#fcd34d] border border-[#f59e0b]' }
  else if (score >= 30) { level = 'MEDIUM'; color = 'bg-[#1e3a5f] text-[#93c5fd] border border-[#3b82f6]' }
  else { level = 'LOW'; color = 'bg-[#14532d] text-[#86efac] border border-[#22c55e]' }

  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${color}`}>{level} ({score})</span>
}

// ─── Narrative badge ─────────────────────────────────────────────
function NarrativeBadge({ narrative }: { narrative: string }) {
  const cls: Record<string, string> = {
    'PEPE': 'bg-[#14532d] text-[#86efac] border border-[#22c55e]',
    'DOG': 'bg-[#422006] text-[#fcd34d] border border-[#f59e0b]',
    'CAT': 'bg-[#1e3a5f] text-[#93c5fd] border border-[#3b82f6]',
    'AI': 'bg-[#1e1b4b] text-[#a5b4fc] border border-[#4338ca]',
    'POLITICAL': 'bg-[#450a0a] text-[#fca5a5] border border-[#ef4444]',
    'GAMING': 'bg-[#083344] text-[#67e8f9] border border-[#06b6d4]',
    'FOOD': 'bg-[#422006] text-[#fcd34d] border border-[#f59e0b]',
    'ART': 'bg-[#1e1b4b] text-[#a5b4fc] border border-[#4338ca]',
    'MUSIC': 'bg-[#1e3a5f] text-[#93c5fd] border border-[#3b82f6]',
    'MEME': 'bg-[#06140e] text-[#baff38] border border-[#173b2b]',
  }

  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls[narrative] || cls['MEME']}`}>{narrative}</span>
}

// ─── Format helpers ──────────────────────────────────────────────
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

function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
}

// ─── Sort config ─────────────────────────────────────────────────
type SortKey = 'ai_score' | 'risk_score' | 'volume' | 'liquidity' | 'price_change' | 'newest' | 'exit_pressure' | 'buy_pressure'
type SortDir = 'desc' | 'asc'

// ─── Chart Modal ─────────────────────────────────────────────────
function ChartModal({ token, onClose }: { token: MemeToken; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#06140e] border border-[#173b2b] rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#0d2119] flex justify-between items-center">
          <div>
            <h3 className="font-bold text-[#baff38] text-lg">
              ${token.symbol} — {token.name}
            </h3>
            <p className="text-xs text-[#648176] mt-1">Live chart from DexScreener</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#648176] hover:text-[#d8eee5] text-xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 bg-[#020705]">
          <iframe
            src={token.dexUrl}
            className="w-full h-[70vh]"
            title={`${token.symbol} chart`}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
        <div className="p-3 border-t border-[#0d2119] flex justify-between items-center">
          <a
            href={token.dexUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#55aaff] hover:underline"
          >
            Open in DexScreener ↗
          </a>
          <button
            onClick={onClose}
            className="text-xs text-[#648176] hover:text-[#d8eee5] border border-[#173b2b] rounded px-3 py-1"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main MemeScanner component ──────────────────────────────────
export default function MemeScanner() {
  const [sortBy, setSortBy] = useState<SortKey>('ai_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedToken, setSelectedToken] = useState<MemeToken | null>(null)
  const [chartToken, setChartToken] = useState<MemeToken | null>(null)
  // Default min-liq $5K — token yang baru launch (bonding) secara alami punya
  // liq di bawah $10k, jadi default $5K memperluas radar tanpa memasukkan
  // token dengan likuiditas terlalu tipis.
  const [minLiquidity, setMinLiquidity] = useState(5000)
  const [narrativeFilter, setNarrativeFilter] = useState<string>('all')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['meme-tokens', sortBy, sortDir, minLiquidity, narrativeFilter],
    queryFn: () => fetchMemeTokens({
      sort: sortBy,
      chain: 'solana',
      limit: '50',
      min_liq: String(minLiquidity),
      narrative: narrativeFilter,
    }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const tokens: MemeToken[] = data?.tokens || []

  const sortedTokens = useMemo(() => {
    return [...tokens].sort((a, b) => {
      let aVal: number, bVal: number
      switch (sortBy) {
        case 'ai_score': aVal = a.aiScore; bVal = b.aiScore; break
        case 'risk_score': aVal = a.riskScore; bVal = b.riskScore; break
        case 'volume': aVal = a.volume24h; bVal = b.volume24h; break
        case 'liquidity': aVal = a.liquidity; bVal = b.liquidity; break
        case 'price_change': aVal = a.priceChange1h; bVal = b.priceChange1h; break
        case 'newest': aVal = a.age; bVal = b.age; break
        case 'exit_pressure': aVal = a.exitPressure; bVal = b.exitPressure; break
        case 'buy_pressure': aVal = parseFloat(a.buySellRatio); bVal = parseFloat(b.buySellRatio); break
        default: aVal = a.aiScore; bVal = b.aiScore
      }
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })
  }, [tokens, sortBy, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  const getSortIndicator = (key: SortKey) => {
    if (sortBy !== key) return '↕'
    return sortDir === 'desc' ? '↓' : '↑'
  }

  const strongBuyCount = sortedTokens.filter(t => t.aiSignal === 'STRONG BUY' || t.aiSignal === 'CONDITIONAL BUY').length
  const totalVolume = sortedTokens.reduce((sum, t) => sum + t.volume24h, 0)
  const avgAiScore = sortedTokens.length > 0 ? Math.round(sortedTokens.reduce((sum, t) => sum + t.aiScore, 0) / sortedTokens.length) : 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#baff38]">Meme Token Scanner</h1>
          <p className="text-xs text-[#648176] mt-1">
            {data?.total || 0} tokens · Solana · Live feed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#648176]">
            {data?.fetchedAt ? `Updated: ${new Date(data.fetchedAt).toLocaleTimeString()}` : ''}
          </span>
          <button
            onClick={() => refetch()}
            className="bg-[#06140e] border border-[#173b2b] text-[#6c8d80] rounded px-3 py-1.5 text-xs font-bold cursor-pointer hover:border-[#607c2b] hover:text-[#baff38] transition-colors"
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#06140e] border border-[#173b2b] rounded-lg p-3">
          <div className="text-[#56766a] text-xs">TOTAL TOKENS</div>
          <div className="text-lg font-bold text-[#d8eee5]">{sortedTokens.length}</div>
        </div>
        <div className="bg-[#06140e] border border-[#173b2b] rounded-lg p-3">
          <div className="text-[#56766a] text-xs">STRONG BUY</div>
          <div className="text-lg font-bold text-[#22e58a]">+{strongBuyCount}</div>
        </div>
        <div className="bg-[#06140e] border border-[#173b2b] rounded-lg p-3">
          <div className="text-[#56766a] text-xs">TOTAL VOLUME</div>
          <div className="text-lg font-bold text-[#d8eee5]">{formatNumber(totalVolume)}</div>
        </div>
        <div className="bg-[#06140e] border border-[#173b2b] rounded-lg p-3">
          <div className="text-[#56766a] text-xs">AVG AI SCORE</div>
          <div className="text-lg font-bold text-[#baff38]">{avgAiScore}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={sortBy}
          onChange={(e) => handleSort(e.target.value as SortKey)}
          className="bg-[#06140e] border border-[#173b2b] text-[#6c8d80] rounded px-3 py-1.5 text-xs font-bold cursor-pointer"
        >
          <option value="ai_score">AI Score</option>
          <option value="risk_score">Risk Score</option>
          <option value="volume">Volume</option>
          <option value="liquidity">Liquidity</option>
          <option value="price_change">Price Change</option>
          <option value="newest">Newest</option>
          <option value="exit_pressure">Exit Pressure</option>
          <option value="buy_pressure">Buy Pressure</option>
        </select>

        <select
          value={narrativeFilter}
          onChange={(e) => setNarrativeFilter(e.target.value)}
          className="bg-[#06140e] border border-[#173b2b] text-[#6c8d80] rounded px-3 py-1.5 text-xs font-bold cursor-pointer"
        >
          <option value="all">All Narratives</option>
          <option value="PEPE">PEPE</option>
          <option value="DOG">DOG</option>
          <option value="CAT">CAT</option>
          <option value="AI">AI</option>
          <option value="POLITICAL">POLITICAL</option>
          <option value="GAMING">GAMING</option>
        </select>

        <select
          value={minLiquidity}
          onChange={(e) => setMinLiquidity(Number(e.target.value))}
          className="bg-[#06140e] border border-[#173b2b] text-[#6c8d80] rounded px-3 py-1.5 text-xs font-bold cursor-pointer"
        >
          <option value={5000}>Min Liq $5K</option>
          <option value={10000}>Min Liq $10K</option>
          <option value={25000}>Min Liq $25K</option>
          <option value={50000}>Min Liq $50K</option>
          <option value={100000}>Min Liq $100K</option>
        </select>
      </div>

      {/* Main Content: Table + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Token Table */}
        <div className="lg:col-span-2 border border-[#173b2b] rounded-lg overflow-hidden bg-[#06140e]">
          <div className="px-4 py-3 border-b border-[#0d2119] bg-[#081710]">
            <span className="text-xs text-[#9bb7aa] font-bold tracking-wider">LIVE MEME TOKEN SCANNER · SOLANA</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#0d2119]">
                  <th className="text-left py-2.5 px-4 text-[#56766a] font-bold">TOKEN</th>
                  <th className="text-left py-2.5 px-4 text-[#56766a] font-bold cursor-pointer hover:text-[#baff38] transition-colors" onClick={() => handleSort('price_change')}>
                    PRICE {getSortIndicator('price_change')}
                  </th>
                  <th className="text-left py-2.5 px-4 text-[#56766a] font-bold cursor-pointer hover:text-[#baff38] transition-colors" onClick={() => handleSort('liquidity')}>
                    LIQ {getSortIndicator('liquidity')}
                  </th>
                  <th className="text-left py-2.5 px-4 text-[#56766a] font-bold cursor-pointer hover:text-[#baff38] transition-colors" onClick={() => handleSort('volume')}>
                    VOL 24H {getSortIndicator('volume')}
                  </th>
                  <th className="text-left py-2.5 px-4 text-[#56766a] font-bold">BUY/SELL</th>
                  <th className="text-left py-2.5 px-4 text-[#56766a] font-bold cursor-pointer hover:text-[#baff38] transition-colors" onClick={() => handleSort('ai_score')}>
                    AI {getSortIndicator('ai_score')}
                  </th>
                  <th className="text-left py-2.5 px-4 text-[#56766a] font-bold cursor-pointer hover:text-[#baff38] transition-colors" onClick={() => handleSort('risk_score')}>
                    RISK {getSortIndicator('risk_score')}
                  </th>
                  <th className="text-left py-2.5 px-4 text-[#56766a] font-bold">SIGNAL</th>
                  <th className="text-left py-2.5 px-4 text-[#56766a] font-bold">CHART</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[#475569]">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-[#173b2b] border-t-[#baff38] rounded-full animate-spin" />
                        <span>Loading meme tokens...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[#f87171]">
                      Error loading data. <button onClick={() => refetch()} className="underline hover:text-[#baff38]">Retry</button>
                    </td>
                  </tr>
                ) : sortedTokens.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[#475569]">
                      No meme tokens found. Try adjusting filters.
                    </td>
                  </tr>
                ) : (
                  sortedTokens.map((token) => (
                    <tr
                      key={token.address}
                      className={`border-b border-[#0d2119] hover:bg-[#0a1f16] transition-colors cursor-pointer ${selectedToken?.address === token.address ? 'bg-[#0a1f16]' : ''}`}
                      onClick={() => setSelectedToken(token)}
                    >
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#baff38]">{token.symbol}</span>
                          <span className="text-[#648176]">{token.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={token.priceChange1h >= 0 ? 'text-[#22e58a]' : 'text-[#ff5d69]'}>
                          {token.priceChange1h >= 0 ? '+' : ''}{token.priceChange1h.toFixed(1)}%
                        </span>
                        <div className="text-[#648176] text-xs mt-0.5">{formatPrice(token.price)}</div>
                      </td>
                      <td className="py-2.5 px-4 text-[#d8eee5]">{formatNumber(token.liquidity)}</td>
                      <td className="py-2.5 px-4 text-[#d8eee5]">{formatNumber(token.volume24h)}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#22e58a]">B:{token.buys1h}</span>
                          <span className="text-[#ff5d69]">S:{token.sells1h}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#baff38]">{token.aiScore}</span>
                          <div className="w-10 h-1 bg-[#10271d] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#baff38]" style={{ width: `${token.aiScore}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <RiskBadge score={token.riskScore} />
                      </td>
                      <td className="py-2.5 px-4">
                        <SignalBadge signal={token.aiSignal} />
                      </td>
                      <td className="py-2.5 px-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); setChartToken(token); }}
                          className="text-[#55aaff] hover:text-[#baff38] text-xs font-bold border border-[#173b2b] rounded px-2 py-1 hover:border-[#55aaff] transition-colors"
                        >
                          Buka Chart →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart Panel */}
        <div className="border border-[#173b2b] rounded-lg overflow-hidden bg-[#06140e]">
          <div className="px-4 py-3 border-b border-[#0d2119] bg-[#081710]">
            <span className="text-xs text-[#9bb7aa] font-bold tracking-wider">LIVE CHART</span>
          </div>
          <div className="bg-[#020705]">
            {selectedToken ? (
              <iframe
                src={selectedToken.dexUrl}
                className="w-full h-[400px]"
                title={`${selectedToken.symbol} chart`}
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div className="flex items-center justify-center h-[400px] text-[#475569] text-xs">
                Select a token to view chart
              </div>
            )}
          </div>
          {selectedToken && (
            <div className="p-3 border-t border-[#0d2119]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[#baff38]">${selectedToken.symbol}</div>
                  <div className="text-xs text-[#648176]">{selectedToken.name}</div>
                </div>
                <a
                  href={selectedToken.dexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#55aaff] hover:underline"
                >
                  DexScreener ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart Modal */}
      {chartToken && (
        <ChartModal token={chartToken} onClose={() => setChartToken(null)} />
      )}

      {/* Token Detail Modal */}
      {selectedToken && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#06140e] border border-[#173b2b] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-[#0d2119] flex justify-between items-center">
              <div>
                <h3 className="font-bold text-[#baff38] text-lg">
                  {selectedToken.symbol} — {selectedToken.name}
                </h3>
                <p className="text-xs text-[#648176] mt-1">Token Analysis</p>
              </div>
              <button
                onClick={() => setSelectedToken(null)}
                className="text-[#648176] hover:text-[#d8eee5] text-xl font-bold w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-[#081710] border border-[#0d2119] rounded-lg p-3">
                  <div className="text-[#56766a] text-xs">AI SCORE</div>
                  <div className="text-2xl font-bold text-[#baff38]">{selectedToken.aiScore}/100</div>
                  <div className="text-xs text-[#648176]">Confidence: {selectedToken.aiConfidence}%</div>
                </div>
                <div className="bg-[#081710] border border-[#0d2119] rounded-lg p-3">
                  <div className="text-[#56766a] text-xs">RISK SCORE</div>
                  <div className="text-2xl font-bold text-[#ff5d69]">{selectedToken.riskScore}/100</div>
                  <div className="text-xs text-[#648176]">{selectedToken.riskLevels.liquidity} liquidity</div>
                </div>
                <div className="bg-[#081710] border border-[#0d2119] rounded-lg p-3">
                  <div className="text-[#56766a] text-xs">ENTRY QUALITY</div>
                  <div className="text-2xl font-bold text-[#22e58a]">{selectedToken.entryQuality}/100</div>
                  <div className="text-xs text-[#648176]">{selectedToken.entryPhase}</div>
                </div>
                <div className="bg-[#081710] border border-[#0d2119] rounded-lg p-3">
                  <div className="text-[#56766a] text-xs">EXIT PRESSURE</div>
                  <div className="text-2xl font-bold text-[#ff5d69]">{selectedToken.exitPressure}/100</div>
                  <div className="text-xs text-[#648176]">{selectedToken.exitLevel}</div>
                </div>
              </div>

              <div className="mb-4">
                <SignalBadge signal={selectedToken.aiSignal} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#081710] border border-[#0d2119] rounded-lg p-4">
                  <h4 className="text-[#baff38] font-bold mb-3 text-sm">AI SCORE BREAKDOWN</h4>
                  <div className="space-y-2">
                    {Object.entries(selectedToken.aiBreakdown).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-[#648176] text-xs">{key.replace(/_/g, ' ')}</span>
                        <span className="text-[#d8eee5] text-xs font-bold">+{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-[#081710] border border-[#0d2119] rounded-lg p-4">
                  <h4 className="text-[#ff5d69] font-bold mb-3 text-sm">RISK FLAGS</h4>
                  <div className="space-y-2">
                    {selectedToken.riskFlags.length > 0 ? (
                      selectedToken.riskFlags.map((flag, i) => (
                        <div key={i} className="text-xs text-[#ff5d69]">⚠ {flag}</div>
                      ))
                    ) : (
                      <div className="text-xs text-[#22e58a]">No significant risk flags detected</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="text-[#baff38] font-bold mb-2 text-sm">ENTRY REASONS</h4>
                <div className="space-y-1">
                  {selectedToken.entryReasons.map((reason, i) => (
                    <div key={i} className="text-xs text-[#d8eee5]">✓ {reason}</div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <h4 className="text-[#ff5d69] font-bold mb-2 text-sm">EXIT REASONS</h4>
                <div className="space-y-1">
                  {selectedToken.exitReasons.length > 0 ? (
                    selectedToken.exitReasons.map((reason, i) => (
                      <div key={i} className="text-xs text-[#ff5d69]">⚠ {reason}</div>
                    ))
                  ) : (
                    <div className="text-xs text-[#22e58a]">No exit pressure detected</div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#0d2119] flex justify-between items-center">
                <a
                  href={selectedToken.dexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#55aaff] text-xs hover:underline"
                >
                  View on DexScreener →
                </a>
                <button
                  onClick={() => setChartToken(selectedToken)}
                  className="text-xs text-[#baff38] border border-[#173b2b] rounded px-3 py-1.5 hover:border-[#baff38] transition-colors font-bold"
                >
                  📈 Buka Chart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
