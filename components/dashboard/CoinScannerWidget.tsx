"use client"
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useTopMarkets, useMarketOverview, useHollowcatAnalysis } from '../../lib/realTimeHooks'
import Skeleton from '../ui/Skeleton'
import CoinIcon from '../ui/CoinIcon'
import Pagination from '../ui/Pagination'
import WalletFlowGraph from '../crypto-scanner/WalletFlowGraph'
import HollowcatDashboard from '../hollowcat/HollowcatDashboard'
import HollowcatChart from '../hollowcat/HollowcatChart'
import HollowcatSignals from '../hollowcat/HollowcatSignals'
import HollowcatRiskPanel from '../hollowcat/HollowcatRiskPanel'
import HollowcatTradeQuality from '../hollowcat/HollowcatTradeQuality'
import HollowcatEntryEngine from '../hollowcat/HollowcatEntryEngine'
import HollowcatBacktest from '../hollowcat/HollowcatBacktest'
import HollowcatAlerts from '../hollowcat/HollowcatAlerts'
import { scoreAllCoins, CoinAnalysis } from '../../lib/cryptoScannerAnalysis'
import {
  MoonPhasePanel,
  FibonacciPanel,
  FuturesPanel,
  IndicatorGuidePanel,
  AIScorePanel,
  AIRankingsPanel,
} from '../crypto-scanner/ScannerAnalysisPanels'

const TIME_TABS = ['1H', '24H', '7D'] as const
type TimeKey = (typeof TIME_TABS)[number]

const TIMEFRAME_OPTIONS = [
  { value: '15m', label: '15M', days: '1' },
  { value: '30m', label: '30M', days: '2' },
  { value: '1h', label: '1H', days: '7' },
  { value: '4h', label: '4H', days: '30' },
  { value: '1d', label: '1D', days: '90' },
  { value: '7d', label: '7D', days: '180' },
]

interface CoinRow {
  id: string
  rank: number
  symbol: string
  name: string
  price: number
  image: string | null
  h1: number
  h24: number
  d7: number
  volumeUsd: number
  mcapUsd: number
}

interface SelectedCoin {
  id: string
  symbol: string
  name: string
}

function formatUsd(v: number): string {
  if (!v || isNaN(v)) return 'N/A'
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(2)}T`
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`
  return `$${v.toFixed(2)}`
}

function formatPrice(v: number): string {
  if (!v && v !== 0) return 'N/A'
  if (v >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  if (v >= 1) return `$${v.toFixed(2)}`
  if (v >= 0.01) return `$${v.toFixed(4)}`
  return `$${v.toPrecision(3)}`
}

function pctClass(v: number): string {
  return v >= 0 ? '#22c55e' : '#ef4444'
}

function pctText(v: number): string {
  return `${v >= 0 ? '+' : ''}${(v || 0).toFixed(2)}%`
}

const ANALYSIS_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'chart', label: 'Chart', icon: '📈' },
  { id: 'signals', label: 'Signals', icon: '🎯' },
  { id: 'risk', label: 'Risk', icon: '🛡️' },
  { id: 'quality', label: 'Quality', icon: '⭐' },
  { id: 'entry', label: 'Entry', icon: '🚀' },
  { id: 'backtest', label: 'Backtest', icon: '📉' },
  { id: 'alerts', label: 'Alerts', icon: '🔔' },
  { id: 'moon', label: 'Moon Phase', icon: '🌙' },
  { id: 'fibonacci', label: 'Fibonacci', icon: '📐' },
  { id: 'futures', label: 'Futures', icon: '⚡' },
  { id: 'indicators', label: 'Indicators', icon: '📏' },
  { id: 'aiscore', label: 'AI Score', icon: '🤖' },
  { id: 'rankings', label: 'AI Rankings', icon: '🏆' },
] as const

const PAGE_SIZE = 15

