"use client"
import { useState, useMemo } from 'react'
import Pagination from '../ui/Pagination'

interface AirdropScan {
  id: string
  name: string
  blockchain: string
  status: 'Active' | 'Upcoming' | 'Snapshot Soon' | 'Ended'
  difficulty: 'Easy' | 'Medium' | 'Hard'
  reward: number
  cost: number
  roi: number
  deadline: string
  url?: string
}

const SCAN_DATA: AirdropScan[] = [
  { id: '1', name: 'Uniswap V4', blockchain: 'Ethereum', status: 'Active', difficulty: 'Medium', reward: 1250, cost: 50, roi: 2400, deadline: '10 days', url: 'uniswap.org' },
  { id: '2', name: 'Arbitrum', blockchain: 'Arbitrum', status: 'Active', difficulty: 'Easy', reward: 750, cost: 100, roi: 650, deadline: '15 days' },
  { id: '3', name: 'Optimism', blockchain: 'Optimism', status: 'Snapshot Soon', difficulty: 'Medium', reward: 450, cost: 75, roi: 500, deadline: '3 days' },
  { id: '4', name: 'Base', blockchain: 'Base', status: 'Active', difficulty: 'Hard', reward: 1500, cost: 200, roi: 650, deadline: '20 days' },
  { id: '5', name: 'Linea', blockchain: 'Ethereum', status: 'Active', difficulty: 'Easy', reward: 525, cost: 60, roi: 775, deadline: '12 days' },
  { id: '6', name: 'Starknet', blockchain: 'StarkNet', status: 'Upcoming', difficulty: 'Hard', reward: 2000, cost: 150, roi: 1233, deadline: '25 days' },
  { id: '7', name: 'Polygon', blockchain: 'Polygon', status: 'Active', difficulty: 'Medium', reward: 1200, cost: 120, roi: 900, deadline: '18 days' },
  { id: '8', name: 'Scrolly', blockchain: 'Scroll', status: 'Active', difficulty: 'Easy', reward: 650, cost: 80, roi: 712, deadline: '8 days' },
  { id: '9', name: 'Zksync', blockchain: 'zkSync', status: 'Active', difficulty: 'Hard', reward: 1800, cost: 180, roi: 900, deadline: '22 days' },
  { id: '10', name: 'Sui', blockchain: 'Sui', status: 'Upcoming', difficulty: 'Medium', reward: 950, cost: 110, roi: 763, deadline: '30 days' },
]

