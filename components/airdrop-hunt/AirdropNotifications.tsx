"use client"
import { useState, useEffect } from 'react'

interface Notification {
  id: string
  type: 'campaign-new' | 'snapshot-soon' | 'deadline-close' | 'claim-open' | 'listing' | 'task-new'
  campaign: string
  title: string
  message: string
  timestamp: string
  read: boolean
  icon: string
  color: string
}

const NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'campaign-new',
    campaign: 'Uniswap V4',
    title: 'New Campaign Available',
    message: 'Uniswap V4 airdrop campaign is now live! Join now to earn rewards.',
    timestamp: '2 hours ago',
    read: false,
    icon: '🚀',
    color: '#3b82f6',
  },
  {
    id: '2',
    type: 'snapshot-soon',
    campaign: 'Arbitrum',
    title: 'Snapshot Reminder',
    message: 'Arbitrum snapshot starts in 5 days. Make sure all tasks are completed.',
    timestamp: '1 day ago',
    read: false,
    icon: '📸',
    color: '#f59e0b',
  },
  {
    id: '3',
    type: 'deadline-close',
    campaign: 'Optimism',
    title: 'Deadline Approaching',
    message: 'Optimism campaign deadline is in 3 days. Hurry up to complete remaining tasks!',
    timestamp: '2 days ago',
    read: true,
    icon: '⏰',
    color: '#ef4444',
  },
  {
    id: '4',
    type: 'claim-open',
    campaign: 'Base',
    title: 'Claim is Now Open',
    message: 'Base airdrop claim period is now available. Claim your tokens!',
    timestamp: '3 days ago',
    read: true,
    icon: '🎁',
    color: '#22c55e',
  },
  {
    id: '5',
    type: 'listing',
    campaign: 'Polygon',
    title: 'Token Listing',
    message: 'Polygon token has been listed on major exchanges. Check the price!',
    timestamp: '5 days ago',
    read: true,
    icon: '💹',
    color: '#a855f7',
  },
  {
    id: '6',
    type: 'task-new',
    campaign: 'Linea',
    title: 'New Task Available',
    message: 'New Bridge task is now available in Linea campaign. Complete it for bonus points!',
    timestamp: '1 week ago',
    read: true,
    icon: '⭐',
    color: '#8b5cf6',
  },
]

export default function AirdropNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(NOTIFICATIONS)
  const [filterBy, setFilterBy] = useState<string>('all')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length

  const filtered = notifications.filter(n => {
    if (showUnreadOnly && n.read) return false
    if (filterBy === 'all') return true
    return n.type === filterBy
  })

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id))
  }

  const notificationTypes = [
    { id: 'all', label: 'All', icon: '📬' },
    { id: 'campaign-new', label: 'New Campaign', icon: '🚀' },
    { id: 'snapshot-soon', label: 'Snapshot Soon', icon: '📸' },
    { id: 'deadline-close', label: 'Deadline Close', icon: '⏰' },
    { id: 'claim-open', label: 'Claim Open', icon: '🎁' },
    { id: 'listing', label: 'Listing', icon: '💹' },
    { id: 'task-new', label: 'Task New', icon: '⭐' },
  ]

  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-blue-400">{unreadCount} unread</p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-400/50 text-blue-300 text-sm font-semibold hover:bg-blue-500/30 transition"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Filters */}
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Filter by Type</label>
          <div className="flex flex-wrap gap-2">
            {notificationTypes.map(type => (
              <button
                key={type.id}
                onClick={() => setFilterBy(type.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  filterBy === type.id
                    ? 'bg-purple-500/20 border border-purple-400/50 text-purple-300'
                    : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
                }`}
              >
                {type.icon} {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Unread Toggle */}
        <div className="mt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-slate-300">Show unread only</span>
          </label>
        </div>
      </div>

      {/* Notifications List */}
      {filtered.length === 0 ? (
        <div className="card-glass rounded-xl p-8 border border-slate-700/30 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-slate-400">No notifications to show</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(notification => (
            <div
              key={notification.id}
              className={`card-glass rounded-xl p-4 border transition-all ${
                notification.read
                  ? 'border-slate-700/20 opacity-75'
                  : 'border-slate-600/50 bg-[rgba(255,255,255,0.03)]'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Read Indicator */}
                {!notification.read && (
                  <button
                    onClick={() => markAsRead(notification.id)}
                    className="w-3 h-3 rounded-full bg-blue-400 flex-shrink-0 mt-1.5 hover:scale-110 transition"
                  />
                )}
                {notification.read && <div className="w-3 h-3 flex-shrink-0 mt-1.5" />}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{notification.icon}</span>
                        <h4 className={`font-bold ${notification.read ? 'text-slate-400' : 'text-slate-100'}`}>
                          {notification.title}
                        </h4>
                      </div>
                      <p className={`text-sm mt-1 ${notification.read ? 'text-slate-500' : 'text-slate-300'}`}>
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${notification.color}20`, color: notification.color }}>
                          {notification.campaign}
                        </span>
                        <span className="text-xs text-slate-500">{notification.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => deleteNotification(notification.id)}
                  className="text-slate-500 hover:text-slate-300 transition text-xl flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notification Preferences */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30">
        <h3 className="text-lg font-semibold text-slate-100 mb-3">🔧 Notification Preferences</h3>
        <div className="space-y-2">
          {[
            { label: 'New campaigns', enabled: true },
            { label: 'Snapshot reminders', enabled: true },
            { label: 'Deadline alerts', enabled: true },
            { label: 'Claim notifications', enabled: true },
            { label: 'Email notifications', enabled: false },
            { label: 'Browser notifications', enabled: false },
          ].map((pref, idx) => (
            <label key={idx} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={pref.enabled}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-slate-300">{pref.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
