"use client"
import { useState, useEffect } from 'react'

interface FavoriteAirdrop {
  id: string
  name: string
  symbol: string
  apr: number
  tvl: number
  completedTasks: number
  totalTasks: number
  addedAt: number
  alerts: {
    aprChange: boolean
    volumeSpike: boolean
    deadlineReminder: boolean
  }
}

export default function FavoriteAirdrops() {
  const [favorites, setFavorites] = useState<FavoriteAirdrop[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newFavorite, setNewFavorite] = useState({ name: '', symbol: '', totalTasks: 10 })

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('airdrop_favorites')
    if (saved) {
      try {
        setFavorites(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading favorites:', e)
      }
    }
  }, [])

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('airdrop_favorites', JSON.stringify(favorites))
  }, [favorites])

  const addFavorite = () => {
    if (!newFavorite.name.trim() || !newFavorite.symbol.trim()) return

    const favorite: FavoriteAirdrop = {
      id: Date.now().toString(),
      name: newFavorite.name,
      symbol: newFavorite.symbol,
      apr: Math.random() * 50 + 10,
      tvl: Math.random() * 50000000 + 5000000,
      completedTasks: Math.floor(Math.random() * (newFavorite.totalTasks - 2)) + 1,
      totalTasks: newFavorite.totalTasks,
      addedAt: Date.now(),
      alerts: {
        aprChange: false,
        volumeSpike: false,
        deadlineReminder: true,
      },
    }

    setFavorites([...favorites, favorite])
    setNewFavorite({ name: '', symbol: '', totalTasks: 10 })
    setShowAddForm(false)
  }

  const removeFavorite = (id: string) => {
    setFavorites(favorites.filter(f => f.id !== id))
  }

  const updateTaskProgress = (id: string, completed: number) => {
    setFavorites(
      favorites.map(f =>
        f.id === id ? { ...f, completedTasks: Math.min(completed, f.totalTasks) } : f
      )
    )
  }

  const toggleAlert = (id: string, alertType: keyof FavoriteAirdrop['alerts']) => {
    setFavorites(
      favorites.map(f =>
        f.id === id
          ? { ...f, alerts: { ...f.alerts, [alertType]: !f.alerts[alertType] } }
          : f
      )
    )
  }

  const progressPercentage = (fav: FavoriteAirdrop) => Math.round((fav.completedTasks / fav.totalTasks) * 100)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⭐</span>
          <h3 className="text-xl font-semibold text-slate-100">Favorite Campaigns</h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[rgba(234,179,8,0.15)] text-yellow-400">
            {favorites.length} saved
          </span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-400/50 text-blue-300 text-sm font-semibold hover:bg-blue-500/30 transition"
        >
          {showAddForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="card-glass rounded-xl p-4 border border-slate-700/30 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Campaign name (e.g., Uniswap V4)"
              value={newFavorite.name}
              onChange={(e) => setNewFavorite({ ...newFavorite, name: e.target.value })}
              className="rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-slate-100 placeholder-slate-500"
            />
            <input
              type="text"
              placeholder="Symbol (e.g., UNI)"
              value={newFavorite.symbol}
              onChange={(e) => setNewFavorite({ ...newFavorite, symbol: e.target.value })}
              className="rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-slate-100 placeholder-slate-500"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Total tasks"
                value={newFavorite.totalTasks}
                onChange={(e) => setNewFavorite({ ...newFavorite, totalTasks: Number(e.target.value) })}
                className="flex-1 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-slate-100 placeholder-slate-500"
              />
              <button
                onClick={addFavorite}
                className="px-3 py-2 rounded-lg bg-green-500/20 border border-green-400/50 text-green-300 font-semibold hover:bg-green-500/30 transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Favorites List */}
      {favorites.length === 0 ? (
        <div className="card-glass rounded-xl p-8 border border-slate-700/30 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-slate-400">No favorite campaigns yet</p>
          <p className="text-sm text-slate-500 mt-1">Save campaigns to track progress and receive alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((fav) => (
            <div
              key={fav.id}
              className="card-glass rounded-xl p-4 border border-slate-700/30 hover:border-slate-600/50 transition"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-bold text-lg text-slate-100">{fav.name}</h4>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Added {new Date(fav.addedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => removeFavorite(fav.id)}
                  className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition"
                >
                  Remove
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-xs text-slate-400">Symbol</div>
                  <div className="font-bold text-blue-400">{fav.symbol}</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-xs text-slate-400">APR</div>
                  <div className="font-bold text-green-400">{fav.apr.toFixed(1)}%</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.02)] rounded p-2">
                  <div className="text-xs text-slate-400">TVL</div>
                  <div className="font-bold text-purple-400">${(fav.tvl / 1000000).toFixed(1)}M</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold text-slate-300">Task Progress</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={fav.totalTasks}
                      value={fav.completedTasks}
                      onChange={(e) => updateTaskProgress(fav.id, Number(e.target.value))}
                      className="w-12 h-6 rounded px-1 text-xs bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-slate-100"
                    />
                    <span className="text-xs text-slate-400">{fav.completedTasks}/{fav.totalTasks}</span>
                    <span className="text-xs font-bold text-blue-400">{progressPercentage(fav)}%</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-300"
                    style={{ width: `${progressPercentage(fav)}%` }}
                  />
                </div>
              </div>

              {/* Alerts */}
              <div className="pt-3 border-t border-slate-600/20">
                <div className="text-xs font-semibold text-slate-400 mb-2">Monitoring</div>
                <div className="flex gap-2 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fav.alerts.aprChange}
                      onChange={() => toggleAlert(fav.id, 'aprChange')}
                      className="w-3 h-3 rounded"
                    />
                    <span className="text-xs text-slate-400">APR Changes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fav.alerts.volumeSpike}
                      onChange={() => toggleAlert(fav.id, 'volumeSpike')}
                      className="w-3 h-3 rounded"
                    />
                    <span className="text-xs text-slate-400">Volume Spike</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fav.alerts.deadlineReminder}
                      onChange={() => toggleAlert(fav.id, 'deadlineReminder')}
                      className="w-3 h-3 rounded"
                    />
                    <span className="text-xs text-slate-400">Deadline Reminder</span>
                  </label>
                </div>
              </div>

              {/* Monitoring Status */}
              <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Monitoring active
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk Actions */}
      {favorites.length > 0 && (
        <div className="card-glass rounded-xl p-4 border border-slate-700/30">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Bulk Actions</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
              <span className="text-sm text-slate-300">Enable notifications for all</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
              <span className="text-sm text-slate-300">Sort by progress</span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
