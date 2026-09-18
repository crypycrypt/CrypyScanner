"use client"
import { useState, useMemo } from 'react'
import Pagination from '../ui/Pagination'

interface AIRecommendation {
  id: string
  campaign: string
  symbol: string
  recommendation: 'must-join' | 'recommended' | 'worth-trying' | 'skip'
  aiScore: number
  estimatedReward: number
  estimatedCost: number
  estimatedROI: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  timeRequired: number
  riskLevel: 'Low' | 'Medium' | 'High' | 'Very High'
  probability: number
  reason: string
}

const AI_RECOMMENDATIONS: AIRecommendation[] = [
  {
    id: '1',
    campaign: 'Uniswap V4',
    symbol: 'UNI',
    recommendation: 'must-join',
    aiScore: 98,
    estimatedReward: 1500,
    estimatedCost: 75,
    estimatedROI: 1900,
    difficulty: 'Medium',
    timeRequired: 15,
    riskLevel: 'Low',
    probability: 92,
    reason: 'Highest liquidity, established project, consistent rewards history. Strong community engagement.',
  },
  {
    id: '2',
    campaign: 'Arbitrum Overture',
    symbol: 'ARB',
    recommendation: 'recommended',
    aiScore: 85,
    estimatedReward: 850,
    estimatedCost: 100,
    estimatedROI: 750,
    difficulty: 'Easy',
    timeRequired: 12,
    riskLevel: 'Low',
    probability: 87,
    reason: 'Established L2 solution. Easy tasks, good reward potential. Low risk of rug pull.',
  },
  {
    id: '3',
    campaign: 'Base Evolution',
    symbol: 'BASE',
    recommendation: 'recommended',
    aiScore: 82,
    estimatedReward: 1800,
    estimatedCost: 150,
    estimatedROI: 1100,
    difficulty: 'Hard',
    timeRequired: 20,
    riskLevel: 'Medium',
    probability: 84,
    reason: 'Backed by Coinbase. Good reward-to-cost ratio. Harder tasks but worth the effort.',
  },
  {
    id: '4',
    campaign: 'Linea Future',
    symbol: 'LINEA',
    recommendation: 'worth-trying',
    aiScore: 68,
    estimatedReward: 600,
    estimatedCost: 80,
    estimatedROI: 650,
    difficulty: 'Easy',
    timeRequired: 10,
    riskLevel: 'Medium',
    probability: 72,
    reason: 'Decent opportunity. Medium-tier project. Good for portfolio diversification.',
  },
  {
    id: '5',
    campaign: 'Starknet Alpha',
    symbol: 'STRK',
    recommendation: 'worth-trying',
    aiScore: 71,
    estimatedReward: 2200,
    estimatedCost: 180,
    estimatedROI: 1122,
    difficulty: 'Hard',
    timeRequired: 25,
    riskLevel: 'High',
    probability: 65,
    reason: 'High potential but complex tasks. Significant time investment required. Higher uncertainty.',
  },
  {
    id: '6',
    campaign: 'Scroll Protocol',
    symbol: 'SCROLL',
    recommendation: 'skip',
    aiScore: 42,
    estimatedReward: 350,
    estimatedCost: 120,
    estimatedROI: 192,
    difficulty: 'Hard',
    timeRequired: 18,
    riskLevel: 'Very High',
    probability: 38,
    reason: 'Low token confidence. High effort-to-reward ratio. Early-stage project with uncertainty.',
  },
  {
    id: '7',
    campaign: 'Polygon Retro',
    symbol: 'POL',
    recommendation: 'must-join',
    aiScore: 94,
    estimatedReward: 1400,
    estimatedCost: 90,
    estimatedROI: 1455,
    difficulty: 'Medium',
    timeRequired: 14,
    riskLevel: 'Low',
    probability: 89,
    reason: 'Established ecosystem. Strong community. Consistent rewards. Proven track record.',
  },
  {
    id: '8',
    campaign: 'Zksync Era',
    symbol: 'ZKSYNC',
    recommendation: 'recommended',
    aiScore: 79,
    estimatedReward: 1100,
    estimatedCost: 130,
    estimatedROI: 746,
    difficulty: 'Hard',
    timeRequired: 16,
    riskLevel: 'Medium',
    probability: 81,
    reason: 'Well-funded project. Good APY potential. Higher difficulty but worth considering.',
  },
]

