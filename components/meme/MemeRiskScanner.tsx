"use client"

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

async function fetchRiskData(): Promise<any> {
  const res = await fetch('/api/meme-risk')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

function formatNumber(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function getRiskColor(score: number): string {
  if (score >= 70) return 'text-[#ff5d69]'
  if (score >= 50) return 'text-[#fb923c]'
  if (score >= 30) return 'text-[#ffc85b]'
  return 'text-[#22e58a]'
}

function getRiskBgColor(score: number): string {
  if (score >= 70) return 'bg-[#2a0c0c] border-[#ff5d69]'
  if (score >= 50) return 'bg-[#2a130c] border-[#fb923c]'
  if (score >= 30) return 'bg-[#1a1a0c] border-[#ffc85b]'
  return 'bg-[#0c2a1a] border-[#22e58a]'
}

function getRiskLevel(score: number): string {
  if (score >= 70) return 'CRITICAL'
  if (score >= 50) return 'HIGH'
  if (score >= 30) return 'MEDIUM'
  return 'LOW'
}

function getTypeLabel(type: string): string {
  return type.replace(/_/g, ' ')
}

export default function MemeRiskScanner() {
  const [selectedEvent, setSelectedEvent] = useState<any>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['meme-risk'],
    queryFn: fetchRiskData,
    refetchInterval: 25_000,
    staleTime: 15_000,
  })

  const events = data?.events || []
  const tokenRisks = data?.tokenRisks || []
  const summary = data?.riskSummary || { critical: 0, high: 0, medium: 0, low: 0 }

  return (
    <div className="meme-terminal">
      {/* Top Bar */}
      <div className="meme-topbar">
        <div className="logo">
          <span className="dot"></span>
          TRENCH<span className="lime">OS</span>
        </div>
        <div className="sep"></div>
        <div className="brand">RISK INTELLIGENCE</div>
        <div className="chain">SOLANA · MEME RISK SCANNER</div>
        <div className="topRight">
          <div className="stat">
            <label>CRITICAL</label>
            <b className="text-[#ff5d69]">{summary.critical}</b>
          </div>
          <div className="stat">
            <label>HIGH</label>
            <b className="text-[#fb923c]">{summary.high}</b>
          </div>
          <div className="stat">
            <label>MEDIUM</label>
            <b className="text-[#ffc85b]">{summary.medium}</b>
          </div>
          <div className="stat">
            <label>STATUS</label>
            <b className="live">● LIVE</b>
          </div>
          <div className="nav">
            <button onClick={() => window.location.href = '/meme-scanner'}>SCANNER</button>
            <button onClick={() => window.location.href = '/meme-wallets'}>WALLETS</button>
            <button onClick={() => window.location.href = '/meme-narrative'}>NARRATIVE</button>
            <button onClick={() => window.location.href = '/meme-money-flow'}>FLOW</button>
            <button className="active">RISK</button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 mb-4 items-center">
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

      {/* Risk Summary */}
      <div className="meme-panel">
        <div className="head">
          <span>RISK SUMMARY</span>
          <span className="muted">{data?.totalEvents || 0} events detected</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#030c08] border border-[#2a0c0c] rounded p-3 text-center">
              <div className="text-[#ff5d69] text-2xl font-bold">{summary.critical}</div>
              <div className="text-[#648176] text-xs">CRITICAL</div>
            </div>
            <div className="bg-[#030c08] border border-[#7c3a0c] rounded p-3 text-center">
              <div className="text-[#fb923c] text-2xl font-bold">{summary.high}</div>
              <div className="text-[#648176] text-xs">HIGH</div>
            </div>
            <div className="bg-[#030c08] border border-[#7c7c0c] rounded p-3 text-center">
              <div className="text-[#ffc85b] text-2xl font-bold">{summary.medium}</div>
              <div className="text-[#648176] text-xs">MEDIUM</div>
            </div>
            <div className="bg-[#030c08] border border-[#0c7c3a] rounded p-3 text-center">
              <div className="text-[#22e58a] text-2xl font-bold">{summary.low}</div>
              <div className="text-[#648176] text-xs">LOW</div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Events Feed */}
      <div className="meme-panel">
        <div className="head">
          <span>LIVE RISK EVENTS</span>
          <span className="muted">{events.length} active events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#0d2119]">
                <th className="text-left py-2 text-[#56766a] font-bold">TIME</th>
                <th className="text-left py-2 text-[#56766a] font-bold">TOKEN</th>
                <th className="text-left py-2 text-[#56766a] font-bold">TYPE</th>
                <th className="text-left py-2 text-[#56766a] font-bold">SEVERITY</th>
                <th className="text-left py-2 text-[#56766a] font-bold">DESCRIPTION</th>
                <th className="text-left py-2 text-[#56766a] font-bold">DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#475569]">
                    <span className="g-spinner lg"></span> Loading risk data...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#f87171]">
                    Error loading data. <button onClick={() => refetch()} className="underline">Retry</button>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#475569]">
                    No risk events detected. All clear.
                  </td>
                </tr>
              ) : (
                events.map((e: any) => (
                  <tr
                    key={e.id}
                    className="border-b border-[#0d2119] hover:bg-[#07160f] cursor-pointer transition-colors"
                    onClick={() => setSelectedEvent(e)}
                  >
                    <td className="py-2 text-[#648176]">
                      {new Date(e.detectedAt).toLocaleTimeString('en-GB', { hour12: false })}
                    </td>
                    <td className="py-2">
                      <span className="font-bold text-[#baff38]">{e.token}</span>
                    </td>
                    <td className="py-2 text-[#d8eee5]">{getTypeLabel(e.type)}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        e.severity === 'CRITICAL' ? 'text-[#ff5d69] bg-[#2a0c0c] border border-[#ff5d69]' :
                        e.severity === 'HIGH' ? 'text-[#fb923c] bg-[#2a130c] border border-[#fb923c]' :
                        e.severity === 'MEDIUM' ? 'text-[#ffc85b] bg-[#1a1a0c] border border-[#ffc85b]' :
                        'text-[#22e58a] bg-[#0c2a1a] border border-[#22e58a]'
                      }`}>
                        {e.severity}
                      </span>
                    </td>
                    <td className="py-2 text-[#d8eee5]">{e.description}</td>
                    <td className="py-2 text-[#648176]">{e.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Token Risk Scores */}
      <div className="meme-panel">
        <div className="head">
          <span>TOKEN RISK SCORES</span>
          <span className="muted">Sorted by risk (highest first)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#0d2119]">
                <th className="text-left py-2 text-[#56766a] font-bold">TOKEN</th>
                <th className="text-left py-2 text-[#56766a] font-bold">PRICE</th>
                <th className="text-left py-2 text-[#56766a] font-bold">LIQUIDITY</th>
                <th className="text-left py-2 text-[#56766a] font-bold">RISK SCORE</th>
                <th className="text-left py-2 text-[#56766a] font-bold">FLAGS</th>
              </tr>
            </thead>
            <tbody>
              {tokenRisks.slice(0, 20).map((t: any) => (
                <tr key={t.address} className="border-b border-[#0d2119] hover:bg-[#07160f]">
                  <td className="py-2">
                    <span className="font-bold text-[#baff38]">{t.symbol}</span>
                    <span className="text-[#648176] text-xs ml-2">{t.name}</span>
                  </td>
                  <td className="py-2 text-[#d8eee5]">${t.price.toFixed(6)}</td>
                  <td className="py-2 text-[#d8eee5]">{formatNumber(t.liquidity)}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${getRiskColor(t.riskScore)}`}>{t.riskScore}</span>
                      <div className="w-12 h-1.5 bg-[#10271d] rounded">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${t.riskScore}%`,
                            background: t.riskScore >= 70 ? '#ff5d69' :
                                       t.riskScore >= 50 ? '#fb923c' :
                                       t.riskScore >= 30 ? '#ffc85b' : '#22e58a',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {t.riskFlags.slice(0, 2).map((flag: string, i: number) => (
                        <span key={i} className="px-1.5 py-0.5 rounded text-xs bg-[#2a0c0c] text-[#ff5d69]">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#06140e] border border-[#173b2b] rounded-lg max-w-2xl w-full">
            <div className="p-4 border-b border-[#0d2119] flex justify-between items-center">
              <h3 className="font-bold text-[#ff5d69] text-lg">Risk Event Detail</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-[#648176] hover:text-[#d8eee5]"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-[#56766a] text-xs">TOKEN</div>
                  <div className="text-xl font-bold text-[#baff38]">{selectedEvent.token}</div>
                </div>
                <div>
                  <div className="text-[#56766a] text-xs">SEVERITY</div>
                  <div className={`text-xl font-bold ${
                    selectedEvent.severity === 'CRITICAL' ? 'text-[#ff5d69]' :
                    selectedEvent.severity === 'HIGH' ? 'text-[#fb923c]' :
                    selectedEvent.severity === 'MEDIUM' ? 'text-[#ffc85b]' :
                    'text-[#22e58a]'
                  }`}>
                    {selectedEvent.severity}
                  </div>
                </div>
                <div>
                  <div className="text-[#56766a] text-xs">TYPE</div>
                  <div className="text-[#d8eee5]">{getTypeLabel(selectedEvent.type)}</div>
                </div>
                <div>
                  <div className="text-[#56766a] text-xs">DETECTED</div>
                  <div className="text-[#d8eee5]">
                    {new Date(selectedEvent.detectedAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <div className="text-[#56766a] text-xs mb-1">DESCRIPTION</div>
                <div className="text-[#d8eee5]">{selectedEvent.description}</div>
              </div>
              <div>
                <div className="text-[#56766a] text-xs mb-1">DETAILS</div>
                <div className="text-[#d8eee5]">{selectedEvent.details}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
