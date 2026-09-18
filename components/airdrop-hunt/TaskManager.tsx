"use client"
import { useState, useEffect } from 'react'

interface Task {
  id: string
  campaign: string
  name: string
  category: string
  status: 'pending' | 'completed' | 'expired'
  reward: string
  points: number
  dueDate: string
  proof?: string
}

const TASK_CATEGORIES = [
  { id: 'social', label: 'Follow Twitter', icon: '𝕏' },
  { id: 'discord', label: 'Join Discord', icon: '💬' },
  { id: 'telegram', label: 'Join Telegram', icon: '📱' },
  { id: 'swap', label: 'Swap', icon: '🔄' },
  { id: 'bridge', label: 'Bridge', icon: '🌉' },
  { id: 'liquidity', label: 'Add Liquidity', icon: '💧' },
  { id: 'stake', label: 'Stake', icon: '🔒' },
  { id: 'nft', label: 'Mint NFT', icon: '🖼️' },
  { id: 'checkin', label: 'Daily Check-in', icon: '✅' },
  { id: 'referral', label: 'Referral', icon: '👥' },
  { id: 'testnet', label: 'Testnet', icon: '🧪' },
  { id: 'mainnet', label: 'Mainnet', icon: '🚀' },
]

const SAMPLE_TASKS: Task[] = [
  { id: '1', campaign: 'Uniswap V4', name: 'Follow Twitter', category: 'social', status: 'completed', reward: '50 pts', points: 50, dueDate: '10 days', proof: 'twitter.com/Uniswap' },
  { id: '2', campaign: 'Uniswap V4', name: 'Join Discord', category: 'discord', status: 'completed', reward: '50 pts', points: 50, dueDate: '10 days' },
  { id: '3', campaign: 'Uniswap V4', name: 'Join Telegram', category: 'telegram', status: 'pending', reward: '50 pts', points: 50, dueDate: '10 days' },
  { id: '4', campaign: 'Uniswap V4', name: 'Swap on V4', category: 'swap', status: 'pending', reward: '200 pts', points: 200, dueDate: '10 days' },
  { id: '5', campaign: 'Uniswap V4', name: 'Add Liquidity', category: 'liquidity', status: 'pending', reward: '300 pts', points: 300, dueDate: '10 days' },
  { id: '6', campaign: 'Uniswap V4', name: 'Stake UNI', category: 'stake', status: 'pending', reward: '250 pts', points: 250, dueDate: '10 days' },
  { id: '7', campaign: 'Arbitrum', name: 'Follow Twitter', category: 'social', status: 'completed', reward: '40 pts', points: 40, dueDate: '15 days' },
  { id: '8', campaign: 'Arbitrum', name: 'Daily Check-in', category: 'checkin', status: 'pending', reward: '100 pts', points: 100, dueDate: '1 day' },
  { id: '9', campaign: 'Optimism', name: 'Bridge to Optimism', category: 'bridge', status: 'pending', reward: '150 pts', points: 150, dueDate: '3 days' },
  { id: '10', campaign: 'Base', name: 'Mint Base NFT', category: 'nft', status: 'pending', reward: '200 pts', points: 200, dueDate: '20 days' },
]

export default function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>(SAMPLE_TASKS)
  const [selectedCampaign, setSelectedCampaign] = useState<string>('Uniswap V4')
  const [filterBy, setFilterBy] = useState<'all' | 'pending' | 'completed' | 'expired'>('all')

  const campaigns = Array.from(new Set(tasks.map(t => t.campaign)))

  const filtered = tasks.filter(t => {
    if (selectedCampaign && t.campaign !== selectedCampaign) return false
    if (filterBy !== 'all' && t.status !== filterBy) return false
    return true
  })

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => 
      t.id === id 
        ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' }
        : t
    ))
  }

  const completedCount = tasks.filter(t => t.status === 'completed').length
  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const totalPoints = tasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.points, 0)

  const getCategoryIcon = (cat: string) => {
    return TASK_CATEGORIES.find(c => c.id === cat)?.icon || '📝'
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-glass rounded-xl p-4 border border-slate-700/30 bg-gradient-to-br from-blue-500/10 to-blue-600/5">
          <div className="text-slate-400 text-sm">Total Tasks</div>
          <div className="text-3xl font-bold text-blue-400">{tasks.length}</div>
        </div>
        <div className="card-glass rounded-xl p-4 border border-slate-700/30 bg-gradient-to-br from-green-500/10 to-green-600/5">
          <div className="text-slate-400 text-sm">Completed</div>
          <div className="text-3xl font-bold text-green-400">{completedCount}</div>
        </div>
        <div className="card-glass rounded-xl p-4 border border-slate-700/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5">
          <div className="text-slate-400 text-sm">Pending</div>
          <div className="text-3xl font-bold text-amber-400">{pendingCount}</div>
        </div>
        <div className="card-glass rounded-xl p-4 border border-slate-700/30 bg-gradient-to-br from-purple-500/10 to-purple-600/5">
          <div className="text-slate-400 text-sm">Points Earned</div>
          <div className="text-3xl font-bold text-purple-400">{totalPoints}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30 space-y-3">
        {/* Campaign Filter */}
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Campaign</label>
          <div className="flex flex-wrap gap-2">
            {campaigns.map(c => (
              <button
                key={c}
                onClick={() => setSelectedCampaign(c)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  selectedCampaign === c
                    ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                    : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Status</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Tasks' },
              { id: 'pending', label: 'Pending' },
              { id: 'completed', label: 'Completed' },
              { id: 'expired', label: 'Expired' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterBy(f.id as any)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  filterBy === f.id
                    ? 'bg-green-500/20 border border-green-400/50 text-green-300'
                    : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card-glass rounded-xl p-8 border border-slate-700/30 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-slate-400">No tasks found</p>
          </div>
        ) : (
          filtered.map(task => (
            <div
              key={task.id}
              className={`card-glass rounded-xl p-4 border transition-all ${
                task.status === 'completed'
                  ? 'border-slate-700/20 bg-[rgba(255,255,255,0.01)]'
                  : 'border-slate-700/30 hover:border-slate-600/50'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`mt-1 w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                    task.status === 'completed'
                      ? 'bg-green-500 border-green-400'
                      : 'border-slate-600 hover:border-slate-500'
                  }`}
                >
                  {task.status === 'completed' && <span className="text-white text-sm">✓</span>}
                </button>

                {/* Task Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getCategoryIcon(task.category)}</span>
                    <h4 className={`font-semibold ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                      {task.name}
                    </h4>
                  </div>
                  <div className="text-xs text-slate-400 mb-2">
                    {task.campaign} • Due: {task.dueDate}
                  </div>
                  {task.proof && (
                    <div className="text-xs text-blue-400 mb-2">
                      📋 Proof: {task.proof}
                    </div>
                  )}
                </div>

                {/* Reward */}
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-amber-400">{task.reward}</div>
                  <div className="text-xs text-slate-400">{task.points} pts</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Progress Summary */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30">
        <h3 className="text-lg font-semibold text-slate-100 mb-3">Overall Progress</h3>
        <div className="space-y-3">
          {campaigns.map(campaign => {
            const campaignTasks = tasks.filter(t => t.campaign === campaign)
            const completed = campaignTasks.filter(t => t.status === 'completed').length
            const percentage = (completed / campaignTasks.length) * 100
            
            return (
              <div key={campaign}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-300">{campaign}</span>
                  <span className="text-sm text-slate-400">{completed}/{campaignTasks.length}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-emerald-400 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
