"use client"

// Token Scanner Grid — Home page's filterable/searchable token table.
// Ported from the user's legacy crypto-scanner reference project (dex-style
// filter bar + table: timeframe tabs, quick filters, search, an AI Rank sort
// toggle, and per-row AGE/LIQUIDITY/FIB/SIGNAL/FUTURES/WHALE columns) so it
// matches that project's look instead of a plain volume-anomaly table.

import { useEffect, useMemo, useState } from 'react'
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

  return (
    <div className="tsg-wrap">
      <div className="tsg-heading">
        <div className="tsg-title">📊 Live Market Scanner</div>
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
                      <a
                        className="tsg-action-btn"
                        href={`https://www.tradingview.com/chart/?symbol=${coin.symbol?.toUpperCase()}USDT`}
                        target="_blank" rel="noopener noreferrer"
                      >
                        📈 Chart
                      </a>
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
          <button className="tsg-page-btn" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
          <span className="tsg-page-info">Page {page} of {totalPages}</span>
          <button className="tsg-page-btn" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
        </div>
      )}
    </div>
  )
}