export default function AIAirdropRecommendation() {
  const [filterBy, setFilterBy] = useState<string>('all')
  const [page, setPage] = useState(1)
  const pageSize = 4

  const filtered = useMemo(() => {
    if (filterBy === 'all') return AI_RECOMMENDATIONS
    return AI_RECOMMENDATIONS.filter((r) => r.recommendation === filterBy)
  }, [filterBy])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case 'must-join':
        return { icon: '⭐', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Must Join' }
      case 'recommended':
        return { icon: '🟢', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Recommended' }
      case 'worth-trying':
        return { icon: '🟡', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Worth Trying' }
      case 'skip':
        return { icon: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Skip' }
      default:
        return { icon: '⚪', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'Unknown' }
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low':
        return 'text-green-400 bg-green-500/10'
      case 'Medium':
        return 'text-amber-400 bg-amber-500/10'
      case 'High':
        return 'text-orange-400 bg-orange-500/10'
      case 'Very High':
        return 'text-red-400 bg-red-500/10'
      default:
        return 'text-slate-400 bg-slate-500/10'
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All Recommendations', count: AI_RECOMMENDATIONS.length },
            { id: 'must-join', label: '⭐ Must Join', count: AI_RECOMMENDATIONS.filter((r) => r.recommendation === 'must-join').length },
            { id: 'recommended', label: '🟢 Recommended', count: AI_RECOMMENDATIONS.filter((r) => r.recommendation === 'recommended').length },
            { id: 'worth-trying', label: '🟡 Worth Trying', count: AI_RECOMMENDATIONS.filter((r) => r.recommendation === 'worth-trying').length },
            { id: 'skip', label: '🔴 Skip', count: AI_RECOMMENDATIONS.filter((r) => r.recommendation === 'skip').length },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFilterBy(f.id)
                setPage(1)
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                filterBy === f.id
                  ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                  : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-4">
        {paged.map((rec) => {
          const style = getRecommendationStyle(rec.recommendation)
          return (
            <div
              key={rec.id}
              className="card-glass rounded-xl p-4 border"
              style={{ borderColor: `${style.color}40`, background: style.bg }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-3xl">{style.icon}</span>
                  <div>
                    <h3 className="font-bold text-lg text-slate-100">{rec.campaign}</h3>
                    <p className="text-sm text-slate-400">{rec.symbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold" style={{ color: style.color }}>
                    {rec.aiScore}
                  </div>
                  <div className="text-xs text-slate-400">AI Score</div>
                </div>
              </div>

              {/* AI Reason */}
              <div className="mb-4 p-3 rounded bg-[rgba(255,255,255,0.02)] border border-slate-600/20">
                <p className="text-sm text-slate-200">💡 {rec.reason}</p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-4">
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-xs text-slate-400">Est. Reward</div>
                  <div className="text-sm font-bold text-amber-400">${rec.estimatedReward}</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-xs text-slate-400">Est. Cost</div>
                  <div className="text-sm font-bold text-slate-300">${rec.estimatedCost}</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-xs text-slate-400">Est. ROI</div>
                  <div className="text-sm font-bold text-green-400">{rec.estimatedROI}%</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-xs text-slate-400">Time Needed</div>
                  <div className="text-sm font-bold text-slate-100">{rec.timeRequired}h</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-xs text-slate-400">Difficulty</div>
                  <div className={`text-xs font-bold ${rec.difficulty === 'Easy' ? 'text-green-400' : rec.difficulty === 'Medium' ? 'text-amber-400' : 'text-red-400'}`}>
                    {rec.difficulty}
                  </div>
                </div>
              </div>

              {/* Risk & Probability */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">Risk Level</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getRiskColor(rec.riskLevel)}`}>
                      {rec.riskLevel}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">Probability</span>
                    <span className="text-xs font-bold text-blue-400">{rec.probability}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-cyan-400"
                      style={{ width: `${rec.probability}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  )
}
