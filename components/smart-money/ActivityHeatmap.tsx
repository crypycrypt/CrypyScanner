"use client"

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface HeatmapCell {
  day: number
  hour: number
  date: string
  events: number
  profit: number
  winRate: number
  avgEntry: number
  intensity: number
}

interface DenseWindow {
  start: number
  end: number
  label: string
}

interface HeatmapResponse {
  ok: boolean
  cached?: boolean
  stale?: boolean
  cells: HeatmapCell[]
  denseWindow: DenseWindow
  days: string[]
  fetchedAt: string
}

function getIntensityColor(intensity: number): string {
  // Gradient from dark to bright based on intensity
  if (intensity < 0.1) return 'rgba(30,41,59,0.5)'
  if (intensity < 0.3) return 'rgba(30,58,95,0.6)'
  if (intensity < 0.5) return 'rgba(30,74,120,0.7)'
  if (intensity < 0.7) return 'rgba(29,78,216,0.7)'
  if (intensity < 0.85) return 'rgba(37,99,235,0.8)'
  return 'rgba(59,130,246,0.9)'
}

export default function ActivityHeatmap() {
  const [data, setData] = useState<HeatmapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const res = await fetch('/api/smart-money/activity-heatmap')
      if (!res.ok) throw new Error('Failed to fetch')
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching activity heatmap:', error)
    } finally {
      setLoading(false)
    }
  }

  const cells = data?.cells ?? []
  const denseWindow = data?.denseWindow
  const days = data?.days ?? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Group cells by day (0 = today, 6 = 6 days ago)
  const daysData: HeatmapCell[][] = []
  for (let d = 0; d < 7; d++) {
    daysData.push(cells.filter((c) => c.day === d))
  }

  return (
    <div className="card-glass rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ACTIVITY HEATMAP</span>
        </div>
        {denseWindow && (
          <div className="text-xs text-slate-400">
            Dense window: <span className="text-blue-400 font-semibold">{denseWindow.label}</span>
          </div>
        )}
      </div>

      {/* Heatmap Grid */}
      {loading && !data ? (
        <div className="grid grid-cols-[40px_repeat(24,_1fr)] gap-[1px] bg-slate-800/30 rounded overflow-hidden">
          {Array.from({ length: 7 * 25 }).map((_, i) => (
            <div key={i} className="bg-slate-800/50 animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[40px_repeat(24,_1fr)] gap-[1px] bg-slate-800/30 rounded overflow-hidden">
          {/* Header row: Day labels + Hour labels */}
          <div className="bg-slate-800/50 h-8 flex items-center justify-center text-[10px] text-slate-400 font-medium">
            DAY
          </div>
          {Array.from({ length: 24 }).map((_, h) => (
            <div
              key={h}
              className="bg-slate-800/50 h-8 flex items-center justify-center text-[9px] text-slate-500"
            >
              {h.toString().padStart(2, '0')}:00
            </div>
          ))}

          {/* Data rows */}
          {daysData.map((dayCells, d) => (
            <div key={d} className="contents">
              {/* Day label */}
              <div className="bg-slate-800/50 h-8 flex items-center justify-center text-[10px] text-slate-400 font-medium">
                {days[d]}
              </div>
              {/* Hour cells */}
              {dayCells.map((cell) => {
                const isDenseHour =
                  denseWindow && cell.hour >= denseWindow.start && cell.hour <= denseWindow.end
                return (
                  <motion.div
                    key={`${cell.day}-${cell.hour}`}
                    className="relative h-8 cursor-pointer transition-all duration-200"
                    style={{
                      backgroundColor: getIntensityColor(cell.intensity),
                      border: isDenseHour ? '1px solid #60a5fa' : '1px solid transparent',
                    }}
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                    whileHover={{ scale: 1.05 }}
                  >
                    {cell.events > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-white/80">
                          {cell.events}
                        </span>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Hover Tooltip */}
      {hoveredCell && (
        <motion.div
          className="absolute z-50 bg-slate-900/95 border border-blue-400/30 rounded-lg p-3 text-xs pointer-events-none"
          style={{
            maxWidth: '200px',
            left: '50%',
            top: 'auto',
            transform: 'translateX(-50%)',
            boxShadow: '0 0 20px rgba(59,130,246,0.3)',
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
        >
          <div className="font-semibold text-blue-300 mb-1">
            {hoveredCell.date} · {hoveredCell.hour.toString().padStart(2, '0')}:00 UTC
          </div>
          <div className="space-y-1 text-slate-300">
            <div className="flex justify-between">
              <span>Whale Events:</span>
              <span className="text-white">{hoveredCell.events}</span>
            </div>
            <div className="flex justify-between">
              <span>Profit:</span>
              <span className={hoveredCell.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                {hoveredCell.profit >= 0 ? '+' : ''}{hoveredCell.profit.toFixed(2)} SOL
              </span>
            </div>
            <div className="flex justify-between">
              <span>Win Rate:</span>
              <span className="text-white">{hoveredCell.winRate}%</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Entry:</span>
              <span className="text-white">{hoveredCell.avgEntry.toFixed(6)}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
        <span>Less activity →</span>
        <div className="flex gap-1">
          {['#1e293b', '#1e3a5f', '#1e4a7a', '#1d4ed8', '#2563eb', '#3b82f6'].map((color, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded"
              style={{ backgroundColor: color, opacity: 0.4 + i * 0.1 }}
            />
          ))}
        </div>
        <span>→ More activity</span>
      </div>
    </div>
  )
}
