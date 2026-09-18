"use client"
import { useState } from 'react'

interface CalendarEvent {
  date: string
  campaign: string
  type: 'start' | 'snapshot' | 'deadline' | 'claim' | 'listing'
  icon: string
  color: string
}

const CALENDAR_EVENTS: CalendarEvent[] = [
  { date: '2026-01-15', campaign: 'Uniswap V4', type: 'start', icon: '🚀', color: '#3b82f6' },
  { date: '2026-01-18', campaign: 'Arbitrum', type: 'snapshot', icon: '📸', color: '#f59e0b' },
  { date: '2026-01-20', campaign: 'Optimism', type: 'deadline', icon: '⏰', color: '#ef4444' },
  { date: '2026-01-22', campaign: 'Base', type: 'claim', icon: '🎁', color: '#22c55e' },
  { date: '2026-01-25', campaign: 'Uniswap V4', type: 'snapshot', icon: '📸', color: '#f59e0b' },
  { date: '2026-01-28', campaign: 'Linea', type: 'deadline', icon: '⏰', color: '#ef4444' },
  { date: '2026-02-01', campaign: 'Starknet', type: 'start', icon: '🚀', color: '#3b82f6' },
  { date: '2026-02-05', campaign: 'Arbitrum', type: 'claim', icon: '🎁', color: '#22c55e' },
  { date: '2026-02-10', campaign: 'Polygon', type: 'listing', icon: '💹', color: '#a855f7' },
]

export default function AirdropCalendar() {
  const [selectedMonth, setSelectedMonth] = useState(new Date(2026, 0)) // January 2026

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()

  const currentDate = new Date()
  const daysInMonth = getDaysInMonth(selectedMonth)
  const firstDay = getFirstDayOfMonth(selectedMonth)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const previousMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))
  }

  const getEventForDate = (day: number) => {
    const dateStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return CALENDAR_EVENTS.filter(e => e.date === dateStr)
  }

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'start':
        return { label: 'Campaign Start', bg: 'from-blue-500/20 to-blue-600/10' }
      case 'snapshot':
        return { label: 'Snapshot', bg: 'from-amber-500/20 to-amber-600/10' }
      case 'deadline':
        return { label: 'Deadline', bg: 'from-red-500/20 to-red-600/10' }
      case 'claim':
        return { label: 'Claim Opens', bg: 'from-green-500/20 to-green-600/10' }
      case 'listing':
        return { label: 'Token Listing', bg: 'from-purple-500/20 to-purple-600/10' }
      default:
        return { label: 'Event', bg: 'from-slate-500/20 to-slate-600/10' }
    }
  }

  const monthName = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={previousMonth}
            className="px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400 hover:text-slate-200 transition"
          >
            ← Previous
          </button>
          <h2 className="text-xl font-bold text-slate-100">{monthName}</h2>
          <button
            onClick={nextMonth}
            className="px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400 hover:text-slate-200 transition"
          >
            Next →
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-xs font-bold text-slate-400 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Day cells */}
          {days.map((day) => {
            const events = getEventForDate(day)
            const isToday =
              day === currentDate.getDate() &&
              selectedMonth.getMonth() === currentDate.getMonth() &&
              selectedMonth.getFullYear() === currentDate.getFullYear()

            return (
              <div
                key={day}
                className={`aspect-square p-1 rounded-lg border transition-all ${
                  isToday
                    ? 'bg-blue-500/20 border-blue-400/50'
                    : events.length > 0
                    ? 'bg-[rgba(255,255,255,0.04)] border-slate-600/30'
                    : 'bg-[rgba(255,255,255,0.01)] border-slate-700/20'
                }`}
              >
                <div className="text-xs font-bold text-slate-200 mb-0.5">{day}</div>
                <div className="space-y-0.5">
                  {events.slice(0, 2).map((event, idx) => (
                    <div
                      key={idx}
                      className="text-xs px-1 py-0.5 rounded text-center font-bold truncate"
                      style={{ background: `${event.color}20`, color: event.color }}
                      title={event.campaign}
                    >
                      {event.icon}
                    </div>
                  ))}
                  {events.length > 2 && (
                    <div className="text-xs text-slate-400 text-center">
                      +{events.length - 2}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">📅 Upcoming Events</h3>
        <div className="space-y-3">
          {CALENDAR_EVENTS.filter(e => new Date(e.date) >= new Date())
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 8)
            .map((event, idx) => {
              const typeInfo = getTypeInfo(event.type)
              const eventDate = new Date(event.date)
              const daysUntil = Math.ceil((eventDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

              return (
                <div
                  key={idx}
                  className={`card-glass rounded-lg p-3 border border-slate-700/30 bg-gradient-to-r ${typeInfo.bg}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl">{event.icon}</span>
                      <div>
                        <h4 className="font-bold text-slate-100">{event.campaign}</h4>
                        <p className="text-xs text-slate-400">{typeInfo.label}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-100">{eventDate.toDateString()}</div>
                      <div className={`text-xs font-bold ${daysUntil <= 3 ? 'text-red-400' : 'text-slate-400'}`}>
                        {daysUntil <= 0 ? 'Today!' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Legend */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30">
        <h3 className="text-lg font-semibold text-slate-100 mb-3">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { icon: '🚀', label: 'Campaign Start', color: '#3b82f6' },
            { icon: '📸', label: 'Snapshot', color: '#f59e0b' },
            { icon: '⏰', label: 'Deadline', color: '#ef4444' },
            { icon: '🎁', label: 'Claim Opens', color: '#22c55e' },
            { icon: '💹', label: 'Token Listing', color: '#a855f7' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs text-slate-400">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
