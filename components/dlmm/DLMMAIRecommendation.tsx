"use client"
import { useState, useMemo } from 'react'
import Skeleton from '../ui/Skeleton'
import Pagination from '../ui/Pagination'

interface PoolRecommendation {
  id: string
  pool: string
  pair: string
  recommendation: 'excellent' | 'good' | 'watch' | 'avoid'
  confidenceScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'very-high'
  estimatedDailyFee: number
  estimatedMonthlyFee: number
  estimatedAPY: number
  impermanentLossRisk: number
  volatilityScore: number
  reason: string
}

const RECOMMENDATIONS: PoolRecommendation[] = [
  {
    id: '1',
    pool: 'SOL-USDC',
    pair: 'SOL/USDC',
    recommendation: 'excellent',
    confidenceScore: 94,
    riskLevel: 'low',
    estimatedDailyFee: 12500,
    estimatedMonthlyFee: 375000,
    estimatedAPY: 28.5,
    impermanentLossRisk: 2.1,
    volatilityScore: 3.2,
    reason: 'High TVL, stable pair, consistent volume. Best risk-reward ratio for conservative investors.',
  },
  {
    id: '2',
    pool: 'JUP-SOL',
    pair: 'JUP/SOL',
    recommendation: 'good',
    confidenceScore: 87,
    riskLevel: 'medium',
    estimatedDailyFee: 14200,
    estimatedMonthlyFee: 426000,
    estimatedAPY: 35.2,
    impermanentLossRisk: 5.3,
    volatilityScore: 6.1,
    reason: 'Good APR with moderate risk. Strong JUP liquidity supports the pool.',
  },
  {
    id: '3',
    pool: 'COPE-USDC',
    pair: 'COPE/USDC',
    recommendation: 'watch',
    confidenceScore: 72,
    riskLevel: 'high',
    estimatedDailyFee: 8200,
    estimatedMonthlyFee: 246000,
    estimatedAPY: 42.5,
    impermanentLossRisk: 12.8,
    volatilityScore: 9.4,
    reason: 'High APR attractive but elevated volatility. Monitor for sudden changes.',
  },
  {
    id: '4',
    pool: 'WEN-SOL',
    pair: 'WEN/SOL',
    recommendation: 'avoid',
    confidenceScore: 65,
    riskLevel: 'very-high',
    estimatedDailyFee: 5200,
    estimatedMonthlyFee: 156000,
    estimatedAPY: 55.7,
    impermanentLossRisk: 28.5,
    volatilityScore: 14.2,
    reason: 'Extremely volatile meme coin. High IL risk outweighs APY gains.',
  },
  {
    id: '5',
    pool: 'USDT-USDC',
    pair: 'USDT/USDC',
    recommendation: 'excellent',
    confidenceScore: 98,
    riskLevel: 'low',
    estimatedDailyFee: 4800,
    estimatedMonthlyFee: 144000,
    estimatedAPY: 12.1,
    impermanentLossRisk: 0.1,
    volatilityScore: 0.2,
    reason: 'Stablecoin pair. Minimal impermanent loss risk, consistent returns.',
  },
]

export default function DLMMAIRecommendation() {
  const [page, setPage] = useState(1)
  const pageSize = 5

  const totalPages = Math.ceil(RECOMMENDATIONS.length / pageSize)
  const pagedRecommendations = useMemo(() =>
    RECOMMENDATIONS.slice((page - 1) * pageSize, page * pageSize),
    [page]
  )

  const getRecommendationColor = (rec: 'excellent' | 'good' | 'watch' | 'avoid') => {
    switch (rec) {
      case 'excellent':
        return { bg: 'rgba(34,197,94,0.1)', border: '#22c55e', text: '#22c55e', icon: '🟢' }
      case 'good':
        return { bg: 'rgba(59,130,246,0.1)', border: '#3b82f6', text: '#3b82f6', icon: '🔵' }
      case 'watch':
        return { bg: 'rgba(234,179,8,0.1)', border: '#eab308', text: '#eab308', icon: '🟡' }
      case 'avoid':
        return { bg: 'rgba(239,68,68,0.1)', border: '#ef4444', text: '#ef4444', icon: '🔴' }
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="card-glass rounded-xl p-4 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
        <div className="flex items-center gap-3">
          <img src="/assets/ic_ai.svg" alt="ai" className="w-6 h-6" />
          <div>
            <h3 className="font-semibold text-slate-100">AI Pool Recommendations</h3>
            <p className="text-xs text-slate-400">Machine learning analysis based on TVL, volatility, fees, and historical performance</p>
          </div>
        </div>
      </div>

      {/* Recommendation Cards */}
      <div className="space-y-3">
        {pagedRecommendations.map((rec) => {
          const colors = getRecommendationColor(rec.recommendation)
          const recLabel = rec.recommendation.toUpperCase()

          return (
            <div
              key={rec.id}
              className="card-glass rounded-xl p-4 border"
              style={{ borderColor: colors.border + '40', background: colors.bg }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{colors.icon}</span>
                    <h4 className="font-bold text-lg text-slate-100">{rec.pool}</h4>
                    <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ color: colors.text, background: colors.bg, border: `1px solid ${colors.border}` }}>
                      {recLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{rec.pair}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: colors.text }}>
                    {rec.confidenceScore}%
                  </div>
                  <div className="text-xs text-slate-400">Confidence</div>
                </div>
              </div>

              {/* AI Reason */}
              <div className="mb-4 p-3 rounded bg-[rgba(255,255,255,0.02)] border border-slate-600/20">
                <p className="text-sm text-slate-200">💡 {rec.reason}</p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-xs text-slate-400">Daily Fee</div>
                  <div className="text-sm font-bold text-amber-400">${rec.estimatedDailyFee.toLocaleString()}</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-xs text-slate-400">Monthly Fee</div>
                  <div className="text-sm font-bold text-amber-400">${(rec.estimatedMonthlyFee / 1000).toFixed(0)}K</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-xs text-slate-400">Est. APY</div>
                  <div className="text-sm font-bold text-green-400">{rec.estimatedAPY.toFixed(1)}%</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-xs text-slate-400">Risk Level</div>
                  <div className="text-sm font-bold capitalize" style={{ color: rec.riskLevel === 'low' ? '#22c55e' : rec.riskLevel === 'medium' ? '#eab308' : '#ef4444' }}>
                    {rec.riskLevel}
                  </div>
                </div>
              </div>

              {/* Risk Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">IL Risk</span>
                    <span className="text-xs font-bold text-slate-200">{rec.impermanentLossRisk.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-purple-400"
                      style={{ width: `${Math.min(rec.impermanentLossRisk / 100 * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">Volatility</span>
                    <span className="text-xs font-bold text-slate-200">{rec.volatilityScore.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-red-400"
                      style={{ width: `${Math.min(rec.volatilityScore / 20 * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
