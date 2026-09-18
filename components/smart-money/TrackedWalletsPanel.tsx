"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TrackedWallet {
  id: string
  rank: number
  address: string
  shortAddr: string
  sparkline: number[]
  status: 'COPYING' | 'WATCH' | 'STOP' | 'PAUSED'
  profitLoss: number
  solValue: number
  isProfit: boolean
  lastActive: string
}

interface TrackedWalletsResponse {
  ok: boolean
  cached?: boolean
  stale?: boolean
  wallets: TrackedWallet[]
  total: number
  copyingCount: number
  watchCount: number
  fetchedAt: string
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  COPYING: { bg: 'rgba(74,222,128,0.15)', text: '#4ade80', border: 'rgba(74,222,128,0.3)' },
  WATCH: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  STOP: { bg: 'rgba(248,113,113,0.15)', text: '#f87171', border: 'rgba(248,113,113,0.3)' },
  PAUSED: { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.3)' },
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 100
      const y = 100 - ((val - min) / range) * 100
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width="80" height="24" viewBox="0 0 100 30" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-blue-400"
      />
    </svg>
  )
}

export default function TrackedWalletsPanel() {
  const [data, setData] = useState<TrackedWalletsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [prevRanks, setPrevRanks] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const res = await fetch('/api/smart-money/tracked-wallets')
      if (!res.ok) throw new Error('Failed to fetch')
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching tracked wallets:', error)
    } finally {
      setLoading(false)
    }
  }

  const wallets = data?.wallets ?? []

  // Detect rank changes for animation
  const rankChanges: Record<string, 'up' | 'down' | 'none'> = {}
  wallets.forEach((w) => {
    const prev = prevRanks[w.id]
    if (prev !== undefined) {
      rankChanges[w.id] = w.rank < prev ? 'up' : w.rank > prev ? 'down' : 'none'
    } else {
      rankChanges[w.id] = 'none'
    }
  })

  // Update prevRanks after render
  useEffect(() => {
    if (wallets.length > 0) {
      const newRanks: Record<string, number> = {}
      wallets.forEach((w) => {
        newRanks[w.id] = w.rank
      })
      setPrevRanks(newRanks)
    }
  }, [wallets])

  return (
    <div className="card-glass rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">TRACKED WALLETS</span>
          <span className="text-xs text-slate-500">·</span>
          <span className="text-xs font-semibold text-blue-400">RANK MOVES LIVE</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            {data?.copyingCount ?? 0} Copying
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
            {data?.watchCount ?? 0} Watch
          </span>
        </div>
      </div>

      {/* Wallet List */}
      <div className="space-y-1">
        {loading && !data ? (
          // Skeleton rows
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-800/50 rounded animate-pulse"></div>
          ))
        ) : (
          <AnimatePresence>
            {wallets.map((w) => {
              const sc = STATUS_COLORS[w.status] || STATUS_COLORS.WATCH
              const change = rankChanges[w.id]

              return (
                <motion.div
                  key={w.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="grid grid-cols-12 gap-2 items-center py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors group"
                >
                  {/* Rank with movement indicator */}
                  <div className="col-span-1 flex items-center gap-1">
                    <span className="text-xs text-slate-400 w-4 text-center">#{w.rank}</span>
                    {change === 'up' && (
                      <motion.span
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-green-400"
                      >
                        ▲
                      </motion.span>
                    )}
                    {change === 'down' && (
                      <motion.span
                        initial={{ opacity: 0, y: -2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-red-400"
                      >
                        ▼
                      </motion.span>
                    )}
                  </div>

                  {/* Address + Sparkline */}
                  <div className="col-span-4 flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-300 group-hover:text-white transition-colors">
                      {w.shortAddr}
                    </span>
                    <span className="text-slate-600">·</span>
                    <Sparkline data={w.sparkline} />
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        backgroundColor: sc.bg,
                        color: sc.text,
                        border: `1px solid ${sc.border}`,
                      }}
                    >
                      {w.status}
                    </span>
                  </div>

                  {/* Profit/Loss */}
                  <div className="col-span-2">
                    <span className={`text-xs font-medium ${w.isProfit ? 'text-green-400' : 'text-red-400'}`}>
                      {w.isProfit ? '+' : ''}{w.profitLoss.toFixed(1)} SOL
                    </span>
                  </div>

                  {/* SOL Value */}
                  <div className="col-span-2 text-right">
                    <span className="text-xs text-slate-400">
                      {w.solValue.toFixed(1)} SOL
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      {data && (
        <div className="mt-3 text-[10px] text-slate-500 flex justify-between">
          <span>{data.total} tracked wallets</span>
          <span>Updated {new Date(data.fetchedAt).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  )
}
