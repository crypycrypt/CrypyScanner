"use client"
import { useEffect, useRef, useState } from 'react'

interface WalletGraphData {
  nodes: Array<{
    id: string;
    cat: string;
    label: string;
    size: number;
    x?: number;
    y?: number;
  }>;
  links: Array<{
    source: string;
    target: string;
    value: number;
    label: string;
  }>;
}

export default function AnimatedWalletGraph() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [data, setData] = useState<WalletGraphData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate fetching wallet graph data
    const mockData: WalletGraphData = {
      nodes: [
        { id: 'center', cat: 'center', label: 'Wallet Center', size: 50 },
        { id: 'cex1', cat: 'cex', label: 'Binance', size: 30 },
        { id: 'cex2', cat: 'cex', label: 'Coinbase', size: 25 },
        { id: 'defi1', cat: 'defi', label: 'Uniswap', size: 20 },
        { id: 'defi2', cat: 'defi', label: 'Aave', size: 18 },
        { id: 'nft1', cat: 'nft', label: 'OpenSea', size: 15 },
        { id: 'nft2', cat: 'nft', label: 'Blur', size: 12 },
        { id: 'lending', cat: 'lending', label: 'Compound', size: 16 },
        { id: 'staking', cat: 'staking', label: 'Lido', size: 22 },
      ],
      links: [
        { source: 'center', target: 'cex1', value: 1000, label: '1.2K ETH' },
        { source: 'center', target: 'cex2', value: 800, label: '800 ETH' },
        { source: 'center', target: 'defi1', value: 500, label: '500 ETH' },
        { source: 'center', target: 'defi2', value: 300, label: '300 ETH' },
        { source: 'center', target: 'nft1', value: 200, label: '200 ETH' },
        { source: 'center', target: 'nft2', value: 150, label: '150 ETH' },
        { source: 'center', target: 'lending', value: 400, label: '400 ETH' },
        { source: 'center', target: 'staking', value: 600, label: '600 ETH' },
      ]
    }

    setData(mockData)
    setIsLoading(false)

    // Simulate animation
    const interval = setInterval(() => {
      setData(prev => {
        if (!prev) return null
        return {
          ...prev,
          nodes: prev.nodes.map(node => ({
            ...node,
            x: Math.random() * 300 + 50,
            y: Math.random() * 200 + 50
          }))
        }
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const getNodeColor = (cat: string) => {
    const colors = {
      center: '#3b82f6',
      cex: '#10b981',
      defi: '#8b5cf6',
      nft: '#f59e0b',
      lending: '#ef4444',
      staking: '#06b6d4',
    }
    return colors[cat as keyof typeof colors] || '#64748b'
  }

  const getNodeRadius = (size: number) => {
    return Math.max(8, Math.min(25, size / 2))
  }

  if (isLoading) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 h-80 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm">Memuat grafik wallet...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg">Wallet Flow Graph</h3>
          <p className="text-xs text-slate-400">
            Visualisasi aliran dana antar platform
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1 text-xs rounded-md bg-slate-700/50 text-slate-300">
            ETH
          </button>
          <button className="px-3 py-1 text-xs rounded-md bg-slate-700/50 text-slate-300">
            SOL
          </button>
        </div>
      </div>

      {/* Graph Container */}
      <div className="relative h-64 bg-slate-800/30 rounded-lg overflow-hidden">
        <svg ref={svgRef} className="w-full h-full" viewBox="0 0 400 300">
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Links */}
          {data?.links.map((link, index) => {
            const sourceNode = data.nodes.find(n => n.id === link.source)
            const targetNode = data.nodes.find(n => n.id === link.target)
            
            if (!sourceNode || !targetNode || !sourceNode.x || !sourceNode.y || !targetNode.x || !targetNode.y) {
              return null
            }

            return (
              <g key={index}>
                {/* Link line */}
                <line
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth={Math.max(1, Math.min(3, link.value / 500))}
                  strokeDasharray="5,5"
                />
                
                {/* Link label */}
                <text
                  x={(sourceNode.x + targetNode.x) / 2}
                  y={(sourceNode.y + targetNode.y) / 2}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.7)"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {link.label}
                </text>
              </g>
            )
          })}

          {/* Nodes */}
          {data?.nodes.map((node) => {
            if (!node.x || !node.y) return null
            
            const radius = getNodeRadius(node.size)
            const color = getNodeColor(node.cat)
            
            return (
              <g key={node.id}>
                {/* Node circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={color}
                  stroke="#1e293b"
                  strokeWidth="2"
                  className="cursor-pointer hover:r-8 transition-all"
                />
                
                {/* Node label */}
                <text
                  x={node.x}
                  y={node.y + radius + 12}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.9)"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {node.label}
                </text>
                
                {/* Value inside node */}
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize="8"
                  fontWeight="bold"
                >
                  {node.size}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-sm rounded-lg p-2">
          <div className="text-xs text-slate-300 mb-1">Platform Types:</div>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Center', color: '#3b82f6' },
              { label: 'CEX', color: '#10b981' },
              { label: 'DeFi', color: '#8b5cf6' },
              { label: 'NFT', color: '#f59e0b' },
              { label: 'Lending', color: '#ef4444' },
              { label: 'Staking', color: '#06b6d4' },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-1">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-xs text-slate-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
        <div className="text-center">
          <div className="text-slate-400">Total Nodes</div>
          <div className="font-bold text-white">{data?.nodes.length || 0}</div>
        </div>
        <div className="text-center">
          <div className="text-slate-400">Total Links</div>
          <div className="font-bold text-white">{data?.links.length || 0}</div>
        </div>
        <div className="text-center">
          <div className="text-slate-400">Total Value</div>
          <div className="font-bold text-white">
            {data?.links.reduce((sum, link) => sum + link.value, 0).toLocaleString()} ETH
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex justify-between items-center">
        <div className="text-xs text-slate-500">
          Klik node untuk melihat detail transaksi
        </div>
        <div className="flex gap-2">
          <button className="px-2 py-1 text-xs rounded bg-slate-700/50 text-slate-300">
            Reset Zoom
          </button>
          <button className="px-2 py-1 text-xs rounded bg-slate-700/50 text-slate-300">
            Filter
          </button>
        </div>
      </div>
    </div>
  )
}