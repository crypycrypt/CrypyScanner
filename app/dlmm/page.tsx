"use client"
import { useState } from 'react'
import DLMMDashboard from '../../components/dlmm/DLMMDashboard'
import DLMMPoolScanner from '../../components/dlmm/DLMMPoolScanner'
import DLMMAIRecommendation from '../../components/dlmm/DLMMAIRecommendation'
import DLMMAnalytics from '../../components/dlmm/DLMMAnalytics'
import DLMMProfitCalculator from '../../components/dlmm/DLMMProfitCalculator'
import DLMMFavoritePools from '../../components/dlmm/DLMMFavoritePools'
import DLMMAlerts from '../../components/dlmm/DLMMAlerts'

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
  { id: 'scanner', label: '🔍 Pool Scanner', icon: '🔍' },
  { id: 'ai-recommendation', label: '🤖 AI Recommend', icon: '🤖' },
  { id: 'analytics', label: '📈 Analytics', icon: '📈' },
  { id: 'calculator', label: '💰 Calculator', icon: '💰' },
  { id: 'favorites', label: '⭐ Favorites', icon: '⭐' },
  { id: 'alerts', label: '🔔 Alerts', icon: '🔔' },
]

export default function DLMMPage() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/assets/ic_chart.svg" alt="dlmm" className="w-6 h-6" />
          <h1 className="text-3xl font-bold text-neon">Meteora DLMM</h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(34,197,94,0.15)] text-green-400">LIVE</span>
        </div>
        <span className="text-xs text-slate-400">Dynamic Liquidity Market Maker</span>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-3 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
            style={{
              background: activeTab === tab.id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)',
              color: activeTab === tab.id ? '#60a5fa' : '#64748b',
              border: `1px solid ${activeTab === tab.id ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.05)'}`
            }}>
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'dashboard' && <DLMMDashboard />}
        {activeTab === 'scanner' && <DLMMPoolScanner />}
        {activeTab === 'ai-recommendation' && <DLMMAIRecommendation />}
        {activeTab === 'analytics' && <DLMMAnalytics />}
        {activeTab === 'calculator' && <DLMMProfitCalculator />}
        {activeTab === 'favorites' && <DLMMFavoritePools />}
        {activeTab === 'alerts' && <DLMMAlerts />}
      </div>
    </div>
  )
}