export default function CoinScannerWidget() {
  const [time, setTime] = useState<TimeKey>('24H')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<'rank' | 'h24' | 'volume' | 'mcap'>('rank')

  const [selectedCoin, setSelectedCoin] = useState<SelectedCoin | null>(null)
  const [activeTab, setActiveTab] = useState<string>('dashboard')
  const [timeframe, setTimeframe] = useState('1h')
  const [days, setDays] = useState('7')
  const [analysisOpen, setAnalysisOpen] = useState(false)

  const { data: rawCoins, isLoading } = useTopMarkets(1000)
  const { data: overview } = useMarketOverview()

  const analysis = useHollowcatAnalysis(selectedCoin, timeframe, days, analysisOpen)

  // ── Build rows from real data ─────────────────────────────────────────────
  const rows: CoinRow[] = useMemo(() => {
    if (!rawCoins) return []
    return rawCoins
      .map((c: any, i: number) => ({
        id: c.id,
        rank: c.market_cap_rank ?? i + 1,
        symbol: (c.symbol || '').toUpperCase(),
        name: c.name || c.symbol || '',
        price: c.current_price ?? 0,
        image: c.image || null,
        h1: c.price_change_percentage_1h_in_currency || 0,
        h24: c.price_change_percentage_24h || 0,
        d7: c.price_change_percentage_7d_in_currency || 0,
        volumeUsd: c.total_volume || 0,
        mcapUsd: c.market_cap || 0,
      }))
      .filter((c: CoinRow) => c.symbol && c.name)
  }, [rawCoins])

  // ── Fast client-side search ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter(
      (c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
    )
  }, [rows, query])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sortKey) {
      case 'h24':
        return arr.sort((a, b) => b.h24 - a.h24)
      case 'volume':
        return arr.sort((a, b) => b.volumeUsd - a.volumeUsd)
      case 'mcap':
        return arr.sort((a, b) => b.mcapUsd - a.mcapUsd)
      default:
        return arr.sort((a, b) => a.rank - b.rank)
    }
  }, [filtered, sortKey])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Reset to page 1 when query/sort changes
  useEffect(() => {
    setPage(1)
  }, [query, sortKey])

  // ── Analyze handler (opens inline analysis below the table) ───────────────
  const handleAnalyze = useCallback((row: CoinRow) => {
    setSelectedCoin({ id: row.id, symbol: row.symbol, name: row.name })
    setActiveTab('dashboard')
    setAnalysisOpen(true)
  }, [])

  // ── AI scoring engine over the full 1000-coin dataset (realtime, no hardcode) ──
  const scoredCoins = useMemo<CoinAnalysis[]>(() => {
    if (!rawCoins || rawCoins.length === 0) return []
    return scoreAllCoins(rawCoins)
  }, [rawCoins])

  const coinAnalysis = useMemo<CoinAnalysis | null>(() => {
    if (!selectedCoin) return null
    return scoredCoins.find((c) => c.id === selectedCoin.id) ?? null
  }, [scoredCoins, selectedCoin])

  const handleAnalyzeById = useCallback((id: string) => {
    const coin = rows.find((r) => r.id === id)
    if (coin) handleAnalyze(coin)
  }, [rows, handleAnalyze])

  const handleTimeframeChange = (tfValue: string) => {
    const tf = TIMEFRAME_OPTIONS.find((t) => t.value === tfValue)
    if (tf) {
      setTimeframe(tf.value)
      setDays(tf.days)
    }
  }

  // ── Market overview (realtime, no hardcoding) ─────────────────────────────
  const marketStats = useMemo(() => {
    const stats: Array<{ label: string; value: string; sub: string; color: string }> = []
    if (overview) {
      if (overview.fng != null) {
        stats.push({
          label: 'F&G INDEX',
          value: String(overview.fng),
          sub: overview.fngLabel || '',
          color: overview.fng <= 25 ? '#ef4444' : overview.fng <= 45 ? '#f59e0b' : overview.fng <= 55 ? '#94a3b8' : '#22c55e',
        })
      }
      if (overview.btc?.price) {
        stats.push({ label: 'BTC', value: formatPrice(overview.btc.price), sub: pctText(overview.btc.change24h), color: pctClass(overview.btc.change24h) })
      }
      if (overview.eth?.price) {
        stats.push({ label: 'ETH', value: formatPrice(overview.eth.price), sub: pctText(overview.eth.change24h), color: pctClass(overview.eth.change24h) })
      }
      if (overview.totalMcap) {
        stats.push({ label: 'TOTAL MCAP', value: overview.totalMcapLabel || formatUsd(overview.totalMcap), sub: '', color: '#94a3b8' })
      }
      if (overview.btcDominance != null) {
        stats.push({ label: 'BTC DOM.', value: `${overview.btcDominance.toFixed(1)}%`, sub: '', color: '#94a3b8' })
      }
      if (overview.totalVolume) {
        stats.push({ label: 'VOL 24H', value: overview.totalVolumeLabel || formatUsd(overview.totalVolume), sub: '', color: '#94a3b8' })
      }
      if (overview.activeCryptos) {
        stats.push({ label: 'AKTIF', value: overview.activeCryptos.toLocaleString(), sub: 'coins', color: '#94a3b8' })
      }
    }
    return stats
  }, [overview])

  const displayTimeChange = (row: CoinRow): number => {
    if (time === '1H') return row.h1
    if (time === '7D') return row.d7
    return row.h24
  }

  return (
    <div className="space-y-4">
      {/* Market stats bar (realtime) */}
      <div className="card-glass rounded-xl px-4 py-2 flex items-center gap-6 overflow-x-auto">
        {marketStats.length > 0 ? (
          marketStats.map((m) => (
            <div key={m.label} className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-slate-400">{m.label}</span>
              <span className="text-sm font-semibold text-white">{m.value}</span>
              {m.sub && <span className="text-xs font-medium" style={{ color: m.color }}>{m.sub}</span>}
            </div>
          ))
        ) : (
          <span className="text-xs text-slate-400">Loading market data…</span>
        )}
      </div>

      {/* Time + search + sort filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 card-glass rounded-lg p-1">
          {TIME_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTime(t)}
              className="px-3 py-1 rounded text-xs font-semibold transition-all"
              style={{ background: time === t ? '#3b82f6' : 'transparent', color: time === t ? 'white' : '#64748b' }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex gap-1 card-glass rounded-lg p-1">
          {([['rank', 'MCap Rank'], ['h24', '24H %'], ['volume', 'Volume'], ['mcap', 'MCap']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className="px-3 py-1 rounded text-xs font-semibold transition-all"
              style={{ background: sortKey === key ? 'rgba(255,255,255,0.08)' : 'transparent', color: sortKey === key ? 'white' : '#64748b' }}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          placeholder="Search 1000 coins… (/ to focus)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-slate-300 w-56 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <span className="text-xs text-slate-500">{sorted.length} coins</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.04)] text-xs text-slate-400">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">TOKEN</th>
                  <th className="px-3 py-2 text-right">PRICE</th>
                  <th className="px-3 py-2 text-right text-blue-400">1H%</th>
                  <th className="px-3 py-2 text-right text-blue-400">24H%</th>
                  <th className="px-3 py-2 text-right">7D%</th>
                  <th className="px-3 py-2 text-right">VOLUME</th>
                  <th className="px-3 py-2 text-right">MCAP</th>
                  <th className="px-3 py-2 text-center">ANALYZE</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, i) => {
                  const change = displayTimeChange(row)
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-colors ${i % 2 === 0 ? '' : 'bg-[rgba(255,255,255,0.01)]'}`}
                    >
                      <td className="px-3 py-2.5 text-slate-400">{row.rank}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <CoinIcon symbol={row.symbol} image={row.image} size={28} />
                          <div>
                            <div className="font-medium text-white">{row.name}</div>
                            <div className="text-xs text-slate-400">{row.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatPrice(row.price)}</td>
                      <td className="px-3 py-2.5 text-right text-xs" style={{ color: pctClass(row.h1) }}>{pctText(row.h1)}</td>
                      <td className="px-3 py-2.5 text-right text-xs" style={{ color: pctClass(row.h24) }}>{pctText(row.h24)}</td>
                      <td className="px-3 py-2.5 text-right text-xs" style={{ color: pctClass(row.d7) }}>{pctText(row.d7)}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-300">{formatUsd(row.volumeUsd)}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-300">{formatUsd(row.mcapUsd)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => handleAnalyze(row)}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors whitespace-nowrap ${
                            selectedCoin?.id === row.id && analysisOpen
                              ? 'bg-[rgba(0,240,255,0.25)] text-[#00f0ff] border-[rgba(0,240,255,0.5)]'
                              : 'bg-[rgba(0,240,255,0.10)] text-[#00f0ff] border-[rgba(0,240,255,0.22)] hover:bg-[rgba(0,240,255,0.18)]'
                          }`}
                        >
                          🔍 Analyze
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {pagedRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                      No coins match &ldquo;{query}&rdquo;
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />

      {/* ── Inline Analysis (appears directly below when Analyze is clicked) ── */}
      {analysisOpen && selectedCoin && (
        <div className="card-glass rounded-xl overflow-hidden border border-[rgba(0,240,255,0.15)]">
          <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.04)] flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-lg">📊</span>
              <div>
                <h3 className="font-bold text-sm text-white">
                  {selectedCoin.name} <span className="text-slate-400">({selectedCoin.symbol})</span>
                </h3>
                <p className="text-[10px] text-slate-500">Real-time Hollowcat Smart Money analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {TIMEFRAME_OPTIONS.map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => handleTimeframeChange(tf.value)}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                      timeframe === tf.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAnalysisOpen(false)}
                className="px-2.5 py-1 rounded text-xs font-semibold bg-[rgba(255,255,255,0.04)] text-slate-400 hover:text-white border border-[rgba(255,255,255,0.06)]"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Analysis tab navigation */}
          <div className="border-b border-[rgba(255,255,255,0.04)] bg-[rgba(15,23,42,0.5)]">
            <div className="flex gap-1 overflow-x-auto px-2">
              {ANALYSIS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-400 bg-[rgba(99,102,241,0.05)]'
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-[rgba(255,255,255,0.02)]'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {activeTab === 'rankings' ? (
              <AIRankingsPanel coins={scoredCoins} onAnalyze={handleAnalyzeById} />
            ) : activeTab === 'moon' || activeTab === 'fibonacci' || activeTab === 'futures' || activeTab === 'indicators' || activeTab === 'aiscore' ? (
              coinAnalysis ? (
                <div className="space-y-6">
                  {activeTab === 'moon' && <MoonPhasePanel coin={coinAnalysis} />}
                  {activeTab === 'fibonacci' && <FibonacciPanel coin={coinAnalysis} />}
                  {activeTab === 'futures' && <FuturesPanel coin={coinAnalysis} />}
                  {activeTab === 'indicators' && <IndicatorGuidePanel coin={coinAnalysis} />}
                  {activeTab === 'aiscore' && <AIScorePanel coin={coinAnalysis} />}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                  <span className="ml-3 text-slate-400">
                    Computing AI analysis for {selectedCoin.symbol}…
                  </span>
                </div>
              )
            ) : analysis.isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <span className="ml-3 text-slate-400">
                  Analyzing {selectedCoin.symbol} [{timeframe}]…
                </span>
              </div>
            ) : analysis.isError ? (
              <div className="card-glass rounded-xl p-8 text-center">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-lg font-bold text-slate-300 mb-2">Analysis Unavailable</h3>
                <p className="text-slate-400 text-sm">Unable to fetch analysis for {selectedCoin.symbol}.</p>
                <button
                  onClick={() => analysis.refetch()}
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-[rgba(99,102,241,0.15)] text-indigo-400 border border-[rgba(99,102,241,0.2)] hover:bg-[rgba(99,102,241,0.25)] transition-colors"
                >
                  🔄 Retry
                </button>
              </div>
            ) : analysis.data ? (
              <div className="space-y-6">
                {activeTab === 'dashboard' && <HollowcatDashboard analysis={analysis.data} />}
                {activeTab === 'chart' && <HollowcatChart analysis={analysis.data} />}
                {activeTab === 'signals' && <HollowcatSignals analysis={analysis.data} />}
                {activeTab === 'risk' && <HollowcatRiskPanel analysis={analysis.data} />}
                {activeTab === 'quality' && <HollowcatTradeQuality analysis={analysis.data} />}
                {activeTab === 'entry' && <HollowcatEntryEngine analysis={analysis.data} />}
                {activeTab === 'backtest' && <HollowcatBacktest analysis={analysis.data} />}
                {activeTab === 'alerts' && <HollowcatAlerts analysis={analysis.data} />}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Wallet Flow Graph Section (always scoped to selected coin) */}
      <div className="card-glass rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.04)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔄</span>
            <h3 className="font-bold text-sm">
              Wallet Flow Graph{' '}
              {selectedCoin && <span className="text-[#00f0ff]">· {selectedCoin.name} ({selectedCoin.symbol})</span>}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(34,197,94,0.15)] text-green-400">LIVE</span>
          </div>
          <span className="text-[10px] text-slate-500">
            {selectedCoin ? `Real-time ${selectedCoin.symbol} wallet flows` : 'Select a coin and click Analyze to load its wallet flow'}
          </span>
        </div>
        <div className="p-4">
          <WalletFlowGraph coin={selectedCoin} />
        </div>
      </div>
    </div>
  )
}
