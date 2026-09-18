"use client"

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type EventType = 'WATCHER' | 'LADDER' | 'SNIPER' | 'STOP' | 'COPY' | 'EXIT' | 'ALERT'

interface DeskFeedEvent {
  id: string
  timestamp: string
  type: EventType
  wallet: string
  action: string
  amount: string
  token: string
  profit?: string
  details?: string
}

interface DeskFeedResponse {
  ok: boolean
  cached?: boolean
  stale?: boolean
  events: DeskFeedEvent[]
  fetchedAt: string
}

const EVENT_COLORS: Record<EventType, string> = {
  WATCHER: '#fbbf24',
  LADDER: '#4ade80',
  SNIPER: '#60a5fa',
  STOP: '#f87171',
  COPY: '#22c55e',
  EXIT: '#a78bfa',
  ALERT: '#f59e0b',
}

const EVENT_BG: Record<EventType, string> = {
  WATCHER: 'rgba(251,191,36,0.1)',
  LADDER: 'rgba(74,222,128,0.1)',
  SNIPER: 'rgba(96,165,250,0.1)',
  STOP: 'rgba(248,113,113,0.1)',
  COPY: 'rgba(34,197,94,0.1)',
  EXIT: 'rgba(168,85,247,0.1)',
  ALERT: 'rgba(245,158,11,0.1)',
}

export default function DeskFeed() {
  const [events, setEvents] = useState<DeskFeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5_000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events, autoScroll])

  async function fetchData() {
    try {
      setLoading(false)
      const res = await fetch('/api/smart-money/desk-feed')
      if (!res.ok) throw new Error('Failed to fetch')
      const result: DeskFeedResponse = await res.json()

      // Only add new events
      const newEvents = result.events.filter((e) => !seenIds.has(e.id))
      if (newEvents.length > 0) {
        setEvents((prev) => {
          const updated = [...newEvents, ...prev].slice(0, 50)
          return updated
        })
        setSeenIds((prev) => {
          const updated = new Set(prev)
          newEvents.forEach((e) => updated.add(e.id))
          if (updated.size > 100) {
            const arr = Array.from(updated).slice(-100)
            return new Set(arr)
          }
          return updated
        })
      }
    } catch (error) {
      console.error('Error fetching desk feed:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatEventLine(event: DeskFeedEvent): string {
    const parts: string[] = []

    if (event.wallet) parts.push(event.wallet)
    if (event.action) parts.push(event.action)
    if (event.amount) parts.push(event.amount + ' SOL')
    if (event.token) parts.push(event.token)
    if (event.profit) parts.push(event.profit)

    return parts.join(' ')
  }

  return (
    <div className="card-glass rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">DESK FEED</span>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className="px-2 py-1 rounded text-xs font-semibold transition-all"
          style={{
            background: autoScroll
              ? 'rgba(74,222,128,0.15)'
              : 'rgba(148,163,184,0.15)',
            color: autoScroll ? '#4ade80' : '#94a3b8',
            border: `1px solid ${autoScroll ? 'rgba(74,222,128,0.3)' : 'rgba(148,163,184,0.3)'}`,
          }}
        >
          {autoScroll ? 'PAUSE' : 'RESUME'}
        </button>
      </div>

      {/* Event List */}
      <div
        ref={scrollRef}
        className="h-[280px] overflow-y-auto space-y-1.5 pr-1"
      >
        <AnimatePresence initial={false}>
          {events.map((event) => {
            const color = EVENT_COLORS[event.type]
            const bg = EVENT_BG[event.type]

            return (
              <motion.div
                key={event.id}
                className="flex gap-2 text-xs"
                initial={{ opacity: 0, x: 100, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.95 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                {/* Timestamp */}
                <span className="text-slate-500 font-mono whitespace-nowrap">
                  {event.timestamp}
                </span>

                {/* Event Type Badge */}
                <span
                  className="px-1.5 py-0.5 rounded font-bold text-[10px] uppercase whitespace-nowrap"
                  style={{ backgroundColor: bg, color, border: `1px solid ${color}40` }}
                >
                  {event.type}
                </span>

                {/* Event Detail */}
                <span className="text-slate-300 flex-1">
                  {formatEventLine(event)}
                </span>

                {/* Profit (if available) */}
                {event.profit && (
                  <span
                    className="font-semibold whitespace-nowrap"
                    style={{
                      color: event.profit.startsWith('+') ? '#4ade80' : '#f87171',
                    }}
                  >
                    {event.profit}
                  </span>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>

        {events.length === 0 && !loading && (
          <div className="text-center py-8 text-slate-500 text-xs">
            Waiting for desk feed events...
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 text-[10px] text-slate-500 flex justify-between">
        <span>{events.length} events</span>
        <span>Auto-refresh every 5s</span>
      </div>
    </div>
  )
}
