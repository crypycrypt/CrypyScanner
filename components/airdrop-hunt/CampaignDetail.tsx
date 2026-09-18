"use client"
import { useState } from 'react'

interface CampaignProject {
  id: string
  name: string
  symbol: string
  description: string
  website: string
  twitter: string
  discord: string
  telegram: string
  galxe: string
  layer3: string
  zealy: string
  questn: string
  snapshot: string
  deadline: string
  tokenomics?: {
    totalSupply: string
    distribution: string
    vesting: string
  }
}

const CAMPAIGNS: CampaignProject[] = [
  {
    id: '1',
    name: 'Uniswap V4',
    symbol: 'UNI',
    description: 'Uniswap V4 introduces customizable liquidity and dynamic fee mechanisms for the next generation of decentralized exchange.',
    website: 'https://uniswap.org',
    twitter: 'https://twitter.com/Uniswap',
    discord: 'https://discord.gg/uniswap',
    telegram: 'https://t.me/uniswap',
    galxe: 'https://galxe.com/uniswap',
    layer3: 'https://layer3.xyz/uniswap',
    zealy: 'https://zealy.io/uniswap',
    questn: 'https://questn.com/uniswap',
    snapshot: 'https://snapshot.org/uniswap',
    deadline: '10 days',
    tokenomics: {
      totalSupply: '1.5B UNI',
      distribution: '60% Community, 25% Team, 15% Investors',
      vesting: '4-year vesting schedule',
    },
  },
  {
    id: '2',
    name: 'Arbitrum',
    symbol: 'ARB',
    description: 'Arbitrum is a suite of Ethereum scaling solutions designed to improve performance and reduce costs.',
    website: 'https://arbitrum.io',
    twitter: 'https://twitter.com/arbitrum',
    discord: 'https://discord.gg/arbitrum',
    telegram: 'https://t.me/arbitrum',
    galxe: 'https://galxe.com/arbitrum',
    layer3: 'https://layer3.xyz/arbitrum',
    zealy: 'https://zealy.io/arbitrum',
    questn: 'https://questn.com/arbitrum',
    snapshot: 'https://snapshot.org/arbitrum',
    deadline: '15 days',
    tokenomics: {
      totalSupply: '10B ARB',
      distribution: '42.78% DAO Treasury, 26.94% Investors, 27.06% Team, 3.22% Airdrop',
      vesting: 'Various based on allocation',
    },
  },
]

export default function CampaignDetail() {
  const [selectedId, setSelectedId] = useState('1')
  const campaign = CAMPAIGNS.find((c) => c.id === selectedId)

  if (!campaign) return null

  const socialLinks = [
    { label: 'Website', url: campaign.website, icon: '🌐' },
    { label: 'Twitter', url: campaign.twitter, icon: '𝕏' },
    { label: 'Discord', url: campaign.discord, icon: '💬' },
    { label: 'Telegram', url: campaign.telegram, icon: '📱' },
    { label: 'Galxe', url: campaign.galxe, icon: '✨' },
    { label: 'Layer3', url: campaign.layer3, icon: '📋' },
    { label: 'Zealy', url: campaign.zealy, icon: '🎯' },
    { label: 'QuestN', url: campaign.questn, icon: '⚡' },
    { label: 'Snapshot', url: campaign.snapshot, icon: '📊' },
  ]

  return (
    <div className="space-y-4">
      {/* Campaign Selector */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Select Campaign</h3>
        <div className="flex flex-wrap gap-2">
          {CAMPAIGNS.map((camp) => (
            <button
              key={camp.id}
              onClick={() => setSelectedId(camp.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                selectedId === camp.id
                  ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                  : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
              }`}
            >
              {camp.name}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign Header */}
      <div className="card-glass rounded-xl p-6 border border-slate-700/30">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {campaign.name}
            </h1>
            <p className="text-slate-400 mt-1">{campaign.symbol}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-amber-400 mb-1">Deadline</div>
            <div className="text-2xl font-bold text-slate-100">{campaign.deadline}</div>
          </div>
        </div>
        <p className="text-slate-300 text-lg leading-relaxed">{campaign.description}</p>
      </div>

      {/* Social Links Grid */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Connect & Participate</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card-glass rounded-lg p-3 border border-slate-700/30 hover:border-slate-600/50 transition group text-center"
            >
              <div className="text-2xl mb-2">{link.icon}</div>
              <div className="text-xs font-semibold text-slate-300 group-hover:text-blue-300 transition">
                {link.label}
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Tokenomics */}
      {campaign.tokenomics && (
        <div className="card-glass rounded-xl p-4 border border-slate-700/30">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Tokenomics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[rgba(255,255,255,0.02)] rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-2">Total Supply</div>
              <div className="text-2xl font-bold text-blue-400">{campaign.tokenomics.totalSupply}</div>
            </div>
            <div className="bg-[rgba(255,255,255,0.02)] rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-2">Distribution</div>
              <div className="text-sm font-semibold text-slate-200">{campaign.tokenomics.distribution}</div>
            </div>
            <div className="bg-[rgba(255,255,255,0.02)] rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-2">Vesting</div>
              <div className="text-sm font-semibold text-slate-200">{campaign.tokenomics.vesting}</div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Timeline */}
      <div className="card-glass rounded-xl p-4 border border-slate-700/30">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">📅 Campaign Timeline</h3>
        <div className="space-y-3">
          {[
            { label: 'Campaign Start', date: 'Started 30 days ago', icon: '🚀' },
            { label: 'Current Phase', date: 'Active Tasks', icon: '⚡' },
            { label: 'Snapshot', date: 'In 5 days', icon: '📸' },
            { label: 'Deadline', date: `${campaign.deadline}`, icon: '⏰' },
            { label: 'Claim Date', date: 'TBA', icon: '🎁' },
            { label: 'Listing Date', date: 'TBA', icon: '💹' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-[rgba(255,255,255,0.02)] rounded-lg">
              <span className="text-2xl">{item.icon}</span>
              <div className="flex-1">
                <div className="text-slate-400 text-xs">{item.label}</div>
                <div className="text-slate-100 font-semibold">{item.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Participants', value: '125K+', icon: '👥' },
          { label: 'Avg Est. Reward', value: '$1,250', icon: '💰' },
          { label: 'Difficulty', value: 'Medium', icon: '⚡' },
          { label: 'Blockchain', value: 'Multi-Chain', icon: '🔗' },
        ].map((stat, idx) => (
          <div key={idx} className="card-glass rounded-xl p-4 border border-slate-700/30">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-slate-400 text-sm mb-1">{stat.label}</div>
            <div className="text-2xl font-bold text-slate-100">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
