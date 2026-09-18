"use client"
import { useState } from 'react'
import Skeleton from '../ui/Skeleton'

interface DashboardMetric {
  label: string
  value: string | number
  change?: string
  icon: string
  color: string
}

export default function AirdropDashboard() {
  const [loading] = useState(false)

  const metrics: DashboardMetric[] = [
    {
      label: 'Active Campaign',
      value: 47,
      change: '+12 this week',
      icon: '🎯',
      color: 'from-blue-500/20 to-blue-600/10',
    },
    {
      label: 'Upcoming Airdrop',
      value: 23,
      change: 'Next 30 days',
      icon: '📈',
      color: 'from-green-500/20 to-green-600/10',
    },
    {
      label: 'Claimed Airdrop',
      value: 12,
      change: '+2 this month',
      icon: '✅',
      color: 'from-purple-500/20 to-purple-600/10',
    },
    {
      label: 'Estimated Rewards',
      value: '$8,247',
      change: '+$1,200 pending',
      icon: '💰',
      color: 'from-amber-500/20 to-amber-600/10',
    },
    {
      label: 'Total Completed Tasks',
      value: 284,
      change: '54 this week',
      icon: '⚡',
      color: 'from-pink-500/20 to-pink-600/10',
    },
    {
      label: 'Pending Tasks',
      value: 38,
      change: '5 urgent',
      icon: '⏰',
      color: 'from-orange-500/20 to-orange-600/10',
    },
  ]

  if (loading) {
    return <Skeleton className="h-96 w-full rounded-xl" />
  }

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={`card-glass rounded-xl p-4 bg-gradient-to-br ${metric.color} border border-slate-700/30`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-3xl">{metric.icon}</span>
              {metric.change && (
                <div className="text-xs px-2 py-1 rounded-full bg-[rgba(34,197,94,0.1)] text-green-400">
                  {metric.change}
                </div>
              )}
            </div>
            <div className="text-slate-400 text-sm mb-1">{metric.label}</div>
            <div className="text-2xl font-bold text-slate-100">{metric.value}</div>
          </div>
        ))}
      </div>

      {/* Active Campaigns Table */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">🔥 Top Active Campaigns</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30 text-slate-400">
                <th className="text-left py-2 px-2">Campaign</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-left py-2 px-2">Est. Reward</th>
                <th className="text-left py-2 px-2">Tasks Done</th>
                <th className="text-left py-2 px-2">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Uniswap V4', status: 'Active', reward: '$500-2000', tasks: '8/12', deadline: '10 days' },
                { name: 'Arbitrum', status: 'Active', reward: '$200-800', tasks: '6/8', deadline: '15 days' },
                { name: 'Optimism', status: 'Snapshot Soon', reward: '$100-500', tasks: '10/10', deadline: '3 days' },
                { name: 'Base', status: 'Active', reward: '$300-1000', tasks: '5/10', deadline: '20 days' },
                { name: 'Linea', status: 'Active', reward: '$150-600', tasks: '7/9', deadline: '12 days' },
              ].map((campaign, idx) => (
                <tr key={idx} className="border-b border-slate-700/20 hover:bg-[rgba(255,255,255,0.02)] transition">
                  <td className="py-3 px-2 font-semibold text-slate-100">{campaign.name}</td>
                  <td className="py-3 px-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        campaign.status === 'Active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {campaign.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-amber-400 font-semibold">{campaign.reward}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 w-[75%]" />
                      </div>
                      <span className="text-slate-400">{campaign.tasks}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-slate-400">{campaign.deadline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Participation Rate */}
        <div className="card-glass rounded-xl p-4 border border-slate-700/30">
          <h3 className="font-semibold text-slate-100 mb-3">Participation Rate</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-slate-400">Tasks Completed</span>
                <span className="text-sm font-bold text-slate-100">74%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full w-[74%] bg-gradient-to-r from-green-400 to-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-slate-400">Days on Platform</span>
                <span className="text-sm font-bold text-slate-100">92%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full w-[92%] bg-gradient-to-r from-blue-400 to-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-slate-400">Referral Success</span>
                <span className="text-sm font-bold text-slate-100">45%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full w-[45%] bg-gradient-to-r from-purple-400 to-pink-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Rewards Summary */}
        <div className="card-glass rounded-xl p-4 border border-slate-700/30">
          <h3 className="font-semibold text-slate-100 mb-3">Rewards Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Claimed Airdrops</span>
              <span className="font-bold text-green-400">$3,240</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pending Rewards</span>
              <span className="font-bold text-amber-400">$1,200</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Estimated Upcoming</span>
              <span className="font-bold text-blue-400">$8,247</span>
            </div>
            <div className="border-t border-slate-600/30 pt-2 mt-2 flex justify-between">
              <span className="text-slate-300 font-semibold">Total Potential</span>
              <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                $12,687
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
