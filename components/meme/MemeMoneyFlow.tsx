"use client"

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

async function fetchMoneyFlow(): Promise<any> {
  const res = await fetch('/api/meme-money-flow')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

function formatNumber(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function FlowBar({ label, amount, direction, velocity, color }: {
  label: string
  amount: number
  direction: 'in' | 'out'
  velocity: number
  color: string
}) {
  const barWidth = Math.min(100, Math.max(5, (amount / 50000) * 100))
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-[#648176] text-xs">{label}</span>
        <span className={`text-xs font-bold ${direction === 'in' ? 'text-green' : 'text-red'}`}>
          {direction === 'in' ? '+' : '-'}{formatNumber(amount)}
        </span>
      </div>
      <div className="h-4 bg-[#10271d] rounded overflow-hidden">
        <div
          className="h-full rounded transition-all duration-500"
          style={{
            width: `${barWidth}%`,
            background: color,
            boxShadow: `0 0 10px ${color}`,
          }}
        />
      </div>
      <div className="text-[#648176] text-xs mt-1">Velocity: {velocity}%</div>
    </div>
  )
}

export default function MemeMoneyFlow() {
  const [clock, setClock] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['meme-money-flow'],
    queryFn: fetchMoneyFlow,
    refetchInterval: 20_000,
    staleTime: 10_000,
  })

  useEffect(() => {
    const updateClock = () => {
      setClock(new Date().toLocaleTimeString('en-GB', { hour12: false }))
    }
    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])

  const buckets = data?.buckets || []
  const events = data?.events || []

  return (
    <div className="meme-terminal">
      {/* Top Bar */}
      <div className="meme-topbar">
        <div className="logo">
          <span className="dot"></span>
          TRENCH<span className="lime">OS</span>
        </div>
        <div className="sep"></div>
        <div className="brand">MONEY FLOW</div>
        <div className="chain">SOLANA · MEME COIN FLOW · {data?.tokenCount || 0} TOKENS</div>
        <div className="topRight">
          <div className="stat">
            <label>NET FLOW</label>
            <b className={data?.netFlow >= 0 ? 'live' : 'text-red'}>
              {data?.netFlow ? formatNumber(data.netFlow) : 'N/A'}
            </b>
          </div>
          <div className="stat">
            <label>FLOW VELOCITY</label>
            <b className="live">{data?.flowVelocity}%</b>
          </div>
          <div className="stat">
            <label>STATUS</label>
            <b className="live">● LIVE</b>
          </div>
          <div className="nav">
            <button onClick={() => window.location.href = '/meme-scanner'}>SCANNER</button>
            <button onClick={() => window.location.href = '/meme-wallets'}>WALLETS</button>
            <button onClick={() => window.location.href = '/meme-narrative'}>NARRATIVE</button>
            <button className="active">FLOW</button>
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

      {/* Flow Visualization */}
      <div className="meme-panel">
        <div className="head">
          <span>MONEY FLOW DASHBOARD</span>
          <span className="muted">Real-time flow analysis</span>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-8 text-[#475569]">
              <span className="g-spinner lg"></span> Loading flow data...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-[#f87171]">
              Error loading data. <button onClick={() => refetch()} className="underline">Retry</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-[#baff38] font-bold mb-3 text-sm">FLOW BUCKETS</h4>
                <div className="space-y-3">
                  {buckets.map((b: any) => (
                    <FlowBar
                      key={b.type}
                      label={b.label}
                      amount={b.amount}
                      direction={b.direction}
                      velocity={b.velocity}
                      color={b.color}
                    />
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-[#0d2119]">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#648176]">Net Flow</span>
                    <span className={`font-bold ${data?.netFlow >= 0 ? 'text-green' : 'text-red'}`}>
                      {data?.netFlow ? formatNumber(data.netFlow) : '$0'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-[#648176]">Flow Velocity</span>
                    <span className="font-bold text-[#baff38]">{data?.flowVelocity}%</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-[#648176]">Flow Momentum</span>
                    <span className="font-bold text-[#55aaff]">{data?.flowMomentum}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[#baff38] font-bold mb-3 text-sm">LIVE FLOW EVENTS</h4>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {events.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-2 py-2 border-b border-[#0d2119]">
                      <span className="text-[#648176] text-xs w-16">
                        {new Date(e.timestamp).toLocaleTimeString('en-GB', { hour12: false })}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          e.type === 'SMART_MONEY' ? 'text-[#22e58a] bg-[#0c2a4a]' :
                          e.type === 'WHALE' ? 'text-[#55aaff] bg-[#0c2a4a]' :
                          e.type === 'RETAIL' ? 'text-[#baff38] bg-[#0c2a4a]' :
                          'text-[#ff5d69] bg-[#2a0c0c]'
                        }`}
                      >
                        {e.type.replace('_', ' ')}
                      </span>
                      <span className="font-bold text-[#d8eee5]">{e.token}</span>
                      <span className={`ml-auto text-xs ${e.direction === 'in' ? 'text-green' : 'text-red'}`}>
                        {e.direction === 'in' ? '+' : '-'}{formatNumber(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Flow Animation Canvas */}
      <div className="meme-panel">
        <div className="head">
          <span>FLOW VISUALIZATION</span>
          <span className="muted">Animated money flow</span>
        </div>
        <div className="p-4">
          <div className="h-40 bg-[#030c08] border border-[#173b2b] rounded relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-around">
              {buckets.map((b: any, i: number) => (
                <div key={b.type} className="flex flex-col items-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: `radial-gradient(circle, ${b.color}22, transparent 70%)`,
                      border: `2px solid ${b.color}`,
                      boxShadow: `0 0 20px ${b.color}44`,
                    }}
                  >
                    {b.label.split(' ')[0]}
                  </div>
                  <div className="text-[#648176] text-xs mt-1">{b.label}</div>
                  <div className={`text-xs ${b.direction === 'in' ? 'text-green' : 'text-red'}`}>
                    {b.direction === 'in' ? 'IN' : 'OUT'}
                  </div>
                </div>
              ))}
            </div>
            {/* Animated flow particles */}
            <div className="absolute inset-0 pointer-events-none">
              {events.slice(0, 8).map((e: any, i: number) => (
                <div
                  key={e.id}
                  className="absolute w-1 h-3 rounded"
                  style={{
                    background: e.type === 'SMART_MONEY' ? '#22e58a' :
                               e.type === 'WHALE' ? '#55aaff' :
                               e.type === 'RETAIL' ? '#baff38' : '#ff5d69',
                    left: `${10 + (i * 10)}%`,
                    top: `${20 + (i * 7)}%`,
                    animation: `meme-float 3s ease-in-out infinite`,
                    animationDelay: `${i * 0.3}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