export default function AirdropScanner() {
  const [blockchainFilter, setBlockchainFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('')
  const [rewardRange, setRewardRange] = useState([0, 3000])
  const [costRange, setCostRange] = useState([0, 500])
  const [sortBy, setSortBy] = useState<'roi' | 'reward' | 'cost' | 'deadline'>('roi')
  const [page, setPage] = useState(1)
  const pageSize = 8

  const blockchains = Array.from(new Set(SCAN_DATA.map(d => d.blockchain)))
  const statuses = Array.from(new Set(SCAN_DATA.map(d => d.status)))
  const difficulties = Array.from(new Set(SCAN_DATA.map(d => d.difficulty)))

  const filtered = useMemo(() => {
    let result = SCAN_DATA.filter((item) => {
      if (blockchainFilter && item.blockchain !== blockchainFilter) return false
      if (statusFilter && item.status !== statusFilter) return false
      if (difficultyFilter && item.difficulty !== difficultyFilter) return false
      if (item.reward < rewardRange[0] || item.reward > rewardRange[1]) return false
      if (item.cost < costRange[0] || item.cost > costRange[1]) return false
      return true
    })

    result.sort((a, b) => {
      switch (sortBy) {
        case 'roi':
          return b.roi - a.roi
        case 'reward':
          return b.reward - a.reward
        case 'cost':
          return a.cost - b.cost
        case 'deadline':
          return parseInt(a.deadline) - parseInt(b.deadline)
        default:
          return 0
      }
    })

    return result
  }, [blockchainFilter, statusFilter, difficultyFilter, rewardRange, costRange, sortBy])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-500/20 text-green-400'
      case 'Upcoming':
        return 'bg-blue-500/20 text-blue-400'
      case 'Snapshot Soon':
        return 'bg-amber-500/20 text-amber-400'
      case 'Ended':
        return 'bg-slate-500/20 text-slate-400'
      default:
        return 'bg-slate-500/20 text-slate-400'
    }
  }

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Easy':
        return 'text-green-400 bg-green-500/10'
      case 'Medium':
        return 'text-amber-400 bg-amber-500/10'
      case 'Hard':
        return 'text-red-400 bg-red-500/10'
      default:
        return 'text-slate-400 bg-slate-500/10'
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Blockchain */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Blockchain</label>
            <select
              value={blockchainFilter}
              onChange={(e) => {
                setBlockchainFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-2 py-1.5 text-slate-100 text-sm"
            >
              <option value="">All</option>
              {blockchains.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-2 py-1.5 text-slate-100 text-sm"
            >
              <option value="">All</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Difficulty</label>
            <select
              value={difficultyFilter}
              onChange={(e) => {
                setDifficultyFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-2 py-1.5 text-slate-100 text-sm"
            >
              <option value="">All</option>
              {difficulties.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Reward Range */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reward: ${rewardRange[0]} - ${rewardRange[1]}</label>
            <input
              type="range"
              min="0"
              max="3000"
              value={rewardRange[1]}
              onChange={(e) => {
                setRewardRange([rewardRange[0], Number(e.target.value)])
                setPage(1)
              }}
              className="w-full"
            />
          </div>

          {/* Cost Range */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Cost: ${costRange[0]} - ${costRange[1]}</label>
            <input
              type="range"
              min="0"
              max="500"
              value={costRange[1]}
              onChange={(e) => {
                setCostRange([costRange[0], Number(e.target.value)])
                setPage(1)
              }}
              className="w-full"
            />
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-2 py-1.5 text-slate-100 text-sm"
            >
              <option value="roi">Best ROI</option>
              <option value="reward">Highest Reward</option>
              <option value="cost">Lowest Cost</option>
              <option value="deadline">Soonest Deadline</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Found <span className="font-bold text-slate-100">{filtered.length}</span> airdrops matching filters
        </div>
      </div>

      {/* Results Table */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/30 text-slate-400 text-xs">
              <th className="text-left py-2 px-2">Campaign</th>
              <th className="text-left py-2 px-2">Blockchain</th>
              <th className="text-left py-2 px-2">Status</th>
              <th className="text-left py-2 px-2">Difficulty</th>
              <th className="text-right py-2 px-2">Reward</th>
              <th className="text-right py-2 px-2">Cost</th>
              <th className="text-right py-2 px-2">ROI</th>
              <th className="text-left py-2 px-2">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((scan) => (
              <tr key={scan.id} className="border-b border-slate-700/20 hover:bg-[rgba(255,255,255,0.02)] transition">
                <td className="py-3 px-2 font-semibold text-slate-100">{scan.name}</td>
                <td className="py-3 px-2 text-slate-400">{scan.blockchain}</td>
                <td className="py-3 px-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(scan.status)}`}>
                    {scan.status}
                  </span>
                </td>
                <td className="py-3 px-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${getDifficultyColor(scan.difficulty)}`}>
                    {scan.difficulty}
                  </span>
                </td>
                <td className="py-3 px-2 text-right font-bold text-amber-400">${scan.reward}</td>
                <td className="py-3 px-2 text-right font-bold text-slate-300">${scan.cost}</td>
                <td className="py-3 px-2 text-right font-bold text-green-400">{scan.roi}%</td>
                <td className="py-3 px-2 text-slate-400">{scan.deadline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  )
}
