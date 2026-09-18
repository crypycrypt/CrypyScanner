"use client"

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { MemeWallet } from '../../lib/meme/types'

async function fetchMemeWallets(): Promise<any> {
  const res = await fetch('/api/meme-wallets')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

async function fetchWalletDetail(address: string): Promise<any> {
  const res = await fetch(`/api/meme-wallet-detail?address=${encodeURIComponent(address)}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

function formatSOL(v: number): string {
  return `${v.toFixed(1)} SOL`
}

export default function MemeWalletTracker() {
  const [selectedWallet, setSelectedWallet] = useState<MemeWallet | null>(null)
  const [detailWallet, setDetailWallet] = useState<any>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['meme-wallets'],
    queryFn: fetchMemeWallets,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const wallets: MemeWallet[] = data?.wallets || []

  const handleWalletClick = (wallet: MemeWallet) => {
    setSelectedWallet(wallet)
  }

  const closeDetail = () => {
    setSelectedWallet(null)
    setDetailWallet(null)
  }

  return (
    <div className="meme-terminal">
      {/* Top Bar */}
      <div className="meme-topbar">
        <div className="logo">
          <span className="dot"></span>
          TRENCH<span className="lime">OS</span>
        </div>
        <div className="sep"></div>
        <div className="brand">WALLET INTELLIGENCE</div>
        <div className="chain">SOLANA · MEME WALLET TRACKER</div>
        <div className="topRight">
          <div className="stat">
            <label>TRACKED WALLETS</label>
            <b>{wallets.length}</b>
          </div>
          <div className="stat">
            <label>PROFITABLE</label>
            <b className="live">{wallets.filter(w => w.isProfit).length}</b>
          </div>
          <div className="stat">
            <label>STATUS</label>
            <b className="live">● LIVE</b>
          </div>
          <div className="nav">
            <button onClick={() => window.location.href = '/meme-scanner'}>SCANNER</button>
            <button className="active">WALLETS</button>
            <button onClick={() => window.location.href = '/meme-narrative'}>NARRATIVE</button>
            <button onClick={() => window.location.href = '/meme-risk'}>RISK</button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <button
          onClick={() => refetch()}
          className="bg-[#06140e] border border-[#173b2b] text-[#6c8d80] rounded px-3 py-1 text-xs font-bold cursor-pointer hover:border-[#607c2b] hover:text-[#baff38]"
        >
          REFRESH
        </button>
        <span className="text-xs text-[#648176]">
          {data?.fetchedAt ? `Updated: ${new Date(data.fetchedAt).toLocaleTimeString()}` : ''}
        </span>
      </div>

      {/* Wallet Table */}
      <div className="meme-panel">
        <div className="head">
          <span>SMART WALLET RADAR</span>
          <span className="muted">Behavioral Edge</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#0d2119]">
                <th className="text-left py-2 text-[#56766a] font-bold">WALLET</th>
                <th className="text-left py-2 text-[#56766a] font-bold">DNA</th>
                <th className="text-left py-2 text-[#56766a] font-bold">SCORE</th>
                <th className="text-left py-2 text-[#56766a] font-bold">ROI 30D</th>
                <th className="text-left py-2 text-[#56766a] font-bold">WIN RATE</th>
                <th className="text-left py-2 text-[#56766a] font-bold">TRADES</th>
                <th className="text-left py-2 text-[#56766a] font-bold">CATEGORY</th>
                <th className="text-left py-2 text-[#56766a] font-bold">LAST ACTIVE</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#475569]">
                    <span className="g-spinner lg"></span> Loading wallets...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#f87171]">
                    Error loading data. <button onClick={() => refetch()} className="underline">Retry</button>
                  </td>
                </tr>
              ) : wallets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#475569]">
                    No wallets found.
                  </td>
                </tr>
              ) : (
                wallets.map((wallet) => (
                  <tr
                    key={wallet.id}
                    className="border-b border-[#0d2119] hover:bg-[#07160f] cursor-pointer transition-colors"
                    onClick={() => handleWalletClick(wallet)}
                  >
                    <td className="py-2">
                      <div className="font-bold text-[#baff38]">{wallet.shortAddr}</div>
                      <div className="text-[#648176] text-xs">{wallet.label}</div>
                    </td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#0c2a4a] text-[#38bdf8] border border-[#0369a1]">
                        {wallet.dna}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#baff38]">{wallet.smartMoneyScore}</span>
                        <div className="w-12 h-1.5 bg-[#10271d] rounded">
                          <div className="h-full rounded bg-[#baff38]" style={{ width: `${wallet.smartMoneyScore}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-2">
                      <span className={wallet.isProfit ? 'text-green' : 'text-red'}>
                        {wallet.roi30d}
                      </span>
                    </td>
                    <td className="py-2 text-[#d8eee5]">{wallet.winRate}%</td>
                    <td className="py-2 text-[#d8eee5]">{wallet.tradeCount}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {wallet.preferredCategories.map((cat) => (
                          <span key={cat} className="px-1.5 py-0.5 rounded text-xs bg-[#06140e] text-[#648176]">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 text-[#648176]">{wallet.lastActive}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wallet Detail Modal */}
      {selectedWallet && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#06140e] border border-[#173b2b] rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-[#0d2119] flex justify-between items-center">
              <h3 className="font-bold text-[#baff38] text-lg">
                WALLET DNA: {selectedWallet.dna}
              </h3>
              <button
                onClick={closeDetail}
                className="text-[#648176] hover:text-[#d8eee5]"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-[#030c08] border border-[#173b2b] rounded p-3">
                  <div className="text-[#56766a] text-xs">SMART MONEY SCORE</div>
                  <div className="text-2xl font-bold text-[#baff38]">{selectedWallet.smartMoneyScore}/100</div>
                  <div className="text-xs text-[#648176]">Confidence: {selectedWallet.confidence}%</div>
                </div>
                <div className="bg-[#030c08] border border-[#173b2b] rounded p-3">
                  <div className="text-[#56766a] text-xs">ROI 30D</div>
                  <div className="text-2xl font-bold text-[#d8eee5]">{selectedWallet.roi30d}</div>
                </div>
                <div className="bg-[#030c08] border border-[#173b2b] rounded p-3">
                  <div className="text-[#56766a] text-xs">WIN RATE</div>
                  <div className="text-2xl font-bold text-[#22e58a]">{selectedWallet.winRate}%</div>
                </div>
                <div className="bg-[#030c08] border border-[#173b2b] rounded p-3">
                  <div className="text-[#56766a] text-xs">TRADES</div>
                  <div className="text-2xl font-bold text-[#d8eee5]">{selectedWallet.tradeCount}</div>
                  <div className="text-xs text-[#648176]">
                    {selectedWallet.successfulTrades}W / {selectedWallet.failedTrades}L
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[#baff38] font-bold mb-3 text-sm">BEHAVIORAL PROFILE</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#0d2119]">
                      <span className="text-[#648176]">Buying Behavior</span>
                      <span className="text-[#d8eee5]">{selectedWallet.buyingBehavior}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#0d2119]">
                      <span className="text-[#648176]">Selling Behavior</span>
                      <span className="text-[#d8eee5]">{selectedWallet.sellingBehavior}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#0d2119]">
                      <span className="text-[#648176]">Scaling Behavior</span>
                      <span className="text-[#d8eee5]">{selectedWallet.scalingBehavior}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#0d2119]">
                      <span className="text-[#648176]">Conviction</span>
                      <span className="text-[#d8eee5]">{selectedWallet.convictionBehavior}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#0d2119]">
                      <span className="text-[#648176]">Avg Entry MC</span>
                      <span className="text-[#d8eee5]">{selectedWallet.avgEntryMc}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#0d2119]">
                      <span className="text-[#648176]">Avg Exit MC</span>
                      <span className="text-[#d8eee5]">{selectedWallet.avgExitMc}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#0d2119]">
                      <span className="text-[#648176]">Avg Position Size</span>
                      <span className="text-[#d8eee5]">{selectedWallet.avgPositionSize}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#0d2119]">
                      <span className="text-[#648176]">Preferred Categories</span>
                      <span className="text-[#d8eee5]">{selectedWallet.preferredCategories.join(', ')}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-[#baff38] font-bold mb-3 text-sm">RECENT TRADES</h4>
                  <div className="space-y-2">
                    {selectedWallet.recentTrades?.map((trade: any) => (
                      <div key={trade.id} className="border-b border-[#0d2119] pb-2">
                        <div className="flex justify-between">
                          <span className="font-bold text-[#baff38]">{trade.token}</span>
                          <span className={trade.isWin ? 'text-green' : 'text-red'}>
                            {trade.roi > 0 ? '+' : ''}{trade.roi}x
                          </span>
                        </div>
                        <div className="text-xs text-[#648176]">
                          Entry: {formatSOL(trade.entryPrice)} → Exit: {formatSOL(trade.exitPrice)}
                        </div>
                      </div>
                    )) || <div className="text-xs text-[#648176]">No recent trades</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
