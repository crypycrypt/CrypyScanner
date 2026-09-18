"use client"
import { useState, useEffect } from 'react'

interface FavoritePool {
  id: string
  name: string
  pair: string
  apr: number
  tvl: number
  savedAt: number
}

export default function DLMMFavoritePools() {
  const [favorites, setFavorites] = useState<FavoritePool[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPoolName, setNewPoolName] = useState('')

  // Load favorites from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('dlmm_favorites')
    if (saved) {
      try {
        setFavorites(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading favorites:', e)
      }
    }
  }, [])

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dlmm_favorites', JSON.stringify(favorites))
  }, [favorites])

  const addFavorite = () => {
    if (!newPoolName.trim()) return

    const mockPool: FavoritePool = {
      id: Date.now().toString(),
      name: newPoolName,
      pair: newPoolName.split('-').join('/'),
      apr: Math.random() * 50 + 10,
      tvl: Math.random() * 50000000 + 5000000,
      savedAt: Date.now(),
    }

    setFavorites([...favorites, mockPool])
    setNewPoolName('')
    setShowAddForm(false)
  }

  const removeFavorite = (id: string) => {
    setFavorites(favorites.filter(f => f.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⭐</span>
          <h3 className="text-xl font-semibold text-slate-100">Favorite Pools</h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[rgba(234,179,8,0.15)] text-yellow-400">
            {favorites.length} pools
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
        <div className="card-glass rounded-xl p-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Pool name (e.g., SOL-USDC)"
              value={newPoolName}
              onChange={(e) => setNewPoolName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addFavorite()}
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
      )}

      {/* Favorites List */}
      {favorites.length === 0 ? (
        <div className="card-glass rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-slate-400">No favorite pools yet</p>
          <p className="text-sm text-slate-500 mt-1">Add pools you want to monitor</p>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((pool) => (
            <div
              key={pool.id}
              className="card-glass rounded-xl p-4 hover:bg-[rgba(255,255,255,0.04)] transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-bold text-lg text-slate-100">{pool.name}</h4>
                  <p className="text-xs text-slate-400">{pool.pair}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <div>
                      <div className="text-slate-400">APR</div>
                      <div className="font-bold text-green-400">{pool.apr.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-slate-400">TVL</div>
                      <div className="font-bold text-blue-400">${(pool.tvl / 1000000).toFixed(1)}M</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Saved</div>
                      <div className="font-bold text-slate-300">
                        {new Date(pool.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs font-semibold hover:bg-blue-500/30 transition">
                    View
                  </button>
                  <button
                    onClick={() => removeFavorite(pool.id)}
                    className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Monitoring Status */}
              <div className="mt-3 pt-3 border-t border-slate-600/20">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Monitoring • Last update 5 mins ago
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alert Preferences */}
      {favorites.length > 0 && (
        <div className="card-glass rounded-xl p-4">
          <h3 className="font-semibold text-slate-100 mb-3">Alert Preferences</h3>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
              <span className="text-slate-300">Alert on APR changes ±5%</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
              <span className="text-slate-300">Alert on volume spike</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded" />
              <span className="text-slate-300">Telegram notifications</span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
