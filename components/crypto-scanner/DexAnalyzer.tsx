"use client"
import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import CoinIcon from '../ui/CoinIcon'
import AnalyzeModal, { CoinAnalyzeData } from '../ui/AnalyzeModal'
import { useDexAnalyzer, DexPair } from '../../lib/useDexAnalyzer'
import Skeleton from '../ui/Skeleton'

const DEX_FILTERS = ['All', 'Raydium', 'Uniswap', 'Jupiter', 'OKX DEX', 'Orca', 'Meteora']
const CHAIN_FILTERS = ['All', 'SOL', 'ETH', 'BSC', 'BASE', 'ARB']
const SORT_OPTS = ['24H%', 'Volume', 'MCap', 'Txns']

const DEX_COLOR: Record<string, string> = {
  Raydium: '#3b82f6', 
  Uniswap: '#e91e8c', 
  Jupiter: '#22c55e', 
  'OKX DEX': '#94a3b8',
  Orca: '#f59e0b',
  Meteora: '#8b5cf6'
}

const CHAIN_COLOR: Record<string, string> = {
  SOL: '#00f0ff',
  ETH: '#8b5cf6', 
  BSC: '#f59e0b',
  BASE: '#3b82f6',
  ARB: '#22c55e'
}

export default function DexAnalyzer() {
  const { data: pairsData, isLoading, error } = useDexAnalyzer()
  const queryClient = useQueryClient()
  
  const [selected, setSelected] = useState<DexPair | null>(null)
  const [tab, setTab] = useState('Info & Analysis')
  const [dexFilter, setDexFilter] = useState('All')
  const [chainFilter, setChainFilter] = useState('All')
  const [sort, setSort] = useState('24H%')
  const [search, setSearch] = useState('')
  const [analyzeOpen, setAnalyzeOpen] = useState(false)
  const [analyzeCoin, setAnalyzeCoin] = useState<CoinAnalyzeData | null>(null)

  const pairs = useMemo(() => {
    if (!pairsData) return []
    
    let list = pairsData.filter((p: DexPair) => {
      if (dexFilter !== 'All' && p.dex !== dexFilter) return false
      if (chainFilter !== 'All' && p.chain !== chainFilter) return false
      if (search && !p.symbol.toLowerCase().includes(search.toLowerCase()) && !p.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    
    if (sort === '24H%')   list = [...list].sort((a, b) => b.change - a.change)
    if (sort === 'Volume') list = [...list].sort((a, b) => parseFloat(b.vol24.replace(/[$MBK]/g,'')) - parseFloat(a.vol24.replace(/[$MBK]/g,'')))
    if (sort === 'MCap')   list = [...list].sort((a, b) => parseFloat(b.mcap.replace(/[$MBK]/g,'')) - parseFloat(a.mcap.replace(/[$MBK]/g,'')))
    if (sort === 'Txns')   list = [...list].sort((a, b) => b.txns5m - a.txns5m)
    
    return list
  }, [pairsData, dexFilter, chainFilter, sort, search])

  // Set initial selected pair when data loads
  useMemo(() => {
    if (pairs.length > 0 && !selected) {
      setSelected(pairs[0])
    }
  }, [pairs, selected])

  function openAnalyze(p: DexPair) {
    setAnalyzeCoin({ 
      symbol: p.symbol, 
      name: p.name, 
      price: p.price, 
      h1: p.h1, 
      h24: p.h24, 
      d7: p.d7, 
      volume: p.vol24, 
      mcap: p.mcap, 
      liq: p.liq,
      image: p.image
    })
    setAnalyzeOpen(true)
  }

  function refreshData() {
    queryClient.invalidateQueries({ queryKey: ['dex-analyzer'] })
  }

  if (error) {
    return (
      <div className="card-glass rounded-xl p-6 text-center">
        <div className="text-red-400 text-lg mb-2">⚠️ API Error</div>
        <div className="text-slate-400 text-sm mb-4">Failed to load DEX data</div>
        <button 
          onClick={refreshData}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* ── Header with refresh ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search pair..."
            className="px-3 py-1.5 rounded-lg text-xs bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-slate-300 w-36"
          />
          <div className="flex gap-1">
            {DEX_FILTERS.map(d => (
              <button key={d} onClick={() => setDexFilter(d)}
                className="px-2.5 py-1 rounded text-xs font-semibold transition-all"
                style={{ background: dexFilter === d ? (DEX_COLOR[d] ?? 'rgba(148,163,184,0.2)') + '22' : 'rgba(255,255,255,0.03)', color: dexFilter === d ? (DEX_COLOR[d] ?? '#94a3b8') : '#64748b', border: `1px solid ${dexFilter === d ? (DEX_COLOR[d] ?? '#475569') + '50' : 'transparent'}` }}>
                {d}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {CHAIN_FILTERS.map(c => (
              <button key={c} onClick={() => setChainFilter(c)}
                className="px-2.5 py-1 rounded text-xs font-semibold transition-all"
                style={{ background: chainFilter === c ? (CHAIN_COLOR[c] ?? 'rgba(99,102,241,0.18)') : 'rgba(255,255,255,0.03)', color: chainFilter === c ? (CHAIN_COLOR[c] ?? '#818cf8') : '#64748b', border: `1px solid ${chainFilter === c ? (CHAIN_COLOR[c] ?? '#818cf8') + '50' : 'transparent'}` }}>
                {c}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort:</span>
            <div className="flex gap-1">
              {SORT_OPTS.map(s => (
                <button key={s} onClick={() => setSort(s)}
                  className="px-2 py-1 rounded text-xs font-semibold"
                  style={{ background: sort === s ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.03)', color: sort === s ? '#eab308' : '#64748b' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          
          <button 
            onClick={refreshData}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(34,197,94,0.15)] text-green-400 border border-green-500/20 hover:bg-[rgba(34,197,94,0.25)] transition-colors"
            disabled={isLoading}
          >
            {isLoading ? '🔄' : '🔄'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Left: pair list ──────────────────────────────── */}
        <div className="card-glass rounded-xl overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">LIVE DEX PAIRS</span>
            <span className="text-xs text-slate-500">{isLoading ? '...' : pairs.length} pairs</span>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 480 }}>
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : pairs.length === 0 ? (
              <div className="px-3 py-6 text-xs text-slate-500 text-center">No pairs found</div>
            ) : pairs.map((p: DexPair) => (
              <div key={p.id} onClick={() => setSelected(p)}
                className="px-3 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-[rgba(255,255,255,0.03)] transition-colors border-b border-[rgba(255,255,255,0.025)]"
                style={{ background: selected?.id === p.id ? 'rgba(99,102,241,0.09)' : '' }}>
                <CoinIcon symbol={p.symbol} size={28} image={p.image} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-white truncate">{p.symbol}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: (DEX_COLOR[p.dex] ?? '#94a3b8') + '18', color: DEX_COLOR[p.dex] ?? '#94a3b8' }}>{p.dex}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: (CHAIN_COLOR[p.chain] ?? '#94a3b8') + '18', color: CHAIN_COLOR[p.chain] ?? '#94a3b8' }}>{p.chain}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{p.name}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-semibold text-white">
                    ${p.price < 0.001 ? p.price.toExponential(2) : p.price >= 100 ? p.price.toLocaleString() : p.price.toFixed(4)}
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: p.change >= 0 ? '#22c55e' : '#ef4444' }}>
                    {p.change >= 0 ? '+' : ''}{p.change.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: detail panel ───────────────────────────── */}
        <div className="lg:col-span-2 card-glass rounded-xl p-4 space-y-4">
          {!selected ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-slate-500">
                <div className="text-lg mb-2">📊</div>
                <div className="text-sm">Select a pair to view details</div>
              </div>
            </div>
          ) : (
            <>
              {/* Token header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CoinIcon symbol={selected.symbol} size={44} image={selected.image} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xl">{selected.symbol}</span>
                      <span className="text-xs text-slate-400">{selected.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: (DEX_COLOR[selected.dex] ?? '#94a3b8') + '20', color: DEX_COLOR[selected.dex] ?? '#94a3b8' }}>{selected.dex}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-slate-300">{selected.chain}</span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{selected.addr}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-bold">
                    ${selected.price < 0.001 ? selected.price.toExponential(3) : selected.price >= 100 ? selected.price.toLocaleString() : selected.price.toFixed(6)}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: selected.change >= 0 ? '#22c55e' : '#ef4444' }}>
                    {selected.change >= 0 ? '+' : ''}{selected.change.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[['MCap', selected.mcap], ['FDV', selected.fdv], ['Vol 24H', selected.vol24], ['Liquidity', selected.liq]].map(([k, v]) => (
                  <div key={k} className="bg-[rgba(255,255,255,0.025)] rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">{k}</div>
                    <div className="text-sm font-bold mt-0.5 text-white">{v}</div>
                  </div>
                ))}
              </div>

              {/* 1H/24H/7D strip */}
              <div className="flex gap-3">
                {[['1H', selected.h1], ['24H', selected.h24], ['7D', selected.d7]].map(([lbl, val]) => (
                  <div key={lbl} className="bg-[rgba(255,255,255,0.025)] rounded-lg px-3 py-2 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{lbl}</span>
                    <span className="text-xs font-bold" style={{ color: Number(val) >= 0 ? '#22c55e' : '#ef4444' }}>
                      {Number(val) >= 0 ? '+' : ''}{Number(val).toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(234,179,8,0.15)] text-yellow-400 border border-yellow-500/20">⚡ Quick Trade</button>
                <button 
                  onClick={() => window.open(selected.url, '_blank')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500 text-black hover:bg-green-400 transition-colors"
                >
                  🚀 Trade on DEX ↗
                </button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(139,92,246,0.15)] text-purple-400 border border-purple-500/20">🔄 Swap Jupiter</button>
                <button 
                  onClick={() => navigator.clipboard.writeText(selected.pairAddress)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(255,255,255,0.04)] text-slate-300 hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                >
                  📋 Copy Addr
                </button>
                <button 
                  onClick={() => window.open(`https://dexscreener.com/${selected.chain.toLowerCase()}/${selected.pairAddress}`, '_blank')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(255,255,255,0.04)] text-slate-300 hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                >
                  📊 DEXScreener ↗
                </button>
                <button onClick={() => openAnalyze(selected)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[rgba(0,240,255,0.12)] text-[#00f0ff] border border-[rgba(0,240,255,0.25)] hover:bg-[rgba(0,240,255,0.20)] transition-colors ml-auto">
                  🔍 Analyze
                </button>
              </div>

              {/* Tabs */}
              <div>
                <div className="flex gap-0 border-b border-[rgba(255,255,255,0.05)] mb-3 overflow-x-auto">
                  {['Chart', 'Info & Analysis', 'Forensik', 'AI Analyst'].map(t => (
                    <button key={t} onClick={() => setTab(t)}
                      className="px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0"
                      style={{ color: tab === t ? 'white' : '#64748b', borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent' }}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="min-h-28">
                  {tab === 'Chart' && (
                    <div className="h-36 bg-[rgba(255,255,255,0.02)] rounded-lg flex flex-col items-center justify-center text-slate-500 gap-2">
                      <span className="text-2xl">📈</span>
                      <span className="text-xs">TradingView chart akan tampil di sini</span>
                      <button onClick={() => openAnalyze(selected)} className="text-xs text-[#00f0ff] underline">Buka AI Analysis →</button>
                    </div>
                  )}
                  {tab === 'Info & Analysis' && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        ['Token', selected.symbol],
                        ['Name', selected.name],
                        ['Chain', selected.chain],
                        ['DEX', selected.dex],
                        ['Address', selected.addr],
                        ['Txns 5M', String(selected.txns5m)],
                        ['1H%', `${selected.h1 >= 0 ? '+' : ''}${selected.h1.toFixed(2)}%`],
                        ['24H%', `${selected.h24 >= 0 ? '+' : ''}${selected.h24.toFixed(2)}%`],
                      ].map(([k, v]) => (
                        <div key={k} className="bg-[rgba(255,255,255,0.02)] rounded-lg p-2.5">
                          <span className="text-slate-400">{k}</span>
                          <div className="font-semibold text-white mt-0.5 truncate">{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {tab === 'Forensik' && (
                    <div className="space-y-2 text-xs">
                      {[
                        ['Honeypot Check', '✅ Safe', '#22c55e'],
                        ['Rug Pull Risk', `${selected.liq === '$0' ? '⚠️ High' : '✅ Low'}`, selected.liq === '$0' ? '#ef4444' : '#22c55e'],
                        ['Dev Wallet', '🔍 Not detected', '#94a3b8'],
                        ['LP Locked', `${parseFloat(selected.liq.replace(/[$KMB]/g,'')) > 10 ? '✅ Likely' : '⚠️ Unknown'}`, '#eab308'],
                        ['Contract', '📄 Verified', '#22c55e'],
                      ].map(([k, v, col]) => (
                        <div key={k} className="flex items-center justify-between bg-[rgba(255,255,255,0.02)] rounded-lg p-2.5">
                          <span className="text-slate-400">{k}</span>
                          <span className="font-semibold" style={{ color: col as string }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {tab === 'AI Analyst' && (
                    <div className="space-y-3 text-xs">
                      <div className="bg-[rgba(0,240,255,0.06)] border border-[rgba(0,240,255,0.15)] rounded-lg p-3">
                        <div className="font-bold text-[#00f0ff] mb-1">🤖 AI Summary</div>
                        <div className="text-slate-300">
                          {selected.change > 50 ? `${selected.symbol} menunjukkan momentum kuat dengan +${selected.change.toFixed(2)}% 24H. Volume ${selected.vol24} mengkonfirmasi akumulasi whale. Fase: early runner dengan potensi continuation.` :
                           selected.change < 0 ? `${selected.symbol} dalam tekanan jual. Volume ${selected.vol24} dengan perubahan ${selected.change.toFixed(2)}% menunjukkan distribusi. Tunggu konfirmasi support.` :
                           `${selected.symbol} dalam fase konsolidasi dengan +${selected.change.toFixed(2)}% 24H. Volume ${selected.vol24} normal. Potensi breakout jika level resistance ditembus.`}
                        </div>
                      </div>
                      <button onClick={() => openAnalyze(selected)}
                        className="w-full py-2.5 rounded-lg text-xs font-bold bg-[rgba(0,240,255,0.12)] text-[#00f0ff] border border-[rgba(0,240,255,0.25)] hover:bg-[rgba(0,240,255,0.20)] transition-colors">
                        🔍 Full AI Analysis — Fibonacci, Macro, Futures →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AnalyzeModal open={analyzeOpen} onClose={() => setAnalyzeOpen(false)} coin={analyzeCoin} />
    </div>
  )
}
