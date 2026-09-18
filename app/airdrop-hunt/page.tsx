"use client"
import { useState } from 'react'
import AirdropDashboard from '@/components/airdrop-hunt/AirdropDashboard'
import FeaturedAirdrops from '@/components/airdrop-hunt/FeaturedAirdrops'
import AirdropScanner from '@/components/airdrop-hunt/AirdropScanner'
import AIAirdropRecommendation from '@/components/airdrop-hunt/AIAirdropRecommendation'
import CampaignDetail from '@/components/airdrop-hunt/CampaignDetail'
import TaskManager from '@/components/airdrop-hunt/TaskManager'
import AirdropCalendar from '@/components/airdrop-hunt/AirdropCalendar'
import AirdropNotifications from '@/components/airdrop-hunt/AirdropNotifications'
import FavoriteAirdrops from '@/components/airdrop-hunt/FavoriteAirdrops'

const tabs = [
  { id: 'dashboard', label: '🎁 Dashboard', icon: '📊' },
  { id: 'featured', label: '🔥 Featured', icon: '🌟' },
  { id: 'scanner', label: '🔍 Scanner', icon: '🔎' },
  { id: 'ai-recommend', label: '🤖 AI Recommend', icon: '✨' },
  { id: 'campaign', label: '📋 Campaign', icon: '📑' },
  { id: 'tasks', label: '✅ Tasks', icon: '☑️' },
  { id: 'calendar', label: '📅 Calendar', icon: '📆' },
  { id: 'notifications', label: '🔔 Notifications', icon: '🔊' },
  { id: 'favorites', label: '⭐ Favorites', icon: '💫' },
]

export default function AirdropHuntPage() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-6 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              🎁 Airdrop Hunt
            </h1>
            <p className="text-slate-400 mt-2">Discover, track, and earn airdrops with AI-powered recommendations</p>
          </div>
          <div className="px-3 py-1 rounded-full bg-green-500/20 border border-green-400/50 text-green-300 text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            LIVE
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="card-glass rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                    : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="animate-fadeIn">
          {activeTab === 'dashboard' && <AirdropDashboard />}
          {activeTab === 'featured' && <FeaturedAirdrops />}
          {activeTab === 'scanner' && <AirdropScanner />}
          {activeTab === 'ai-recommend' && <AIAirdropRecommendation />}
          {activeTab === 'campaign' && <CampaignDetail />}
          {activeTab === 'tasks' && <TaskManager />}
          {activeTab === 'calendar' && <AirdropCalendar />}
          {activeTab === 'notifications' && <AirdropNotifications />}
          {activeTab === 'favorites' && <FavoriteAirdrops />}
        </div>
      </div>
    </main>
  )
}
