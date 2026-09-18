"use client"
import { useState, useMemo } from 'react'
import Skeleton from '../ui/Skeleton'
import Pagination from '../ui/Pagination'

interface Pool {
  id: string
  name: string
  apr: number
  tvl: number
  volume24h: number
  fees: number
  blockchain: string
  pair: string
}

export default function DLMMPoolScanner() {
  const [loading] = useState(false)
  const [sortBy, setSortBy] = useState<'apr' | 'tvl' | 'volume' | 'fees'>('apr')
  const [filterBlockchain, setFilterBlockchain] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Mock pools data
  const mockPools: Pool[] = [
    { id: '1', name: 'SOL-USDC', pair: 'SOL/USDC', apr: 28.5, tvl: 42300000, volume24h: 2100000, fees: 185000, blockchain: 'Solana' },
    { id: '2', name: 'JUP-SOL', pair: 'JUP/SOL', apr: 35.2, tvl: 38700000, volume24h: 1800000, fees: 165000, blockchain: 'Solana' },
    { id: '3', name: 'ORCA-SOL', pair: 'ORCA/SOL', apr: 31.1, tvl: 35200000, volume24h: 1500000, fees: 142000, blockchain: 'Solana' },
    { id: '4', name: 'RAY-SOL', pair: 'RAY/SOL', apr: 26.8, tvl: 28900000, volume24h: 1200000, fees: 128000, blockchain: 'Solana' },
    { id: '5', name: 'COPE-USDC', pair: 'COPE/USDC', apr: 42.5, tvl: 24600000, volume24h: 890000, fees: 98000, blockchain: 'Solana' },
    { id: '6', name: 'MSOL-SOL', pair: 'MSOL/SOL', apr: 18.3, tvl: 21500000, volume24h: 756000, fees: 82000, blockchain: 'Solana' },
    { id: '7', name: 'USDT-USDC', pair: 'USDT/USDC', apr: 12.1, tvl: 19800000, volume24h: 654000, fees: 71000, blockchain: 'Solana' },
    { id: '8', name: 'BONK-SOL', pair: 'BONK/SOL', apr: 48.2, tvl: 18300000, volume24h: 523000, fees: 65000, blockchain: 'Solana' },
    { id: '9', name: 'WEN-SOL', pair: 'WEN/SOL', apr: 55.7, tvl: 15600000, volume24h: 412000, fees: 48000, blockchain: 'Solana' },
    { id: '10', name: 'RNDR-SOL', pair: 'RNDR/SOL', apr: 22.4, tvl: 14200000, volume24h: 389000, fees: 42000, blockchain: 'Solana' },
  ]

  // Filter and sort pools
  const filteredPools = useMemo(() => {
    let result = mockPools

    // Apply search
    if (searchQuery) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.pair.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply blockchain filter
    if (filterBlockchain !== 'all') {
      result = result.filter(p => p.blockchain === filterBlockchain)
    }

    // Apply sorting
    switch (sortBy) {
      case 'apr':
        result.sort((a, b) => b.apr - a.apr)
        break
      case 'tvl':
        result.sort((a, b) => b.tvl - a.tvl)
        break
      case 'volume':
        result.sort((a, b) => b.volume24h - a.volume24h)
        break
      case 'fees':
        result.sort((a, b) => b.fees - a.fees)
        break
    }

    return result
  }, [sortBy, filterBlockchain, searchQuery])

  const totalPages = Math.ceil(filteredPools.length / pageSize)
  const pagedPools = useMemo(() => 
    filteredPools.slice((page - 1) * pageSize, page * pageSize),
    [filteredPools, page]
  )

  if (loading) {
    return <Skeleton className="h-[500px] w-full rounded-xl" />
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card-glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <img src="/assets/ic_chart.svg" alt="filter" className="w-5 h-5" />
          <h3 className="font-semibold">Filters & Search</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search by token name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            className="rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-sm text-slate-200 placeholder-slate-500"
          />

          {/* Blockchain Filter */}
          <select
            value={filterBlockchain}
            onChange={(e) => {
              setFilterBlockchain(e.target.value)
              setPage(1)
            }}
            className="rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-sm text-slate-200"
          >
            <option value="all">All Blockchains</option>
            <option value="Solana">Solana</option>
            <option value="Polygon">Polygon</option>
          </select>

          {/* Sort by APR */}
          <button
            onClick={() => {
              setSortBy('apr')
              setPage(1)
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
              sortBy === 'apr'
                ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
            }`}
          >
            Sort: APR ↓
          </button>

          {/* Sort by TVL */}
          <button
            onClick={() => {
              setSortBy('tvl')
              setPage(1)
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
              sortBy === 'tvl'
                ? 'bg-green-500/20 border border-green-400/50 text-green-300'
                : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
            }`}
          >
            Sort: TVL ↓
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Sort by Volume */}
          <button
            onClick={() => {
              setSortBy('volume')
              setPage(1)
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
              sortBy === 'volume'
                ? 'bg-amber-500/20 border border-amber-400/50 text-amber-300'
                : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
            }`}
          >
            Sort: Volume ↓
          </button>

          {/* Sort by Fees */}
          <button
            onClick={() => {
              setSortBy('fees')
              setPage(1)
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
              sortBy === 'fees'
                ? 'bg-pink-500/20 border border-pink-400/50 text-pink-300'
                : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
            }`}
          >
            Sort: Fees ↓
          </button>

          <div className="text-xs text-slate-400 flex items-center">
            Results: {filteredPools.length} pools
          </div>
        </div>
      </div>

      {/* Pools Table */}
      <div className="card-glass rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-600/30">
              <th className="text-left py-3 px-2 text-slate-300">Pool</th>
              <th className="text-right py-3 px-2 text-slate-300">APR</th>
              <th className="text-right py-3 px-2 text-slate-300">TVL</th>
              <th className="text-right py-3 px-2 text-slate-300">Vol 24H</th>
              <th className="text-right py-3 px-2 text-slate-300">Fees</th>
              <th className="text-center py-3 px-2 text-slate-300">Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedPools.map((pool) => (
              <tr key={pool.id} className="border-b border-slate-600/20 hover:bg-[rgba(255,255,255,0.02)] transition">
                <td className="py-3 px-2 font-semibold text-slate-100">{pool.name}</td>
                <td className="text-right py-3 px-2">
                  <span className="text-green-400 font-bold">{pool.apr.toFixed(1)}%</span>
                </td>
                <td className="text-right py-3 px-2 text-slate-300">
                  ${(pool.tvl / 1000000).toFixed(1)}M
                </td>
                <td className="text-right py-3 px-2 text-slate-300">
                  ${(pool.volume24h / 1000000).toFixed(2)}M
                </td>
                <td className="text-right py-3 px-2 text-amber-400">
                  ${(pool.fees / 1000).toFixed(0)}K
                </td>
                <td className="text-center py-3 px-2">
                  <button className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs font-semibold hover:bg-blue-500/30 transition">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
