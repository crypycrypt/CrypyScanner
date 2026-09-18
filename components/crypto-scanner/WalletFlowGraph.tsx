"use client"

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface WalletFlowNode {
  id: string
  label: string
  type: 'wallet' | 'cex' | 'defi' | 'dex' | 'staking' | 'lending'
  address: string
  chain: string
  inflow: number
  outflow: number
  netFlow: number
  accumulationScore: number
  distributionScore: number
  color: string
  size: number
  x?: number
  y?: number
}

interface WalletFlowLink {
  source: string
  target: string
  value: number
  direction: 'in' | 'out' | 'transfer'
  label: string
  animated: boolean
  color: string
}

interface WalletFlowStats {
  totalInflow: number
  totalOutflow: number
  netFlow: number
  accumulationCount: number
  distributionCount: number
  topAccumulators: Array<{ id: string; label: string; score: number }>
  topDistributors: Array<{ id: string; label: string; score: number }>
}

interface WalletFlowData {
  nodes: WalletFlowNode[]
  links: WalletFlowLink[]
  stats: WalletFlowStats
  fetchedAt: string
}

type FlowDirection = 'in' | 'out' | 'transfer' | 'all'
type FlowTypeFilter = 'all' | 'wallet' | 'cex' | 'defi' | 'staking' | 'lending'

