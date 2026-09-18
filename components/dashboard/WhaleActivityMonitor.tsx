"use client"

// Token Scanner Grid — Home page's filterable/searchable token table.
// Ported from the user's legacy crypto-scanner reference project (dex-style
// filter bar + table: timeframe tabs, quick filters, search, an AI Rank sort
// toggle, and per-row AGE/LIQUIDITY/FIB/SIGNAL/FUTURES/WHALE columns) so it
// matches that project's look instead of a plain volume-anomaly table.

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFuturesAnalysis } from '../crypto-scanner/FuturesAnalysis'
import {
  getTradingSignal,
  getAgeLabel,
  getLiquidityLabel,
  getWhaleActivityLabel,
  getFibLevelBadge,
  formatLargeNumber,
  formatPercentage,
} from '../../lib/tokenGridHelpers'
import { useHollowcatAnalysis } from '../../lib/realTimeHooks'
import { scoreAllCoins, CoinAnalysis } from '../../lib/cryptoScannerAnalysis'
import WalletFlowGraph from '../crypto-scanner/WalletFlowGraph'
import HollowcatDashboard from '../hollowcat/HollowcatDashboard'
import HollowcatChart from '../hollowcat/HollowcatChart'
import HollowcatSignals from '../hollowcat/HollowcatSignals'
import HollowcatRiskPanel from '../hollowcat/HollowcatRiskPanel'
import HollowcatTradeQuality from '../hollowcat/HollowcatTradeQuality'
import HollowcatEntryEngine from '../hollowcat/HollowcatEntryEngine'
import HollowcatBacktest from '../hollowcat/HollowcatBacktest'
import HollowcatAlerts from '../hollowcat/HollowcatAlerts'
import {
  MoonPhasePanel,
  FibonacciPanel,
  FuturesPanel,
  IndicatorGuidePanel,
  AIScorePanel,
  AIRankingsPanel,
} from '../crypto-scanner/ScannerAnalysisPanels'

const TIMEFRAME_OPTIONS = [
  { value: '15m', label: '15M', days: '1' },
  { value: '30m', label: '30M', days: '2' },
  { value: '1h', label: '1H', days: '7' },
  { value: '4h', label: '4H', days: '30' },
  { value: '1d', label: '1D', days: '90' },
  { value: '7d', label: '7D', days: '180' },
]

const ANALYSIS_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '/assets/ic_dashboard.svg' },
  { id: 'chart', label: 'Chart', icon: '/assets/ic_chart.svg' },
  { id: 'signals', label: 'Signals', icon: '/assets/ic_fingerprint.svg' },
  { id: 'risk', label: 'Risk', icon: '/assets/ic_rules.svg' },
  { id: 'quality', label: 'Quality', icon: '/assets/ic_correct.svg' },
  { id: 'entry', label: 'Entry', icon: '/assets/ic_run.svg' },
  { id: 'backtest', label: 'Backtest', icon: '/assets/ic_performance.svg' },
  { id: 'alerts', label: 'Alerts', icon: '/assets/ic_send.svg' },
  { id: 'moon', label: 'Moon Phase', icon: '/assets/ic_moon.svg' },
  { id: 'fibonacci', label: 'Fibonacci', icon: '/assets/ic_abstract.svg' },
  { id: 'futures', label: 'Futures', icon: '/assets/ic_automation.svg' },
  { id: 'indicators', label: 'Indicators', icon: '/assets/ic_monitoring.svg' },
  { id: 'aiscore', label: 'AI Score', icon: '/assets/ic_ai.svg' },
  { id: 'rankings', label: 'AI Rankings', icon: '/assets/ic_stars.svg' },
] as const

interface SelectedCoin {
  id: string
  symbol: string
  name: string
}

type Timeframe = '1h' | '24h' | '7d'
type QuickFilter = 'all' | 'trending' | 'gainers' | 'losers' | 'whale' | 'long' | 'short' | 'favorites'
type SortCol = 'mcap' | 'price' | '1h' | '24h' | '7d' | 'volume' | 'liquidity'

