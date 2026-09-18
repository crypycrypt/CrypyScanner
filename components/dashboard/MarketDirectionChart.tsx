"use client"
import { useMemo, useState, useEffect, useCallback } from 'react'

interface MarketDirectionChartProps {
  width?: number
  height?: number
}

interface BtcDirectionPayload {
  ok: boolean
  symbol?: string
  interval?: string
  currentPrice?: number
  changePct?: number
  closes?: number[]
  error?: string
}

function fmtUsd(v: number): string {
  if (!Number.isFinite(v)) return '$0'
  if (v >= 1000) {
    return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function MarketDirectionChart({ width = 800, height = 130 }: MarketDirectionChartProps) {
  const [closes, setCloses] = useState<number[]>([])
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [changePct, setChangePct] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/market/btc-direction', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: BtcDirectionPayload = await res.json()
      if (!data.ok || !Array.isArray(data.closes) || data.closes.length < 20) {
        throw new Error(data.error || 'Insufficient series data')
      }
      setCloses(data.closes)
      setCurrentPrice(data.currentPrice || data.closes[data.closes.length - 1])
      setChangePct(data.changePct || 0)
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load market direction')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  // Compute the same pipeline (price path / MA20 / EMA12 / RSI / support-resistance)
  // but sourced from real Binance closes.
  const marketData = useMemo(() => {
    if (!closes.length) return null

    const pts = closes
    const mn = Math.min(...pts)
    const mx = Math.max(...pts)
    const rng = mx - mn || 1
    const ny = (v: number) => height - ((v - mn) / rng) * (height - 12) - 6
    const px = (i: number) => (i / (pts.length - 1)) * width

    const ma20 = pts.map((_, i) => {
      const sl = pts.slice(Math.max(0, i - 19), i + 1)
      return sl.reduce((a, b) => a + b, 0) / sl.length
    })

    const ema: number[] = []
    let e = pts[0]
    const k = 2 / 13
    for (const p of pts) {
      e = p * k + e * (1 - k)
      ema.push(e)
    }

    const rsi: number[] = []
    for (let i = 14; i < pts.length; i++) {
      const changes: number[] = []
      for (let j = i - 14; j < i; j++) changes.push(pts[j + 1] - pts[j])
      const gains = changes.filter((c) => c > 0).reduce((a, b) => a + b, 0)
      const losses = Math.abs(changes.filter((c) => c < 0).reduce((a, b) => a + b, 0))
      const rs = gains / (losses || 0.0001)
      rsi.push(100 - 100 / (1 + rs))
    }

    // Real support / resistance from recent price swing
    const recent = pts.slice(-30)
    const s1 = Math.min(...recent)
    const s2 = Math.min(...pts)
    const r1 = Math.max(...recent)
    const r2 = Math.max(...pts)

    return {
      pricePath: pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${ny(v).toFixed(1)}`).join(' '),
      ma20Path: ma20.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${ny(v).toFixed(1)}`).join(' '),
      emaPath: ema.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${ny(v).toFixed(1)}`).join(' '),
      s1,
      s2,
      r1,
      r2,
      nyS1: ny(s1),
      nyS2: ny(s2),
      nyR1: ny(r1),
      nyR2: ny(r2),
      lastPrice: pts[pts.length - 1],
      trend: pts[pts.length - 1] >= pts[0] ? 'bullish' : 'bearish',
      currentRSI: rsi[rsi.length - 1]?.toFixed(1) || '—',
    }
  }, [closes, width, height])

  return (
    <div className="relative">
      <div className="card-glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/assets/ic_chart.svg" alt="market" className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Market Direction BTC</h3>
          </div>
          {marketData ? (
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                marketData.trend === 'bullish'
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400'
              }`}>
                {marketData.trend === 'bullish' ? '▲ Bullish' : '▼ Bearish'}
              </span>
              <span className={`text-xs font-semibold ${changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">{loading ? 'Loading…' : 'Offline'}</span>
          )}
        </div>

        {/* Chart Legend */}
        <div className="flex items-center gap-4 mb-3 flex-wrap text-[10px]">
          {[
            ['─', '#00f0ff', 'Price'],
            ['─', '#f59e0b', 'MA20'],
            ['─', '#6366f1', 'EMA12'],
            ['- -', '#22c55e', 'Support'],
            ['- -', '#ef4444', 'Resistance'],
          ].map(([sym, col, lbl]) => (
            <div key={lbl} className="flex items-center gap-1">
              <span style={{ color: col as string, fontWeight: 'bold', fontSize: 13 }}>{sym}</span>
              <span className="text-slate-400">{lbl}</span>
            </div>
          ))}
        </div>

        {/* SVG Chart */}
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded" style={{ height: 140 }}>
            <rect width={width} height={height} fill="rgba(255,255,255,0.015)" rx="6" />
            {[0.25, 0.5, 0.75].map((f, i) => (
              <line key={i} x1={0} y1={height * f} x2={width} y2={height * f}
                    stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            ))}
            {[0.2, 0.4, 0.6, 0.8].map((f, i) => (
              <line key={i} x1={width * f} y1={0} x2={width * f} y2={height}
                    stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />
            ))}

            {marketData && (
              <>
                <line x1={0} y1={marketData.nyS1} x2={width} y2={marketData.nyS1}
                      stroke="#22c55e" strokeWidth={0.9} strokeDasharray="5 3" opacity={0.7} />
                <line x1={0} y1={marketData.nyS2} x2={width} y2={marketData.nyS2}
                      stroke="#22c55e" strokeWidth={0.7} strokeDasharray="3 4" opacity={0.45} />
                <line x1={0} y1={marketData.nyR1} x2={width} y2={marketData.nyR1}
                      stroke="#ef4444" strokeWidth={0.9} strokeDasharray="5 3" opacity={0.7} />
                <line x1={0} y1={marketData.nyR2} x2={width} y2={marketData.nyR2}
                      stroke="#ef4444" strokeWidth={0.7} strokeDasharray="3 4" opacity={0.45} />

                <path d={marketData.ma20Path} fill="none" stroke="#f59e0b" strokeWidth={1.1} opacity={0.75} />
                <path d={marketData.emaPath} fill="none" stroke="#6366f1" strokeWidth={1.1} opacity={0.75} />
                <path d={marketData.pricePath} fill="none" stroke="#00f0ff" strokeWidth={1.6} />
                <circle cx={width - 2} cy={marketData.nyS1 + (marketData.nyR1 - marketData.nyS1) * 0.5}
                        r={2.8} fill="#00f0ff" opacity={0.9} />
              </>
            )}
          </svg>

          {loading && !marketData && (
            <div className="absolute inset-0 flex items-center justify-center rounded bg-slate-950/40 backdrop-blur-sm">
              <div className="text-xs text-slate-300 animate-pulse">Loading BTC direction…</div>
            </div>
          )}
        </div>

        {/* Market Stats - BTC Focused (real values) */}
        {marketData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
            {[
              ['Support S1', fmtUsd(marketData.s1), '#22c55e', 'rgba(34,197,94,0.07)'],
              ['Support S2', fmtUsd(marketData.s2), '#4ade80', 'rgba(34,197,94,0.04)'],
              ['Resist R1', fmtUsd(marketData.r1), '#ef4444', 'rgba(239,68,68,0.07)'],
              ['Resist R2', fmtUsd(marketData.r2), '#ef4444', 'rgba(239,68,68,0.04)'],
              ['RSI Signal', `${marketData.currentRSI}`, '#f59e0b', 'rgba(245,158,11,0.07)'],
              ['Last Price', fmtUsd(currentPrice), '#00f0ff', 'rgba(0,240,255,0.06)'],
            ].map(([lbl, val, color, bg]) => (
              <div key={lbl} className="rounded-lg p-2.5"
                   style={{ background: bg as string, border: `1px solid ${color}30` }}>
                <div className="text-slate-400">{lbl}</div>
                <div className="font-bold mt-0.5" style={{ color: color as string }}>{val}</div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-3 text-xs text-red-400 rounded-lg bg-red-500/5 border border-red-500/20 p-3">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )
}
