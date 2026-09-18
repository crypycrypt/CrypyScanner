"use client"
import { useState } from 'react'
import Skeleton from '../ui/Skeleton'

export default function DLMMAnalytics() {
  const [selectedPool, setSelectedPool] = useState('SOL-USDC')
  const [loading] = useState(false)

  const pools = [
    { name: 'SOL-USDC', pair: 'SOL/USDC' },
    { name: 'JUP-SOL', pair: 'JUP/SOL' },
    { name: 'ORCA-SOL', pair: 'ORCA/SOL' },
  ]

  if (loading) {
    return <Skeleton className="h-[500px] w-full rounded-xl" />
  }

  return (
    <div className="space-y-4">
      {/* Pool Selector */}
      <div className="card-glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Select Pool</h3>
        <div className="flex gap-2 flex-wrap">
          {pools.map((pool) => (
            <button
              key={pool.name}
              onClick={() => setSelectedPool(pool.name)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                selectedPool === pool.name
                  ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                  : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
              }`}
            >
              {pool.name}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TVL History */}
        <div className="card-glass rounded-xl p-4">
          <h3 className="font-semibold text-slate-100 mb-3">TVL History (30d)</h3>
          <div className="h-[200px] flex items-end justify-between gap-1">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-gradient-to-t from-blue-400 to-blue-500 rounded-t"
                  style={{
                    height: `${Math.random() * 100 + 20}%`,
                    opacity: 0.7 + Math.sin(i * 0.2) * 0.3,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-2">
            <span>Day 1</span>
            <span>Day 30</span>
          </div>
        </div>

        {/* Volume History */}
        <div className="card-glass rounded-xl p-4">
          <h3 className="font-semibold text-slate-100 mb-3">Volume History (30d)</h3>
          <div className="h-[200px] flex items-end justify-between gap-1">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-gradient-to-t from-amber-400 to-amber-500 rounded-t"
                  style={{
                    height: `${Math.random() * 100 + 15}%`,
                    opacity: 0.7 + Math.cos(i * 0.3) * 0.3,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-2">
            <span>Day 1</span>
            <span>Day 30</span>
          </div>
        </div>

        {/* Fee History */}
        <div className="card-glass rounded-xl p-4">
          <h3 className="font-semibold text-slate-100 mb-3">Fee History (30d)</h3>
          <div className="h-[200px] flex items-end justify-between gap-1">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-gradient-to-t from-pink-400 to-pink-500 rounded-t"
                  style={{
                    height: `${Math.random() * 100 + 25}%`,
                    opacity: 0.7 + Math.sin(i * 0.15) * 0.3,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-2">
            <span>Day 1</span>
            <span>Day 30</span>
          </div>
        </div>

        {/* APR History */}
        <div className="card-glass rounded-xl p-4">
          <h3 className="font-semibold text-slate-100 mb-3">APR History (30d)</h3>
          <div className="h-[200px] flex items-end justify-between gap-1">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-gradient-to-t from-green-400 to-green-500 rounded-t"
                  style={{
                    height: `${Math.random() * 100 + 20}%`,
                    opacity: 0.7 + Math.cos(i * 0.25) * 0.3,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-2">
            <span>Day 1</span>
            <span>Day 30</span>
          </div>
        </div>
      </div>

      {/* Liquidity & Bin Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Liquidity Distribution */}
        <div className="card-glass rounded-xl p-4">
          <h3 className="font-semibold text-slate-100 mb-3">Liquidity Distribution</h3>
          <div className="space-y-2">
            {[
              { label: 'Concentrated', value: 45, color: '#3b82f6' },
              { label: 'Moderate', value: 35, color: '#10b981' },
              { label: 'Spread', value: 20, color: '#f59e0b' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="text-slate-400">{item.value}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${item.value}%`, background: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bin Distribution */}
        <div className="card-glass rounded-xl p-4">
          <h3 className="font-semibold text-slate-100 mb-3">Bin Information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Bins</span>
              <span className="font-bold text-slate-100">2,847</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Active Bin</span>
              <span className="font-bold text-blue-400">1,423</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Price Range (Low)</span>
              <span className="font-bold text-slate-100">$138.5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Price Range (High)</span>
              <span className="font-bold text-slate-100">$145.2</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Current Price</span>
              <span className="font-bold text-green-400">$142.8</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
