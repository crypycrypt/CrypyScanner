"use client"
import { useState, useMemo } from 'react'
import Pagination from '../ui/Pagination'

interface AirdropCard {
  id: string
  name: string
  symbol: string
  category: 'hot' | 'new' | 'ending-soon' | 'confirmed' | 'rumor' | 'testnet' | 'mainnet'
  reward: string
  tasks: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  deadline: string
  twitter?: string
  discord?: string
  participants: number
}

const CATEGORIES = [
  { id: 'hot', label: '🔥 Hot', color: '#ff6b6b' },
  { id: 'new', label: '✨ New', color: '#4ecdc4' },
  { id: 'ending-soon', label: '⏰ Ending Soon', color: '#ffa502' },
  { id: 'confirmed', label: '✅ Confirmed', color: '#22c55e' },
  { id: 'rumor', label: '💭 Rumor', color: '#a855f7' },
  { id: 'testnet', label: '🧪 Testnet', color: '#3b82f6' },
  { id: 'mainnet', label: '🚀 Mainnet', color: '#06b6d4' },
]

const FEATURED_AIRDROPS: AirdropCard[] = [
  {
    id: '1',
    name: 'Uniswap V4',
    symbol: 'UNI',
    category: 'hot',
    reward: '$500 - $2,000',
    tasks: 12,
    difficulty: 'Medium',
    deadline: '10 days',
    twitter: '@Uniswap',
    discord: 'Uniswap',
    participants: 125000,
  },
  {
    id: '2',
    name: 'Arbitrum Nova',
    symbol: 'ARB',
    category: 'hot',
    reward: '$200 - $1,500',
    tasks: 8,
    difficulty: 'Easy',
    deadline: '15 days',
    twitter: '@arbitrum',
    discord: 'Arbitrum',
    participants: 89000,
  },
  {
    id: '3',
    name: 'Optimism Retro',
    symbol: 'OP',
    category: 'new',
    reward: '$100 - $800',
    tasks: 10,
    difficulty: 'Medium',
    deadline: '3 days',
    twitter: '@optimismFND',
    discord: 'Optimism',
    participants: 45000,
  },
  {
    id: '4',
    name: 'Base Evolution',
    symbol: 'BASE',
    category: 'ending-soon',
    reward: '$300 - $2,000',
    tasks: 15,
    difficulty: 'Hard',
    deadline: '2 days',
    twitter: '@base',
    discord: 'Base',
    participants: 78000,
  },
  {
    id: '5',
    name: 'Linea Future',
    symbol: 'LINEA',
    category: 'confirmed',
    reward: '$150 - $900',
    tasks: 9,
    difficulty: 'Easy',
    deadline: '12 days',
    twitter: '@LineaBuild',
    discord: 'Linea',
    participants: 56000,
  },
  {
    id: '6',
    name: 'Starknet Alpha',
    symbol: 'STRK',
    category: 'rumor',
    reward: '$800 - $3,000',
    tasks: 20,
    difficulty: 'Hard',
    deadline: '25 days',
    twitter: '@Starknet',
    discord: 'Starknet',
    participants: 34000,
  },
  {
    id: '7',
    name: 'Sepolia Testnet',
    symbol: 'ETH',
    category: 'testnet',
    reward: 'NFT Badge',
    tasks: 5,
    difficulty: 'Easy',
    deadline: '30 days',
    twitter: '@ethereum',
    discord: 'Ethereum',
    participants: 12000,
  },
  {
    id: '8',
    name: 'Polygon 2.0',
    symbol: 'POL',
    category: 'mainnet',
    reward: '$400 - $2,500',
    tasks: 14,
    difficulty: 'Hard',
    deadline: '20 days',
    twitter: '@0xPolygon',
    discord: 'Polygon',
    participants: 98000,
  },
]

export default function FeaturedAirdrops() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 6

  const filtered = useMemo(() => {
    if (!selectedCategory) return FEATURED_AIRDROPS
    return FEATURED_AIRDROPS.filter((a) => a.category === selectedCategory)
  }, [selectedCategory])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = useMemo(() => {
    return filtered.slice((page - 1) * pageSize, page * pageSize)
  }, [filtered, page])

  const getCategoryInfo = (cat: string) => CATEGORIES.find((c) => c.id === cat)

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
      {/* Category Filter */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setSelectedCategory(null)
              setPage(1)
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              selectedCategory === null
                ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
            }`}
          >
            All Campaigns ({FEATURED_AIRDROPS.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = FEATURED_AIRDROPS.filter((a) => a.category === cat.id).length
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id)
                  setPage(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  selectedCategory === cat.id
                    ? 'border-2'
                    : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
                }`}
                style={
                  selectedCategory === cat.id
                    ? { borderColor: cat.color, color: cat.color }
                    : {}
                }
              >
                {cat.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Airdrops Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paged.map((airdrop) => {
          const catInfo = getCategoryInfo(airdrop.category)
          return (
            <div
              key={airdrop.id}
              className="card-glass rounded-xl p-4 border border-slate-700/30 hover:border-slate-600/50 transition-all group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg text-slate-100">{airdrop.name}</h3>
                  <div className="text-xs text-slate-400">{airdrop.symbol}</div>
                </div>
                <span
                  className="text-lg px-2 py-1 rounded-full"
                  style={{ backgroundColor: `${catInfo?.color}20`, color: catInfo?.color }}
                >
                  {catInfo?.label.split(' ')[0]}
                </span>
              </div>

              {/* Reward & Difficulty */}
              <div className="space-y-2 mb-3">
                <div>
                  <div className="text-xs text-slate-400">Estimated Reward</div>
                  <div className="font-bold text-amber-400">{airdrop.reward}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Difficulty</div>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${getDifficultyColor(airdrop.difficulty)}`}>
                    {airdrop.difficulty}
                  </span>
                </div>
              </div>

              {/* Participants */}
              <div className="mb-3 p-2 rounded bg-[rgba(255,255,255,0.02)]">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Participants</span>
                  <span className="font-bold text-slate-100">
                    {(airdrop.participants / 1000).toFixed(0)}K
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-slate-400">Tasks</div>
                  <div className="font-bold text-blue-400">{airdrop.tasks}</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-slate-400">Deadline</div>
                  <div className="font-bold text-slate-100">{airdrop.deadline}</div>
                </div>
              </div>

              {/* Social Links */}
              <div className="flex gap-2 mb-3 pt-3 border-t border-slate-700/30">
                {airdrop.twitter && (
                  <a href="#" className="flex-1 px-2 py-1.5 rounded text-xs font-semibold text-slate-300 bg-[rgba(255,255,255,0.02)] hover:bg-blue-500/20 transition text-center">
                    𝕏
                  </a>
                )}
                {airdrop.discord && (
                  <a href="#" className="flex-1 px-2 py-1.5 rounded text-xs font-semibold text-slate-300 bg-[rgba(255,255,255,0.02)] hover:bg-indigo-500/20 transition text-center">
                    💬
                  </a>
                )}
              </div>

              {/* Action Button */}
              <button className="w-full px-3 py-2 rounded-lg bg-blue-500/20 border border-blue-400/50 text-blue-300 text-sm font-semibold hover:bg-blue-500/30 transition">
                View Details →
              </button>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  )
}
