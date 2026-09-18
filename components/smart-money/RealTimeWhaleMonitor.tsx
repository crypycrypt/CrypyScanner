"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type NodeStatus = 'Watching' | 'Copying' | 'Profit' | 'Loss' | 'Entry' | 'Exit' | 'Warning'

interface WhaleNode {
  id: string
  shortAddr: string
  status: NodeStatus
  x: number
  y: number
  solAmount: number
  token: string
  lastEvent: string
}

interface WhaleEvent {
  id: string
  type: 'WHALE MOVE' | 'ENTRY' | 'EXIT' | 'WARNING'
  wallet: string
  action: string
  amount: string
  token: string
  timestamp: number
}

interface WhaleEventsResponse {
  ok: boolean
  cached?: boolean
  stale?: boolean
  nodes: WhaleNode[]
  events: WhaleEvent[]
  fetchedAt: string
}

const STATUS_COLORS: Record<NodeStatus, string> = {
  Watching: '#fbbf24',
  Copying: '#4ade80',
  Profit: '#22c55e',
  Loss: '#f87171',
  Entry: '#60a5fa',
  Exit: '#a78bfa',
  Warning: '#f59e0b',
}

const STATUS_BG: Record<NodeStatus, string> = {
  Watching: 'rgba(251,191,36,0.15)',
  Copying: 'rgba(74,222,128,0.15)',
  Profit: 'rgba(34,197,94,0.15)',
  Loss: 'rgba(248,113,113,0.15)',
  Entry: 'rgba(96,165,250,0.15)',
  Exit: 'rgba(168,85,247,0.15)',
  Warning: 'rgba(245,158,11,0.15)',
}

export default function RealTimeWhaleMonitor() {
  const [nodes, setNodes] = useState<WhaleNode[]>([])
  const [events, setEvents] = useState<WhaleEvent[]>([])
  const [activeConnections, setActiveConnections] = useState<[number, number][]>([])
  const [loading, setLoading] = useState(true)
  const [seenEventIds, setSeenEventIds] = useState<Set<string>>(new Set())

  // Fetch data from API
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 8_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const res = await fetch('/api/smart-money/whale-events')
      if (!res.ok) throw new Error('Failed to fetch whale events')
      const result: WhaleEventsResponse = await res.json()

      // Update nodes
      setNodes(result.nodes)

      // Only add new events (not seen before)
      const newEvents = result.events.filter((e) => !seenEventIds.has(e.id))
      if (newEvents.length > 0) {
        setEvents((prev) => {
          const updated = [...newEvents, ...prev].slice(0, 5)
          return updated
        })
        setSeenEventIds((prev) => {
          const updated = new Set(prev)
          newEvents.forEach((e) => updated.add(e.id))
          // Keep only last 50 IDs to prevent memory growth
          if (updated.size > 50) {
            const arr = Array.from(updated).slice(-50)
            return new Set(arr)
          }
          return updated
        })
      }
    } catch (error) {
      console.error('Error fetching whale events:', error)
    } finally {
      setLoading(false)
    }
  }

  // Generate connections periodically based on nodes
  useEffect(() => {
    if (nodes.length === 0) return

    const interval = setInterval(() => {
      const connections: [number, number][] = []
      for (let i = 0; i < 3; i++) {
        const a = Math.floor(Math.random() * nodes.length)
        const b = Math.floor(Math.random() * nodes.length)
        if (a !== b) connections.push([a, b])
      }
      setActiveConnections(connections)
    }, 3000)

    return () => clearInterval(interval)
  }, [nodes])

  const TABS = ['MONITOR', 'AUDITOR', 'NARRATIVE', 'TIMING', 'CHECKER']
  const [activeTab, setActiveTab] = useState('MONITOR')

  return (
    <div className="card-glass rounded-xl p-4">
      {/* Header with tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">REAL-TIME WHALE MONITOR</span>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
        </div>
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: activeTab === tab ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)',
                color: activeTab === tab ? '#60a5fa' : '#64748b',
                border: `1px solid ${activeTab === tab ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.05)'}`,
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Network Visualization */}
      <div className="relative h-[320px] bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] rounded-lg overflow-hidden">
        {/* SVG for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="whaleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
            </linearGradient>
            <filter id="whaleGlow">
              <feGaussianBlur stdDeviation="0.8" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Animated connection lines */}
          {activeConnections.map(([a, b], i) => {
            const nodeA = nodes[a]
            const nodeB = nodes[b]
            if (!nodeA || !nodeB) return null
            return (
              <motion.line
                key={`conn-${i}`}
                x1={nodeA.x}
                y1={nodeA.y}
                x2={nodeB.x}
                y2={nodeB.y}
                stroke="url(#whaleGrad)"
                strokeWidth="0.5"
                opacity="0.5"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.5 }}
                transition={{ duration: 1, delay: i * 0.2 }}
              />
            )
          })}
        </svg>

        {/* Wallet Nodes */}
        <AnimatePresence>
          {nodes.map((node, i) => {
            const color = STATUS_COLORS[node.status]
            const bg = STATUS_BG[node.status]

            return (
              <motion.div
                key={node.id}
                className="absolute w-14 h-14 rounded-full flex items-center justify-center text-[8px] font-mono font-semibold cursor-pointer"
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  transform: 'translate(-50%, -50%)',
                  background: bg,
                  border: `2px solid ${color}`,
                  boxShadow: `0 0 12px ${color}40, inset 0 0 8px ${color}20`,
                }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ delay: i * 0.05, duration: 0.4, ease: 'easeOut' }}
                whileHover={{
                  scale: 1.3,
                  boxShadow: `0 0 20px ${color}60, inset 0 0 12px ${color}30`,
                  zIndex: 10,
                }}
              >
                <span className="text-center leading-tight">
                  {node.shortAddr}
                </span>
                {/* Status pulse ring */}
                <motion.div
                  className="absolute -inset-1 rounded-full"
                  style={{ border: `1px solid ${color}` }}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.6, 0, 0.6],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Floating stats */}
        <motion.div
          className="absolute top-3 right-3 bg-[rgba(0,0,0,0.5)] backdrop-blur border border-blue-400/30 rounded-lg p-2 text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="text-slate-400">Active Nodes</div>
          <div className="text-blue-400 font-bold">{nodes.length} Wallets</div>
        </motion.div>
      </div>

      {/* Event Notifications */}
      <div className="mt-3 space-y-1.5">
        <AnimatePresence>
          {events.map((event) => (
            <motion.div
              key={event.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-[rgba(0,0,0,0.3)] border border-blue-400/20 text-xs"
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <motion.span
                className="font-bold text-[10px] uppercase"
                style={{ color: event.type === 'WHALE MOVE' ? '#fbbf24' : event.type === 'ENTRY' ? '#4ade80' : event.type === 'EXIT' ? '#f87171' : '#f59e0b' }}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {event.type}
              </motion.span>
              <span className="text-slate-300">
                <span className="font-mono text-blue-300">{event.wallet}</span> {event.action} <span className="text-green-300">{event.amount} SOL</span> in <span className="text-purple-300">${event.token}</span>
              </span>
              <span className="ml-auto text-slate-500">
                {Math.floor((Date.now() - event.timestamp) / 1000)}s ago
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {events.length === 0 && !loading && (
          <div className="text-xs text-slate-500 text-center py-2">
            Waiting for whale events...
          </div>
        )}
      </div>
    </div>
  )
}
