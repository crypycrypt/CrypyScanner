"use client"
import { useMemo, useState, useEffect } from 'react'

interface MarketDirectionChartProps {
  width?: number
  height?: number
}

// Deterministic pseudorandom for consistent chart generation
function prng(seed: number, i: number): number {
  return (Math.abs(Math.sin(seed * 127.1 + i * 311.7)) % 1)
}

function seedOf(sym: string): number {
  return sym.split('').reduce((a, c) => a + c.charCodeAt(0), 7) + 1
}

export default function MarketDirectionChart({ width = 800, height = 120 }: MarketDirectionChartProps) {
  const seed = useMemo(() => seedOf('market'), [])
  const [animationProgress, setAnimationProgress] = useState(0)
  
  // Animation effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationProgress(1)
    }, 100)
    
    return () => clearTimeout(timer)
  }, [])
  
  // Generate market direction data
  const marketData = useMemo(() => {
    const pts = Array.from({ length: 50 }, (_, i) => {
      const base = 55 + Math.sin(i * 0.28 + seed * 0.07) * 22
      const noise = prng(seed, i + 50) * 18 - 4
      return base + noise
    })
    
    const mn = Math.min(...pts)
    const rng = Math.max(...pts) - mn || 1
    const ny = (v: number) => height - ((v - mn) / rng) * (height - 12) - 6
    const px = (i: number) => (i / (pts.length - 1)) * width
    
    // Calculate moving averages
    const ma20 = pts.map((_, i) => {
      const sl = pts.slice(Math.max(0, i - 19), i + 1)
      return sl.reduce((a, b) => a + b, 0) / sl.length
    })
    
    const ema: number[] = []
    let e = pts[0]
    const k = 2 / 13
    pts.forEach(p => { e = p * k + e * (1 - k); ema.push(e) })
    
    // Support and resistance levels
    const s1 = mn + rng * 0.14
    const s2 = mn + rng * 0.06
    const r1 = mn + rng * 0.83
    const r2 = mn + rng * 0.93
    
    // Animated paths
    const animatedPts = pts.map(v => v * animationProgress)
    const animatedMa20 = ma20.map(v => v * animationProgress)
    const animatedEma = ema.map(v => v * animationProgress)
    
    return {
      pricePath: pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${ny(v).toFixed(1)}`).join(' '),
      animatedPricePath: animatedPts.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${ny(v).toFixed(1)}`).join(' '),
      ma20Path: ma20.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${ny(v).toFixed(1)}`).join(' '),
      animatedMa20Path: animatedMa20.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${ny(v).toFixed(1)}`).join(' '),
      emaPath: ema.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${ny(v).toFixed(1)}`).join(' '),
      animatedEmaPath: animatedEma.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${ny(v).toFixed(1)}`).join(' '),
      s1: ny(s1),
      s2: ny(s2),
      r1: ny(r1),
      r2: ny(r2),
      lastPrice: pts[pts.length - 1],
      animatedLastPrice: pts[pts.length - 1] * animationProgress,
      trend: pts[pts.length - 1] > pts[0] ? 'bullish' : 'bearish'
    }
  }, [seed, width, height, animationProgress])

  return (
    <div className="relative">
      {/* Chart Container */}
      <div className="card-glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/assets/ic_chart.svg" alt="market" className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Market Direction</h3>
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded ${
            marketData.trend === 'bullish' 
              ? 'bg-green-500/10 text-green-400' 
              : 'bg-red-500/10 text-red-400'
          }`}>
            {marketData.trend === 'bullish' ? '▲ Bullish' : '▼ Bearish'}
          </span>
        </div>
        
        {/* Chart Legend */}
        <div className="flex items-center gap-4 mb-3 flex-wrap text-[10px]">
          {[
            ['─', '#00f0ff', 'Price'],
            ['─', '#f59e0b', 'MA20'], 
            ['─', '#6366f1', 'EMA12'],
            ['- -', '#22c55e', 'Support'],
            ['- -', '#ef4444', 'Resistance']
          ].map(([sym, col, lbl]) => (
            <div key={lbl} className="flex items-center gap-1">
              <span style={{ color: col as string, fontWeight: 'bold', fontSize: 13 }}>{sym}</span>
              <span className="text-slate-400">{lbl}</span>
            </div>
          ))}
        </div>
        
        {/* SVG Chart */}
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded" style={{ height: 130 }}>
          {/* Background */}
          <rect width={width} height={height} fill="rgba(255,255,255,0.015)" rx="6" />
          
          {/* Grid Lines */}
          {[0.25, 0.5, 0.75].map((f, i) => (
            <line key={i} x1={0} y1={height * f} x2={width} y2={height * f} 
                  stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
          ))}
          {[0.2, 0.4, 0.6, 0.8].map((f, i) => (
            <line key={i} x1={width * f} y1={0} x2={width * f} y2={height} 
                  stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />
          ))}
          
          {/* Support Zones */}
          <line x1={0} y1={marketData.s1} x2={width} y2={marketData.s1} 
                stroke="#22c55e" strokeWidth={0.9} strokeDasharray="5 3" opacity={0.7} />
          <line x1={0} y1={marketData.s2} x2={width} y2={marketData.s2} 
                stroke="#22c55e" strokeWidth={0.7} strokeDasharray="3 4" opacity={0.45} />
          
          {/* Resistance Zones */}
          <line x1={0} y1={marketData.r1} x2={width} y2={marketData.r1} 
                stroke="#ef4444" strokeWidth={0.9} strokeDasharray="5 3" opacity={0.7} />
          <line x1={0} y1={marketData.r2} x2={width} y2={marketData.r2} 
                stroke="#ef4444" strokeWidth={0.7} strokeDasharray="3 4" opacity={0.45} />
          
          {/* Animated Indicators */}
          <path d={marketData.animatedMa20Path} fill="none" stroke="#f59e0b" strokeWidth={1.1} opacity={0.75}>
            <animate attributeName="d" from="M0 0" to={marketData.ma20Path} dur="1.5s" fill="freeze" />
          </path>
          <path d={marketData.animatedEmaPath} fill="none" stroke="#6366f1" strokeWidth={1.1} opacity={0.75}>
            <animate attributeName="d" from="M0 0" to={marketData.emaPath} dur="1.5s" fill="freeze" />
          </path>
          
          {/* Animated Price Line */}
          <path d={marketData.animatedPricePath} fill="none" stroke="#00f0ff" strokeWidth={1.6}>
            <animate attributeName="d" from="M0 0" to={marketData.pricePath} dur="2s" fill="freeze" />
          </path>
          
          {/* Animated End Marker */}
          <circle cx={width - 2} cy={marketData.s1 + (marketData.r1 - marketData.s1) * 0.5}
                  r={2.8} fill="#00f0ff" opacity={animationProgress}>
            <animate attributeName="r" values="0;3;2.8" dur="0.8s" begin="1.5s" fill="freeze" />
            <animate attributeName="opacity" values="0;1" dur="0.5s" begin="1.5s" fill="freeze" />
          </circle>
        </svg>
        
        {/* Market Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
          {[
            ['Support S1', '$63.2K', '#22c55e', 'rgba(34,197,94,0.07)'],
            ['Support S2', '$61.8K', '#4ade80', 'rgba(34,197,94,0.04)'],
            ['Resist R1', '$65.1K', '#ef4444', 'rgba(239,68,68,0.07)'],
            ['Resist R2', '$66.7K', '#f87171', 'rgba(239,68,68,0.04)'],
          ].map(([lbl, val, color, bg]) => (
            <div key={lbl} className="rounded-lg p-2.5" 
                 style={{ background: bg as string, border: `1px solid ${color}30` }}>
              <div className="text-slate-400">{lbl}</div>
              <div className="font-bold mt-0.5" style={{ color: color as string }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}