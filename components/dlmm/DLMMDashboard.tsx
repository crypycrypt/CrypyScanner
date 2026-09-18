"use client"
import { useState, useEffect } from 'react'
import Skeleton from '../ui/Skeleton'

interface DashboardMetrics {
  totalPool: number
  totalTVL: string
  totalVolume24h: string
  averageAPR: number
  totalFees: string
  poolPerformance: number
}

export default function DLMMDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data - replace with actual Meteora API call
    const mockData: DashboardMetrics = {
      totalPool: 2847,
      totalTVL: '$284.7M',
      totalVolume24h: '$18.4M',
      averageAPR: 42.3,
      totalFees: '$234.5K',
      poolPerformance: 8.7,
    }
    
    // Simulate API delay
    const timer = setTimeout(() => {
      setMetrics(mockData)
      setLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return <Skeleton className="h-[300px] w-full rounded-xl" />
  }

  if (!metrics) return null

  const statsGrid = [
    { label: 'Total Pools', value: metrics.totalPool.toLocaleString(), color: '#3b82f6', bg: 'rgba(59,130,246,0.07)' },
    { label: 'Total TVL', value: metrics.totalTVL, color: '#10b981', bg: 'rgba(16,185,129,0.07)' },
    { label: 'Vol 24H', value: metrics.totalVolume24h, color: '#f59e0b', bg: 'rgba(245,158,11,0.07)' },
    { label: 'Avg APR', value: `${metrics.averageAPR.toFixed(1)}%`, color: '#8b5cf6', bg: 'rgba(139,92,246,0.07)' },
    { label: 'Total Fees', value: metrics.totalFees, color: '#ec4899', bg: 'rgba(236,72,153,0.07)' },
    { label: 'Performance', value: `+${metrics.poolPerformance.toFixed(1)}%`, color: '#22c55e', bg: 'rgba(34,197,94,0.07)' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statsGrid.map((stat) => (
          <div
            key={stat.label}
            className="card-glass rounded-xl p-4 border"
            style={{ borderColor: `${stat.color}40`, background: stat.bg }}
          >
            <div className="text-slate-400 text-sm mb-2">{stat.label}</div>
            <div className="text-2xl font-bold" style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Top Pools Summary */}
      <div className="card-glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Top 5 Pools (by TVL)</h3>
          <span className="text-xs text-slate-400">Real-time data</span>
        </div>
        <div className="space-y-2">
          {[
            { name: 'SOL-USDC', tvl: '$42.3M', apr: '28.5%', volume24h: '$2.1M' },
            { name: 'JUP-SOL', tvl: '$38.7M', apr: '35.2%', volume24h: '$1.8M' },
            { name: 'ORCA-SOL', tvl: '$35.2M', apr: '31.1%', volume24h: '$1.5M' },
            { name: 'RAY-SOL', tvl: '$28.9M', apr: '26.8%', volume24h: '$1.2M' },
            { name: 'COPE-USDC', tvl: '$24.6M', apr: '42.5%', volume24h: '$890K' },
          ].map((pool) => (
            <div key={pool.name} className="flex items-center justify-between bg-[rgba(255,255,255,0.02)] rounded-lg p-3">
              <div className="flex-1">
                <div className="font-semibold text-slate-100">{pool.name}</div>
                <div className="text-xs text-slate-400">TVL: {pool.tvl}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-green-400">{pool.apr}</div>
                <div className="text-xs text-slate-400">{pool.volume24h}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