function formatUSD(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`
  return `$${v}`
}

function getNodeIcon(type: string): string {
  const icons: Record<string, string> = {
    wallet: '👛',
    cex: '🏦',
    defi: '🔄',
    dex: '🔀',
    staking: '🔒',
    lending: '💰',
  }
  return icons[type] ?? '📊'
}

function getFlowArrow(direction: string): string {
  switch (direction) {
    case 'in': return '↓'
    case 'out': return '↑'
    case 'transfer': return '↔'
    default: return '→'
  }
}

interface WalletFlowGraphProps {
  coin?: { symbol: string; name: string; coinId?: string } | null
}

export default function WalletFlowGraph({ coin }: WalletFlowGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<WalletFlowData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flowFilter, setFlowFilter] = useState<FlowDirection>('all')
  const [typeFilter, setTypeFilter] = useState<FlowTypeFilter>('all')
  const [selectedNode, setSelectedNode] = useState<WalletFlowNode | null>(null)
  const [animPhase, setAnimPhase] = useState(0)
  const [viewBox, setViewBox] = useState('0 0 800 500')

  const fetchData = useCallback(async (force = false) => {
    try {
      setError(null)
      const params = new URLSearchParams()
      if (force) params.set('refresh', '1')
      if (coin?.symbol) params.set('symbol', coin.symbol)
      if (coin?.name) params.set('name', coin.name)
      if (coin?.coinId) params.set('coinId', coin.coinId)
      const qs = params.toString()
      const res = await fetch(`/api/wallet-flow?${qs}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: WalletFlowData = await res.json()
      setData(json)
    } catch (err: any) {
      console.error('Wallet flow fetch error:', err)
      setError(err?.message || 'Failed to load wallet flow data')
    } finally {
      setIsLoading(false)
    }
  }, [coin])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Refetch when coin changes
  useEffect(() => {
    setIsLoading(true)
    fetchData()
  }, [coin?.symbol])

  // Animation phase for flowing particles
  useEffect(() => {
    const animInterval = setInterval(() => {
      setAnimPhase(prev => (prev + 1) % 100)
    }, 50)
    return () => clearInterval(animInterval)
  }, [])

  // Auto-layout nodes in a circular pattern
  useEffect(() => {
    if (!data?.nodes.length) return
    const nodes = data.nodes
    
    // Only position nodes that don't have x,y coordinates yet
    const hasUnpositioned = nodes.some(node => node.x === undefined || node.y === undefined)
    if (!hasUnpositioned) return
    
    const cx = 400
    const cy = 250
    const radius = 180

    const positioned = nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
      const x = cx + radius * Math.cos(angle)
      const y = cy + radius * Math.sin(angle)
      return { ...node, x, y }
    })

    setData(prev => prev ? { ...prev, nodes: positioned } : prev)
  }, [data?.nodes.length, data?.fetchedAt])

  const filteredLinks = data?.links.filter(link => {
    if (flowFilter !== 'all' && link.direction !== flowFilter) return false
    if (typeFilter !== 'all') {
      const sourceNode = data?.nodes.find(n => n.id === link.source)
      const targetNode = data?.nodes.find(n => n.id === link.target)
      if (sourceNode?.type !== typeFilter && targetNode?.type !== typeFilter) return false
    }
    return true
  }) ?? []

  const getNodeColor = (node: WalletFlowNode) => {
    if (node.accumulationScore > 60) return '#22c55e'
    if (node.distributionScore > 60) return '#ef4444'
    return node.color
  }

  const getNodeSize = (node: WalletFlowNode) => {
    const base = Math.max(12, Math.min(36, node.size))
    const flowBonus = Math.min(8, node.netFlow / 5000)
    return base + flowBonus
  }

  const getLinkColor = (link: WalletFlowLink) => {
    switch (link.direction) {
      case 'in': return '#22c55e'
      case 'out': return '#ef4444'
      case 'transfer': return '#3b82f6'
      default: return '#64748b'
    }
  }

  const getLinkWidth = (link: WalletFlowLink) => {
    return Math.max(1.5, Math.min(5, link.value / 3000))
  }

  if (isLoading) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 h-[520px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Memuat Wallet Flow Graph...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 h-[520px] flex items-center justify-center">
        <div className="text-center text-red-400">
          <p className="text-sm mb-2">⚠️ Gagal memuat data</p>
          <p className="text-xs text-slate-500">{error}</p>
          <button onClick={() => fetchData(true)} className="mt-3 px-4 py-1.5 text-xs rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 h-[520px] flex items-center justify-center">
        <p className="text-slate-500 text-sm">Tidak ada data wallet flow</p>
      </div>
    )
  }

  return (
    <div className="space-y-4" suppressHydrationWarning>
      {/* Header */}
       <div className="flex items-center justify-between flex-wrap gap-3">
         <div>
           <h3 className="font-bold text-lg text-white">
             {coin ? `${coin.name} (${coin.symbol}) Wallet Flow` : 'Wallet Flow Graph'}
           </h3>
           <p className="text-xs text-slate-400">
             {coin ? `Analyzing wallet movements for ${coin.symbol}` : 'Animated in/out/transfer flows with accumulation/distribution analysis'}
           </p>
         </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => fetchData(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600/30 transition-colors"
          >
            🔄 Refresh
          </button>
          <span className="text-[10px] text-slate-500">Updated: {new Date(data.fetchedAt).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
          <div className="text-[10px] text-green-400 uppercase tracking-wider">Total Inflow</div>
          <div className="text-lg font-bold text-green-400">{formatUSD(data.stats.totalInflow)}</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <div className="text-[10px] text-red-400 uppercase tracking-wider">Total Outflow</div>
          <div className="text-lg font-bold text-red-400">{formatUSD(data.stats.totalOutflow)}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <div className="text-[10px] text-blue-400 uppercase tracking-wider">Net Flow</div>
          <div className={`text-lg font-bold ${data.stats.netFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.stats.netFlow >= 0 ? '+' : ''}{formatUSD(data.stats.netFlow)}
          </div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <div className="text-[10px] text-amber-400 uppercase tracking-wider">Acc/Dist Ratio</div>
          <div className="text-lg font-bold text-amber-400">
            {data.stats.accumulationCount}:{data.stats.distributionCount}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-slate-500 mr-1">Flow:</span>
        {(['all', 'in', 'out', 'transfer'] as FlowDirection[]).map(f => (
          <button
            key={f}
            onClick={() => setFlowFilter(f)}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              flowFilter === f
                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                : 'bg-slate-700/30 text-slate-400 border border-slate-600/20 hover:bg-slate-600/30'
            }`}
          >
            {f === 'all' ? 'All' : f === 'in' ? '↓ Inflow' : f === 'out' ? '↑ Outflow' : '↔ Transfer'}
          </button>
        ))}
        <span className="text-xs text-slate-600 mx-2">|</span>
        <span className="text-xs text-slate-500 mr-1">Type:</span>
        {(['all', 'wallet', 'cex', 'defi', 'staking', 'lending'] as FlowTypeFilter[]).map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
              typeFilter === t
                ? 'bg-purple-600/30 text-purple-400 border border-purple-500/40'
                : 'bg-slate-700/30 text-slate-400 border border-slate-600/20 hover:bg-slate-600/30'
            }`}
          >
            {t === 'all' ? 'All' : getNodeIcon(t)} {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Graph Container */}
      <div className="relative bg-slate-800/30 rounded-xl overflow-hidden border border-slate-700/50" style={{ height: 480 }}>
        <svg ref={svgRef} className="w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Grid pattern */}
            <pattern id="wf-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>
            </pattern>

            {/* Glow filter for nodes */}
            <filter id="wf-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            {/* Gradient for in-flow links */}
            <linearGradient id="wf-in-grad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.1"/>
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.6"/>
            </linearGradient>

            {/* Gradient for out-flow links */}
            <linearGradient id="wf-out-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.1"/>
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.6"/>
            </linearGradient>

            {/* Gradient for transfer links */}
            <linearGradient id="wf-xfer-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1"/>
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6"/>
            </linearGradient>
          </defs>

          {/* Background */}
          <rect width="100%" height="100%" fill="url(#wf-grid)" />

          {/* Links */}
          {filteredLinks.map((link, index) => {
            const sourceNode = data.nodes.find(n => n.id === link.source)
            const targetNode = data.nodes.find(n => n.id === link.target)
            if (!sourceNode || !targetNode || !sourceNode.x || !sourceNode.y || !targetNode.x || !targetNode.y) return null

            const color = getLinkColor(link)
            const width = getLinkWidth(link)
            const isAnimated = link.animated

            return (
              <g key={`link-${index}`}>
                {/* Base link line */}
                <line
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={color}
                  strokeWidth={width}
                  strokeOpacity={0.3}
                  strokeDasharray={link.direction === 'transfer' ? '8,4' : '4,4'}
                />

                {/* Animated flow particle */}
                {isAnimated && (
                  <circle r={3} fill={color} opacity={0.9} filter="url(#wf-glow)">
                    <animateMotion
                      dur={`${2 + (index % 3) * 0.5}s`}
                      repeatCount="indefinite"
                      path={`M${sourceNode.x},${sourceNode.y} L${targetNode.x},${targetNode.y}`}
                    />
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur={`${2 + (index % 3) * 0.5}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Reverse animated particle for in-flow */}
                {isAnimated && link.direction === 'in' && (
                  <circle r={2.5} fill={color} opacity={0.7}>
                    <animateMotion
                      dur={`${2.5 + (index % 2) * 0.3}s`}
                      repeatCount="indefinite"
                      path={`M${targetNode.x},${targetNode.y} L${sourceNode.x},${sourceNode.y}`}
                    />
                    <animate
                      attributeName="opacity"
                      values="0;0.8;0.8;0"
                      dur={`${2.5 + (index % 2) * 0.3}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Link label */}
                <text
                  x={(sourceNode.x + targetNode.x) / 2}
                  y={(sourceNode.y + targetNode.y) / 2 - 6}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.6)"
                  fontSize="9"
                  fontWeight="bold"
                >
                  {link.label}
                </text>

                {/* Direction indicator */}
                <text
                  x={(sourceNode.x + targetNode.x) / 2}
                  y={(sourceNode.y + targetNode.y) / 2 + 8}
                  textAnchor="middle"
                  fill={color}
                  fontSize="8"
                  opacity={0.7}
                >
                  {getFlowArrow(link.direction)}
                </text>
              </g>
            )
          })}

          {/* Nodes */}
          {data.nodes.map((node) => {
            if (node.x == null || node.y == null) return null
            const radius = getNodeSize(node)
            const color = getNodeColor(node)
            const isSelected = selectedNode?.id === node.id
            const isAccumulator = node.accumulationScore > 60
            const isDistributor = node.distributionScore > 60

            return (
              <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNode(isSelected ? null : node)}>
                {/* Outer glow for accumulators */}
                {isAccumulator && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius + 6}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="1"
                    strokeOpacity={0.3}
                    filter="url(#wf-glow)"
                  >
                    <animate attributeName="r" values={`${radius + 4};${radius + 8};${radius + 4}`} dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="stroke-opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite"/>
                  </circle>
                )}

                {/* Outer glow for distributors */}
                {isDistributor && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius + 6}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1"
                    strokeOpacity={0.3}
                    filter="url(#wf-glow)"
                  >
                    <animate attributeName="r" values={`${radius + 4};${radius + 8};${radius + 4}`} dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="stroke-opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite"/>
                  </circle>
                )}

                {/* Node circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={`${color}22`}
                  stroke={color}
                  strokeWidth={isSelected ? 3 : 2}
                  strokeOpacity={0.8}
                  className="transition-all"
                />

                {/* Node inner fill */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius * 0.6}
                  fill={color}
                  opacity={0.3}
                />

                {/* Node icon */}
                <text
                  x={node.x}
                  y={node.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.max(10, radius * 0.7)}
                >
                  {getNodeIcon(node.type)}
                </text>

                {/* Node label */}
                <text
                  x={node.x}
                  y={node.y + radius + 14}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.9)"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {node.label}
                </text>

                {/* Net flow value */}
                <text
                  x={node.x}
                  y={node.y + radius + 26}
                  textAnchor="middle"
                  fill={node.netFlow >= 0 ? '#22c55e' : '#ef4444'}
                  fontSize="8"
                  fontWeight="bold"
                >
                  {node.netFlow >= 0 ? '+' : ''}{formatUSD(node.netFlow)}
                </text>

                {/* Accumulation score badge */}
                <circle
                  cx={node.x + radius * 0.7}
                  cy={node.y - radius * 0.7}
                  r={8}
                  fill={isAccumulator ? '#22c55e' : isDistributor ? '#ef4444' : '#64748b'}
                  stroke="#1e293b"
                  strokeWidth="1.5"
                />
                <text
                  x={node.x + radius * 0.7}
                  y={node.y - radius * 0.7 + 3}
                  textAnchor="middle"
                  fill="white"
                  fontSize="7"
                  fontWeight="bold"
                >
                  {node.accumulationScore}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Legend overlay */}
        <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-sm rounded-lg p-3 border border-slate-700/50">
          <div className="text-[10px] text-slate-400 mb-2 font-semibold uppercase tracking-wider">Flow Legend</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-green-500 rounded"></div>
              <span className="text-[10px] text-slate-300">Inflow (↓)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-500 rounded"></div>
              <span className="text-[10px] text-slate-300">Outflow (↑)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-blue-500 rounded" style={{borderTop: '2px dashed #3b82f6', height: 0}}></div>
              <span className="text-[10px] text-slate-300">Transfer (↔)</span>
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/50">
              <div className="w-3 h-3 rounded-full bg-green-500/30 border border-green-500"></div>
              <span className="text-[10px] text-slate-300">Accumulating (score {'>'}60)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500"></div>
              <span className="text-[10px] text-slate-300">Distributing (score {'>'}60)</span>
            </div>
          </div>
        </div>

        {/* Node detail panel */}
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-3 right-3 bg-slate-900/95 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50 w-64"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-white">{selectedNode.label}</span>
              <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Type</span><span className="text-slate-200">{selectedNode.type.toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Address</span><span className="text-slate-200 font-mono">{selectedNode.address}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Chain</span><span className="text-slate-200">{selectedNode.chain}</span></div>
              <div className="border-t border-slate-700/50 pt-2 mt-2">
                <div className="flex justify-between"><span className="text-green-400">Inflow</span><span className="text-green-400">{formatUSD(selectedNode.inflow)}</span></div>
                <div className="flex justify-between"><span className="text-red-400">Outflow</span><span className="text-red-400">{formatUSD(selectedNode.outflow)}</span></div>
                <div className="flex justify-between"><span className="text-blue-400">Net Flow</span><span className={`${selectedNode.netFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>{selectedNode.netFlow >= 0 ? '+' : ''}{formatUSD(selectedNode.netFlow)}</span></div>
              </div>
              <div className="border-t border-slate-700/50 pt-2 mt-2">
                <div className="flex justify-between"><span className="text-slate-400">Accumulation</span><span className="text-green-400">{selectedNode.accumulationScore}%</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Distribution</span><span className="text-red-400">{selectedNode.distributionScore}%</span></div>
              </div>
              {/* Mini bar */}
              <div className="mt-2">
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-700">
                  <div className="bg-green-500" style={{width: `${selectedNode.accumulationScore}%`}}></div>
                  <div className="bg-red-500" style={{width: `${selectedNode.distributionScore}%`}}></div>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-green-400">Acc {selectedNode.accumulationScore}%</span>
                  <span className="text-[9px] text-red-400">Dist {selectedNode.distributionScore}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Accumulation/Distribution Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Top Accumulators */}
        <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
          <div className="text-xs font-semibold text-green-400 mb-3 uppercase tracking-wider">Top Accumulators</div>
          <div className="space-y-2">
            {data.stats.topAccumulators.map((acc, i) => (
              <div key={acc.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-4">#{i + 1}</span>
                  <span className="text-xs text-slate-200 font-medium">{acc.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{width: `${acc.score}%`}}></div>
                  </div>
                  <span className="text-xs text-green-400 font-bold w-8 text-right">{acc.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Distributors */}
        <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
          <div className="text-xs font-semibold text-red-400 mb-3 uppercase tracking-wider">📤 Top Distributors</div>
          <div className="space-y-2">
            {data.stats.topDistributors.map((dist, i) => (
              <div key={dist.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-4">#{i + 1}</span>
                  <span className="text-xs text-slate-200 font-medium">{dist.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full" style={{width: `${dist.score}%`}}></div>
                  </div>
                  <span className="text-xs text-red-400 font-bold w-8 text-right">{dist.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}