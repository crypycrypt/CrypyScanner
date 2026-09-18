"use client"

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface RoomMetrics {
  followRate: number
  edgeDecay: number
  fillQuality: number
  totalWhales: number
  copiedEntries: number
  avgSlippage: string
  lastUpdated: string
}

interface RoomHealthResponse {
  ok: boolean
  cached?: boolean
  stale?: boolean
  metrics: RoomMetrics
  fetchedAt: string
}

function getHealthColor(value: number): string {
  if (value >= 80) return '#4ade80' // green - healthy
  if (value >= 60) return '#fbbf24' // yellow - warning
  return '#f87171' // red - danger
}

function getHealthBg(value: number): string {
  if (value >= 80) return 'rgba(74,222,128,0.1)'
  if (value >= 60) return 'rgba(251,191,36,0.1)'
  return 'rgba(248,113,113,0.1)'
}

function getHealthBorder(value: number): string {
  if (value >= 80) return 'rgba(74,222,128,0.3)'
  if (value >= 60) return 'rgba(251,191,36,0.3)'
  return 'rgba(248,113,113,0.3)'
}

function DonutIndicator({
  label,
  value,
  description,
  size = 90,
}: {
  label: string
  value: number
  description: string
  size?: number
}) {
  const color = getHealthColor(value)
  const bg = getHealthBg(value)
  const border = getHealthBorder(value)

  const radius = 36
  const strokeWidth = 6
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div
        className="rounded-full flex items-center justify-center transition-all duration-300"
        style={{
          width: size,
          height: size,
          background: bg,
          border: `1px solid ${border}`,
        }}
      >
        <svg width={size} height={size} viewBox="0 0 84 84">
          {/* Background circle */}
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke="rgba(148,163,184,0.1)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 42 42)"
            style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
          />
          {/* Value text in center */}
          <text
            x="42"
            y="42"
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs font-bold"
            style={{ color, fontSize: '14px' }}
          >
            {value}%
          </text>
        </svg>
      </div>
      <div className="text-center">
        <div className="text-xs font-semibold text-slate-300">{label}</div>
        <div className="text-[10px] text-slate-500 max-w-[120px] leading-tight">
          {description}
        </div>
      </div>
    </motion.div>
  )
}

export default function RoomHealthPanel() {
  const [data, setData] = useState<RoomHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const res = await fetch('/api/smart-money/room-health')
      if (!res.ok) throw new Error('Failed to fetch')
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching room health:', error)
    } finally {
      setLoading(false)
    }
  }

  const metrics = data?.metrics

  return (
    <div className="card-glass rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ROOM HEALTH</span>
        </div>
        {metrics && (
          <div className="text-[10px] text-slate-500">
            {metrics.totalWhales} whales · {metrics.copiedEntries} copied · {metrics.avgSlippage}% avg slip
          </div>
        )}
      </div>

      {/* Donut Indicators */}
      {loading && !data ? (
        <div className="flex justify-around py-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-[90px] h-[90px] rounded-full bg-slate-800/50 animate-pulse"></div>
          ))}
        </div>
      ) : metrics ? (
        <div className="flex justify-around py-2">
          <DonutIndicator
            label="Follow Rate"
            value={metrics.followRate}
            description="how much of a whale entry the desk copies"
          />
          <DonutIndicator
            label="Edge Decay"
            value={metrics.edgeDecay}
            description="how fast the copy stops working"
          />
          <DonutIndicator
            label="Fill Quality"
            value={metrics.fillQuality}
            description="slippage against the whale entry price"
          />
        </div>
      ) : null}

      {/* Footer */}
      {data && (
        <div className="mt-3 text-[10px] text-slate-500 text-center">
          Updated {new Date(data.fetchedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