const FAV_KEY = 'wr-token-scanner-favorites'

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// Truncated page-number list: 1 2 3 … 8, keeping the current page centered.
function getPageList(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

export default function WhaleActivityMonitor() {
  const [timeframe, setTimeframe] = useState<Timeframe>('24h')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('mcap')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [aiRank, setAiRank] = useState(false)
  const [page, setPage] = useState(1)
  const [favorites, setFavorites] = useState<string[]>([])
  const pageSize = 20

  const [selectedCoin, setSelectedCoin] = useState<SelectedCoin | null>(null)
  const [activeTab, setActiveTab] = useState<string>('dashboard')
  const [analysisTimeframe, setAnalysisTimeframe] = useState('1h')
  const [analysisDays, setAnalysisDays] = useState('7')
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const analysis = useHollowcatAnalysis(selectedCoin, analysisTimeframe, analysisDays, analysisOpen)

  useEffect(() => {
    setFavorites(loadFavorites())
  }, [])

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['token-scanner-grid'],
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

  const coins = data || []

  const scoredCoins = useMemo<CoinAnalysis[]>(() => {
    if (!coins.length) return []
    return scoreAllCoins(coins)
  }, [coins])

  const coinAnalysis = useMemo<CoinAnalysis | null>(() => {
    if (!selectedCoin) return null
    return scoredCoins.find((c) => c.id === selectedCoin.id) ?? null
  }, [scoredCoins, selectedCoin])

  const handleAnalyze = useCallback((coin: any) => {
    setSelectedCoin({ id: coin.id, symbol: (coin.symbol || '').toUpperCase(), name: coin.name })
    setActiveTab('dashboard')
    setAnalysisOpen(true)
  }, [])

  const handleAnalyzeById = useCallback((id: string) => {
    const coin = coins.find((c: any) => c.id === id)
    if (coin) handleAnalyze(coin)
  }, [coins, handleAnalyze])

  function handleAnalysisTimeframeChange(tfValue: string) {
    const tf = TIMEFRAME_OPTIONS.find((t) => t.value === tfValue)
    if (tf) {
      setAnalysisTimeframe(tf.value)
      setAnalysisDays(tf.days)
    }
  }

  // Deliberate simplification of the reference's separate "AI Coin Scoring"
  // section: instead of building a whole extra section, the AI Rank toggle
  // sorts by a lightweight composite of the futures-analysis score + 7D
  // momentum — a proxy for "how decisive is this coin's setup right now".
  function quickAiScore(coin: any): number {
    const f = getFuturesAnalysis(coin)
    const ch7d = coin.price_change_percentage_7d_in_currency || 0
    return Math.abs(f.score) * 8 + Math.abs(ch7d) * 0.3
  }

  const filtered = useMemo(() => {
    let list = [...coins]

    if (search.trim()) {
      const t = search.trim().toLowerCase()
      list = list.filter((c) => c.name?.toLowerCase().includes(t) || c.symbol?.toLowerCase().includes(t))
    }

    switch (quickFilter) {
      case 'trending':
        list = list.filter((c) => Math.abs(c.price_change_percentage_24h || 0) > 5 && c.total_volume / (c.market_cap || 1) > 0.08)
        list.sort((a, b) => Math.abs(b.price_change_percentage_24h || 0) - Math.abs(a.price_change_percentage_24h || 0))
        break
      case 'gainers':
        list = list.filter((c) => (c.price_change_percentage_24h || 0) > 0)
        list.sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0))
        break
      case 'losers':
        list = list.filter((c) => (c.price_change_percentage_24h || 0) < 0)
        list.sort((a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0))
        break
      case 'whale':
        list = list.filter((c) => c.total_volume / (c.market_cap || 1) > 0.15)
        list.sort((a, b) => b.total_volume / (b.market_cap || 1) - a.total_volume / (a.market_cap || 1))
        break
      case 'long':
        list = list.filter((c) => getFuturesAnalysis(c).direction.startsWith('long'))
        break
      case 'short':
        list = list.filter((c) => getFuturesAnalysis(c).direction.startsWith('short'))
        break
      case 'favorites':
        list = list.filter((c) => favorites.includes(c.id))
        break
    }

    if (aiRank) {
      list.sort((a, b) => quickAiScore(b) - quickAiScore(a))
    } else {
      list.sort((a, b) => {
        let va = 0
        let vb = 0
        switch (sortCol) {
          case 'price': va = a.current_price; vb = b.current_price; break
          case '1h': va = a.price_change_percentage_1h_in_currency || 0; vb = b.price_change_percentage_1h_in_currency || 0; break
          case '24h': va = a.price_change_percentage_24h || 0; vb = b.price_change_percentage_24h || 0; break
          case '7d': va = a.price_change_percentage_7d_in_currency || 0; vb = b.price_change_percentage_7d_in_currency || 0; break
          case 'volume': va = a.total_volume || 0; vb = b.total_volume || 0; break
          case 'liquidity': va = a.market_cap ? a.total_volume / a.market_cap : 0; vb = b.market_cap ? b.total_volume / b.market_cap : 0; break
          default: va = a.market_cap_rank || 999; vb = b.market_cap_rank || 999; return sortDir === 'asc' ? va - vb : vb - va
        }
        return sortDir === 'asc' ? va - vb : vb - va
      })
    }

    return list
  }, [coins, search, quickFilter, sortCol, sortDir, aiRank, favorites])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  function handleSort(col: SortCol) {
    setAiRank(false)
    if (sortCol === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
    setPage(1)
  }

  function handleTimeframe(tf: Timeframe) {
    setTimeframe(tf)
    if (['1h', '24h', '7d'].includes(sortCol)) {
      setSortCol(tf)
      setSortDir('desc')
    }
  }

  const quickFilters: { key: QuickFilter; label: string }[] = [
    { key: 'all', label: '🌐 All' },
    { key: 'trending', label: '🔥 Trending' },
    { key: 'gainers', label: '↑ Gainers' },
    { key: 'losers', label: '↓ Losers' },
    { key: 'whale', label: '🐋 Whale' },
    { key: 'long', label: '✅ Long' },
    { key: 'short', label: '❌ Short' },
    { key: 'favorites', label: '⭐ Watchlist' },
  ]

  const sortArrow = (col: SortCol) => (sortCol === col && !aiRank ? (sortDir === 'desc' ? '↓' : '↑') : '↕')
  const pageList = getPageList(page, totalPages)

  return (
    <div className="tsg-wrap">
      <div className="tsg-heading">
        <div className="tsg-title">Live Market Scanner</div>
        <span style={{ fontSize: '11px', color: '#334155' }}>
          {isFetching ? 'Memuat…' : `${filtered.length} token`}
        </span>
      </div>
      <div className="tsg-subtitle">Filter, cari, dan urutkan token — sinyal &amp; futures dihitung real-time dari data CoinGecko.</div>

      <div className="tsg-filter-bar">
        <div className="tsg-filter-left">
          <div className="tsg-tf-group">
            {(['1h', '24h', '7d'] as Timeframe[]).map((tf) => (
              <button key={tf} className={`tsg-tf-btn ${timeframe === tf ? 'active' : ''}`} onClick={() => handleTimeframe(tf)}>
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="tsg-qf-group">
            {quickFilters.map((qf) => (
              <button
                key={qf.key}
                className={`tsg-qf-btn ${quickFilter === qf.key ? 'active' : ''}`}
                onClick={() => { setQuickFilter(qf.key); setPage(1) }}
              >
                {qf.label}
              </button>
            ))}
          </div>
        </div>
        <div className="tsg-filter-right">
          <div className="tsg-search-wrap">
            <span className="tsg-search-icon">🔍</span>
            <input
              className="tsg-search-input"
              placeholder="Search token..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <button className={`tsg-ai-btn ${aiRank ? 'active' : ''}`} onClick={() => setAiRank((v) => !v)}>
            ✨ AI Rank
          </button>
          <button className="tsg-refresh-btn" onClick={() => refetch()} title="Refresh">↻</button>
        </div>
      </div>

      <div className="tsg-table-wrap">
        <table className="tsg-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}>⭐</th>
              <th style={{ width: 30 }}>#</th>
              <th className="tsg-left" style={{ minWidth: 140 }}>TOKEN</th>
              <th className="tsg-sortable" onClick={() => handleSort('price')}>PRICE <span className="tsg-sort-arrow">{sortArrow('price')}</span></th>
              <th>AGE</th>
              <th className={`tsg-sortable ${sortCol === '1h' && !aiRank ? 'tsg-active-sort' : ''}`} onClick={() => handleSort('1h')}>1H% <span className="tsg-sort-arrow">{sortArrow('1h')}</span></th>
              <th className={`tsg-sortable ${sortCol === '24h' && !aiRank ? 'tsg-active-sort' : ''}`} onClick={() => handleSort('24h')}>24H% <span className="tsg-sort-arrow">{sortArrow('24h')}</span></th>
              <th className={`tsg-sortable ${sortCol === '7d' && !aiRank ? 'tsg-active-sort' : ''}`} onClick={() => handleSort('7d')}>7D% <span className="tsg-sort-arrow">{sortArrow('7d')}</span></th>
              <th className="tsg-sortable" onClick={() => handleSort('volume')}>VOLUME <span className="tsg-sort-arrow">{sortArrow('volume')}</span></th>
              <th className="tsg-sortable" onClick={() => handleSort('mcap')}>MCAP <span className="tsg-sort-arrow">{sortArrow('mcap')}</span></th>
              <th className="tsg-sortable" onClick={() => handleSort('liquidity')}>LIQUIDITY <span className="tsg-sort-arrow">{sortArrow('liquidity')}</span></th>
              <th title="Fibonacci Retracement/Extension">FIB ℹ</th>
              <th className="tsg-left" style={{ minWidth: 120 }}>SIGNAL</th>
              <th>⚡ FUTURES</th>
              <th>WHALE</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr><td colSpan={15} className="tsg-empty">Gagal memuat data market.</td></tr>
            ) : isLoading ? (
              <tr><td colSpan={15} className="tsg-loading">Memuat token…</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={15} className="tsg-empty">Tidak ada token yang cocok dengan filter.</td></tr>
            ) : (
              paged.map((coin, i) => {
                const isFav = favorites.includes(coin.id)
                const signal = getTradingSignal(coin)
                const futures = getFuturesAnalysis(coin)
                const isLong = futures.direction.startsWith('long')
                const age = getAgeLabel(coin)
                const fib = getFibLevelBadge(coin)
                const ch1h = coin.price_change_percentage_1h_in_currency
                const ch24h = coin.price_change_percentage_24h
                const ch7d = coin.price_change_percentage_7d_in_currency

                return (
                  <tr key={coin.id}>
                    <td>
                      <button className={`tsg-btn-fav ${isFav ? 'active' : ''}`} onClick={() => toggleFavorite(coin.id)}>★</button>
                    </td>
                    <td style={{ color: '#64748b' }}>{(page - 1) * pageSize + i + 1}</td>
                    <td className="tsg-left">
                      <div className="tsg-token-cell">
                        <img
                          src={coin.image} alt={coin.symbol} className="tsg-token-img"
                          onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
                        />
                        <div className="tsg-token-names">
                          <span className="tsg-token-name">{coin.name}</span>
                          <span className="tsg-token-sym">{coin.symbol?.toUpperCase()}</span>
                        </div>
                      </div>
                    </td>
                    <td>${coin.current_price?.toLocaleString('en-US', { maximumFractionDigits: coin.current_price < 1 ? 6 : 2 })}</td>
                    <td><span className={age.cls}>{age.text}</span></td>
                    <td className={ch1h > 0 ? 'tsg-positive' : ch1h < 0 ? 'tsg-negative' : ''}>{formatPercentage(ch1h)}</td>
                    <td className={ch24h > 0 ? 'tsg-positive' : ch24h < 0 ? 'tsg-negative' : ''}>{formatPercentage(ch24h)}</td>
                    <td className={ch7d > 0 ? 'tsg-positive' : ch7d < 0 ? 'tsg-negative' : ''}>{formatPercentage(ch7d)}</td>
                    <td>${formatLargeNumber(coin.total_volume)}</td>
                    <td>${formatLargeNumber(coin.market_cap)}</td>
                    <td><span className="tsg-liq-label">{getLiquidityLabel(coin)}</span></td>
                    <td>
                      {fib ? <span className={`tsg-fib-badge ${fib.cls} ${fib.near ? 'near' : ''}`} title={fib.title}>{fib.text}</span> : '—'}
                    </td>
                    <td className="tsg-left">
                      <div className={`tsg-signal-badge tsg-signal-${signal.type}`}>
                        {signal.label}
                        <span className="tsg-signal-hint">{signal.hint}</span>
                      </div>
                    </td>
                    <td>
                      {futures.isNeutral ? (
                        <span className="tsg-futures-badge tsg-futures-neutral">⚪ —</span>
                      ) : (
                        <span className={`tsg-futures-badge ${isLong ? 'tsg-futures-long' : 'tsg-futures-short'}`}>
                          {futures.dirEmoji} {isLong ? 'L' : 'S'} {futures.leverage}×
                        </span>
                      )}
                    </td>
                    <td><span className="tsg-whale-label">{getWhaleActivityLabel(coin)}</span></td>
                    <td>
                      <button
                        className={`tsg-action-btn ${selectedCoin?.id === coin.id && analysisOpen ? 'active' : ''}`}
                        onClick={() => handleAnalyze(coin)}
                      >
                        🔍 Analyze
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > pageSize && (
        <div className="tsg-pagination">
          <button className="tsg-page-btn" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
          <div className="tsg-page-numbers">
            {pageList.map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="tsg-page-ellipsis">…</span>
              ) : (
                <button
                  key={p}
                  className={`tsg-page-btn tsg-page-num ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}
          </div>
          <button className="tsg-page-btn" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
        </div>
      )}

      {/* Inline Analysis — appears below the grid when Analyze is clicked */}
      {analysisOpen && selectedCoin && (
        <div className="tsg-analysis-panel">
          <div className="tsg-analysis-header">
            <div className="flex items-center gap-3">
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
                    onClick={() => handleAnalysisTimeframeChange(tf.value)}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                      analysisTimeframe === tf.value
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

          <div className="border-b border-[rgba(255,255,255,0.04)] bg-[rgba(15,23,42,0.5)]">
            <div className="flex gap-1 overflow-x-auto px-2">
              {ANALYSIS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-400 bg-[rgba(99,102,241,0.05)]'
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-[rgba(255,255,255,0.02)]'
                  }`}
                >
                  <img src={tab.icon} alt="" className="w-3.5 h-3.5 opacity-80" />
                  {tab.label}
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
                  <span className="ml-3 text-slate-400">Computing AI analysis for {selectedCoin.symbol}…</span>
                </div>
              )
            ) : analysis.isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <span className="ml-3 text-slate-400">Analyzing {selectedCoin.symbol} [{analysisTimeframe}]…</span>
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

          <div className="border-t border-[rgba(255,255,255,0.04)]">
            <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.04)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">
                  Wallet Flow Graph <span className="text-[#00f0ff]">· {selectedCoin.name} ({selectedCoin.symbol})</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(34,197,94,0.15)] text-green-400">LIVE</span>
              </div>
            </div>
            <div className="p-4">
              <WalletFlowGraph coin={selectedCoin} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
