"use client"
import { useState, useEffect } from 'react'

interface Alert {
  id: string
  pool: string
  type: 'apr-up' | 'apr-down' | 'tvl-up' | 'tvl-down' | 'whale-in' | 'whale-out' | 'fee-spike' | 'volume-spike'
  threshold: number
  enabled: boolean
  createdAt: number
  lastTriggered?: number
}

const ALERT_TYPES = [
  { id: 'apr-up', label: 'APR Increased', icon: '📈', color: '#22c55e' },
  { id: 'apr-down', label: 'APR Decreased', icon: '📉', color: '#ef4444' },
  { id: 'tvl-up', label: 'TVL Increased', icon: '💚', color: '#10b981' },
  { id: 'tvl-down', label: 'TVL Decreased', icon: '💔', color: '#ef4444' },
  { id: 'whale-in', label: 'Whale Entered Pool', icon: '🐋', color: '#3b82f6' },
  { id: 'whale-out', label: 'Whale Left Pool', icon: '🌊', color: '#f59e0b' },
  { id: 'fee-spike', label: 'Fee Spike Detected', icon: '💰', color: '#eab308' },
  { id: 'volume-spike', label: 'Volume Spike', icon: '📊', color: '#8b5cf6' },
]

export default function DLMMAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    pool: '',
    type: 'apr-up' as const,
    threshold: 5,
  })

  // Load alerts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dlmm_alerts')
    if (saved) {
      try {
        setAlerts(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading alerts:', e)
      }
    }
  }, [])

  // Save alerts to localStorage
  useEffect(() => {
    localStorage.setItem('dlmm_alerts', JSON.stringify(alerts))
  }, [alerts])

  const addAlert = () => {
    if (!formData.pool.trim()) return

    const newAlert: Alert = {
      id: Date.now().toString(),
      pool: formData.pool,
      type: formData.type,
      threshold: formData.threshold,
      enabled: true,
      createdAt: Date.now(),
    }

    setAlerts([...alerts, newAlert])
    setFormData({ pool: '', type: 'apr-up', threshold: 5 })
    setShowForm(false)
  }

  const toggleAlert = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a))
  }

  const deleteAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id))
  }

  const getAlertTypeInfo = (type: string) => {
    return ALERT_TYPES.find(t => t.id === type) || ALERT_TYPES[0]
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔔</span>
          <h3 className="text-xl font-semibold text-slate-100">DLMM Alerts</h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[rgba(59,130,246,0.15)] text-blue-400">
            {alerts.filter(a => a.enabled).length} active
          </span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-400/50 text-green-300 text-sm font-semibold hover:bg-green-500/30 transition"
        >
          {showForm ? 'Cancel' : '+ New Alert'}
        </button>
      </div>

      {/* Add Alert Form */}
      {showForm && (
        <div className="card-glass rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Pool Input */}
            <input
              type="text"
              placeholder="Pool name (e.g., SOL-USDC)"
              value={formData.pool}
              onChange={(e) => setFormData({ ...formData, pool: e.target.value })}
              className="rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-slate-100 placeholder-slate-500"
            />

            {/* Alert Type */}
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-slate-100"
            >
              {ALERT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>

            {/* Threshold */}
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Threshold %"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: Number(e.target.value) })}
                className="flex-1 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-slate-100 placeholder-slate-500"
              />
              <button
                onClick={addAlert}
                className="px-4 py-2 rounded-lg bg-green-500/20 border border-green-400/50 text-green-300 font-semibold hover:bg-green-500/30 transition"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="card-glass rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🔕</div>
          <p className="text-slate-400">No alerts configured</p>
          <p className="text-sm text-slate-500 mt-1">Create alerts to monitor pool changes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const typeInfo = getAlertTypeInfo(alert.type)
            return (
              <div
                key={alert.id}
                className={`card-glass rounded-xl p-4 border transition ${
                  alert.enabled
                    ? 'border-slate-600/30 hover:bg-[rgba(255,255,255,0.04)]'
                    : 'border-slate-700/30 opacity-60 bg-[rgba(255,255,255,0.01)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleAlert(alert.id)}
                      className={`w-5 h-5 rounded border-2 transition flex items-center justify-center ${
                        alert.enabled
                          ? 'bg-blue-500 border-blue-400'
                          : 'border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      {alert.enabled && <span className="text-white text-xs">✓</span>}
                    </button>

                    {/* Alert Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{typeInfo.icon}</span>
                        <div>
                          <div className="font-semibold text-slate-100">{alert.pool}</div>
                          <div className="text-xs text-slate-400">
                            {typeInfo.label} • When change exceeds ±{alert.threshold}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-2">
                    {alert.lastTriggered && (
                      <div className="text-xs text-slate-400 text-right">
                        <div>Last triggered:</div>
                        <div>{new Date(alert.lastTriggered).toLocaleDateString()}</div>
                      </div>
                    )}
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Status Indicator */}
                {alert.enabled && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    Monitoring active
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Alert Statistics */}
      {alerts.length > 0 && (
        <div className="card-glass rounded-xl p-4">
          <h3 className="font-semibold text-slate-100 mb-3">Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-slate-400">Total Alerts</div>
              <div className="text-2xl font-bold text-blue-400">{alerts.length}</div>
            </div>
            <div>
              <div className="text-slate-400">Active</div>
              <div className="text-2xl font-bold text-green-400">{alerts.filter(a => a.enabled).length}</div>
            </div>
            <div>
              <div className="text-slate-400">Inactive</div>
              <div className="text-2xl font-bold text-slate-400">{alerts.filter(a => !a.enabled).length}</div>
            </div>
            <div>
              <div className="text-slate-400">Triggered Today</div>
              <div className="text-2xl font-bold text-amber-400">
                {alerts.filter(a => a.lastTriggered && new Date(a.lastTriggered).toDateString() === new Date().toDateString()).length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
