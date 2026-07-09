"use client"
import { useMemo } from 'react'
import Modal from './Modal'
import CoinIcon from './CoinIcon'

export interface CoinAnalyzeData {
  symbol: string
  name: string
  price: number | string
  h1?: number
  h24?: number
  d7?: number
  volume?: string
  mcap?: string
  liq?: string
  signal?: string
}

interface Props {
  open: boolean
  onClose: () => void
  coin: CoinAnalyzeData | null
}

// ─── deterministic pseudorandom ──────────────────────────────────────
function prng(seed: number, i: number): number {
  return (Math.abs(Math.sin(seed * 127.1 + i * 311.7)) % 1)
}
function seedOf(sym: string): number {
  return sym.split('').reduce((a, c) => a + c.charCodeAt(0), 7) + 1
}

// ─── SVG Expert Chart — price line + MA20 + EMA12 + S/R dashed ───────
function ExpertChart({ seed }: { seed: number }) {
  const W = 800; const H = 120
  const pts = Array.from({ length: 50 }, (_, i) =>
    55 + Math.sin(i * 0.28 + seed * 0.07) * 22 + prng(seed, i + 50) * 18 - 4
  )
  const mn = Math.min(...pts), rng = Math.max(...pts) - mn || 1
  const ny = (v: number) => H - ((v - mn) / rng) * (H - 12) - 6
  const px = (i: number) => (i / (pts.length - 1)) * W

  const pricePath = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${ny(v).toFixed(1)}`).join(' ')

  // MA20
  const ma20 = pts.map((_, i) => {
    const sl = pts.slice(Math.max(0, i - 19), i + 1)
    return sl.reduce((a, b) => a + b, 0) / sl.length
  })
  const ma20Path = ma20.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${ny(v).toFixed(1)}`).join(' ')

  // EMA12
  const ema: number[] = []; let e = pts[0]; const k = 2 / 13
  pts.forEach(p => { e = p * k + e * (1 - k); ema.push(e) })
  const emaPath = ema.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${ny(v).toFixed(1)}`).join(' ')

  const s1 = mn + rng * 0.14; const s2 = mn + rng * 0.06
  const r1 = mn + rng * 0.83; const r2 = mn + rng * 0.93

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded" style={{ height: 130 }}>
        <rect width={W} height={H} fill="rgba(255,255,255,0.015)" rx="6" />
        {[0.25, 0.5, 0.75].map((f, i) => (
          <line key={i} x1={0} y1={H * f} x2={W} y2={H * f} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
        ))}
        {[0.2, 0.4, 0.6, 0.8].map((f, i) => (
          <line key={i} x1={W * f} y1={0} x2={W * f} y2={H} stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />
        ))}
        {/* Support zones */}
        <line x1={0} y1={ny(s1)} x2={W} y2={ny(s1)} stroke="#22c55e" strokeWidth={0.9} strokeDasharray="5 3" opacity={0.7} />
        <line x1={0} y1={ny(s2)} x2={W} y2={ny(s2)} stroke="#22c55e" strokeWidth={0.7} strokeDasharray="3 4" opacity={0.45} />
        <text x={3} y={ny(s1) - 2} fill="#22c55e" fontSize={6.5} opacity={0.85}>S1</text>
        <text x={3} y={ny(s2) - 2} fill="#22c55e" fontSize={6.5} opacity={0.55}>S2</text>
        {/* Resistance zones */}
        <line x1={0} y1={ny(r1)} x2={W} y2={ny(r1)} stroke="#ef4444" strokeWidth={0.9} strokeDasharray="5 3" opacity={0.7} />
        <line x1={0} y1={ny(r2)} x2={W} y2={ny(r2)} stroke="#ef4444" strokeWidth={0.7} strokeDasharray="3 4" opacity={0.45} />
        <text x={3} y={ny(r1) - 2} fill="#ef4444" fontSize={6.5} opacity={0.85}>R1</text>
        <text x={3} y={ny(r2) - 2} fill="#ef4444" fontSize={6.5} opacity={0.55}>R2</text>
        {/* Indicators */}
        <path d={ma20Path} fill="none" stroke="#f59e0b" strokeWidth={1.1} opacity={0.75} />
        <path d={emaPath}  fill="none" stroke="#6366f1" strokeWidth={1.1} opacity={0.75} />
        {/* Price */}
        <path d={pricePath} fill="none" stroke="#00f0ff" strokeWidth={1.6} />
        <circle cx={px(pts.length - 1)} cy={ny(pts[pts.length - 1])} r={2.8} fill="#00f0ff" />
      </svg>
      {/* MACD */}
      <div className="mt-1.5">
        <div className="text-[10px] text-slate-500 mb-0.5">MACD</div>
        <svg viewBox={`0 0 ${W} 36`} className="w-full" style={{ height: 36 }}>
          <line x1={0} y1={18} x2={W} y2={18} stroke="rgba(255,255,255,0.07)" strokeWidth={0.5} />
          {Array.from({ length: 26 }, (_, i) => {
            const v = (prng(seed, i + 200) - 0.5) * 2
            const bh = Math.abs(v) * 14
            const bw = W / 26 - 1
            return (
              <rect key={i} x={i * (W / 26)} y={v >= 0 ? 18 - bh : 18} width={bw} height={bh}
                fill={v >= 0 ? '#22c55e' : '#ef4444'} opacity={0.7} rx={1} />
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function SectionHead({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <div>
        <div className="font-bold text-sm text-white">{title}</div>
        {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
      </div>
    </div>
  )
}

function ScoreBar({ label, score, max = 100 }: { label: string; score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100)
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-slate-400 w-36 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-bold w-7 text-right" style={{ color }}>{score}</span>
    </div>
  )
}

function FibRow({ level, price, label, isCurrent, ext = false }: any) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${isCurrent ? 'bg-[rgba(0,240,255,0.08)] border border-[rgba(0,240,255,0.22)]' : 'bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'}`}>
      <span className="font-mono text-slate-400 w-14 flex-shrink-0">{typeof level === 'number' ? `${(level * 100).toFixed(1)}%` : level}</span>
      <div className="flex-1 h-0.5 bg-slate-800 rounded overflow-hidden">
        <div className="h-full rounded" style={{
          width: ext
            ? `${Math.min(parseFloat(String(level)) / 262 * 100, 100)}%`
            : `${typeof level === 'number' ? level * 100 : parseFloat(String(level))}%`,
          background: ext ? '#6366f1' : '#00f0ff', opacity: 0.55
        }} />
      </div>
      <span className={`font-mono font-semibold w-32 text-right ${isCurrent ? 'text-[#00f0ff]' : 'text-slate-200'}`}>${price}</span>
      <span className="text-slate-500 w-36 text-right truncate">{label}</span>
      {isCurrent && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[rgba(0,240,255,0.15)] text-[#00f0ff] flex-shrink-0">NOW</span>}
    </div>
  )
}

export default function AnalyzeModal({ open, onClose, coin }: Props) {
  const a = useMemo(() => {
    if (!coin) return null
    const sd = seedOf(coin.symbol)
    const p  = Number(coin.price) || 100

    const high = p * (1 + prng(sd, 1) * 0.35 + 0.12)
    const low  = p * (1 - prng(sd, 2) * 0.28 - 0.05)
    const span = high - low

    const moonList = [
      { icon: '🌑', name: 'New Moon',        bias: 'neutral' as const },
      { icon: '🌒', name: 'Waxing Crescent', bias: 'bullish' as const },
      { icon: '🌓', name: 'First Quarter',   bias: 'bullish' as const },
      { icon: '🌔', name: 'Waxing Gibbous',  bias: 'bullish' as const },
      { icon: '🌕', name: 'Full Moon',        bias: 'bearish' as const },
      { icon: '🌖', name: 'Waning Gibbous',  bias: 'bearish' as const },
      { icon: '🌗', name: 'Last Quarter',    bias: 'neutral' as const },
      { icon: '🌘', name: 'Waning Crescent', bias: 'bearish' as const },
    ]
    const moon = moonList[sd % moonList.length]

    const fibRet = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map(f => ({
      level: f,
      price: (high - span * f).toFixed(p >= 100 ? 2 : p >= 1 ? 4 : 8),
      label: f === 0 ? 'Swing High (0%)' : f === 1 ? 'Swing Low (100%)' : `${(f * 100).toFixed(1)}% Retracement`,
      isCurrent: Math.abs(high - span * f - p) < span * 0.07,
    }))

    const fibExt = [
      { level: '127.2%', price: (high + span * 0.272).toFixed(p >= 100 ? 2 : 6), label: '1st Extension Target' },
      { level: '141.4%', price: (high + span * 0.414).toFixed(p >= 100 ? 2 : 6), label: '2nd Extension Target' },
      { level: '161.8%', price: (high + span * 0.618).toFixed(p >= 100 ? 2 : 6), label: 'Golden Extension' },
      { level: '200.0%', price: (high + span * 1.000).toFixed(p >= 100 ? 2 : 6), label: '2× Extension' },
      { level: '261.8%', price: (high + span * 1.618).toFixed(p >= 100 ? 2 : 6), label: '2.618× Extension' },
    ]

    const fg = Math.floor(22 + prng(sd, 3) * 68)
    const fgLabel = fg < 25 ? 'Extreme Fear' : fg < 45 ? 'Fear' : fg < 55 ? 'Neutral' : fg < 75 ? 'Greed' : 'Extreme Greed'
    const fgColor = fg < 25 ? '#ef4444' : fg < 45 ? '#f97316' : fg < 55 ? '#94a3b8' : fg < 75 ? '#22c55e' : '#4ade80'

    const rsi    = 28 + prng(sd, 23) * 52
    const ma20v  = p * (1 - prng(sd, 17) * 0.06)
    const ma50v  = p * (1 - prng(sd, 18) * 0.09)
    const ema12v = p * (1 + prng(sd, 19) * 0.025)
    const ema26v = p * (1 - prng(sd, 20) * 0.035)
    const macdV  = (prng(sd, 21) - 0.5) * p * 0.022
    const macdSig= (prng(sd, 22) - 0.5) * p * 0.016

    const longR = Math.floor(44 + prng(sd, 34) * 24)
    const aiScore = Math.floor(47 + prng(sd, 38) * 50)
    const fp = (v: number) => p >= 100 ? v.toFixed(2) : p >= 1 ? v.toFixed(4) : v.toFixed(8)

    return {
      sd, p, moon, fibRet, fibExt, fg, fgLabel, fgColor, rsi, longR, aiScore, fp,
      ma20v, ma50v, ema12v, ema26v, macdV, macdSig,
      s1: p * (1 - prng(sd, 24) * 0.07),
      s2: p * (1 - prng(sd, 25) * 0.14),
      r1: p * (1 + prng(sd, 26) * 0.08),
      r2: p * (1 + prng(sd, 27) * 0.19),
      btcCorr: ((prng(sd, 28) - 0.25) * 1.5).toFixed(2),
      sector: prng(sd, 31) > 0.55 ? 'BULLISH' : prng(sd, 31) > 0.35 ? 'NEUTRAL' : 'BEARISH',
      timeframes: [
        { tf: '15M', bias: prng(sd, 5)  > 0.45 ? 'BULLISH' : 'BEARISH', pct: Math.floor(prng(sd, 60) * 40 + (prng(sd, 5) > 0.45 ? 55 : 25)) },
        { tf: '1H',  bias: prng(sd, 8)  > 0.40 ? 'BULLISH' : 'BEARISH', pct: Math.floor(prng(sd, 61) * 40 + (prng(sd, 8) > 0.40 ? 55 : 25)) },
        { tf: '4H',  bias: prng(sd, 11) > 0.45 ? 'BULLISH' : 'BEARISH', pct: Math.floor(prng(sd, 62) * 40 + (prng(sd, 11) > 0.45 ? 55 : 25)) },
        { tf: '1D',  bias: prng(sd, 14) > 0.50 ? 'BULLISH' : 'BEARISH', pct: Math.floor(prng(sd, 63) * 40 + (prng(sd, 14) > 0.50 ? 55 : 25)) },
        { tf: '1W',  bias: prng(sd, 15) > 0.45 ? 'BULLISH' : 'BEARISH', pct: Math.floor(prng(sd, 64) * 40 + (prng(sd, 15) > 0.45 ? 55 : 25)) },
      ],
      futures: {
        oi:       `$${(prng(sd, 32) * 2.8 + 0.1).toFixed(2)}B`,
        funding:  `${((prng(sd, 33) - 0.5) * 0.1).toFixed(4)}%`,
        lshort:   longR,
        oiChg:    `${prng(sd, 36) > 0.5 ? '+' : '-'}${(prng(sd, 37) * 14).toFixed(1)}%`,
        liqLong:  `$${(prng(sd, 39) * 50 + 1).toFixed(1)}M`,
        liqShort: `$${(prng(sd, 40) * 30 + 1).toFixed(1)}M`,
      },
      indicators: [
        { name: 'MA 20',  val: fp(ma20v),           sig: p > ma20v ? 'BUY' : 'SELL' },
        { name: 'MA 50',  val: fp(ma50v),           sig: p > ma50v ? 'BUY' : 'SELL' },
        { name: 'EMA 12', val: fp(ema12v),          sig: p > ema12v ? 'BUY' : 'SELL' },
        { name: 'EMA 26', val: fp(ema26v),          sig: p > ema26v ? 'BUY' : 'SELL' },
        { name: 'MACD',   val: macdV.toFixed(6),   sig: macdV > macdSig ? 'BUY' : 'SELL' },
        { name: 'RSI 14', val: rsi.toFixed(1),     sig: rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL' },
        { name: 'Stoch',  val: (prng(sd, 65) * 100).toFixed(1), sig: prng(sd, 65) > 0.7 ? 'OVERBOUGHT' : prng(sd, 65) < 0.3 ? 'OVERSOLD' : 'NEUTRAL' },
      ],
      aiBreakdown: [
        { label: 'On-chain Activity', score: Math.floor(38 + prng(sd, 39) * 58) },
        { label: 'Volume Momentum',   score: Math.floor(33 + prng(sd, 40) * 62) },
        { label: 'Whale Behavior',    score: Math.floor(28 + prng(sd, 41) * 68) },
        { label: 'Technical Setup',   score: Math.floor(38 + prng(sd, 42) * 58) },
        { label: 'Market Structure',  score: Math.floor(33 + prng(sd, 43) * 62) },
        { label: 'Sentiment Score',   score: Math.floor(35 + prng(sd, 44) * 58) },
      ],
      whaleFlow: prng(sd, 44) > 0.5 ? 'NET INFLOW' : 'NET OUTFLOW',
      whaleFlowPct: (prng(sd, 45) * 28).toFixed(1),
      volMcap: (prng(sd, 46) * 85 + 5).toFixed(1),
      d30: parseFloat(((prng(sd, 50) - 0.28) * 45).toFixed(1)),
      ytd: parseFloat(((prng(sd, 51) - 0.20) * 90).toFixed(1)),
    }
  }, [coin])

  if (!coin || !a) return null

  const fmtP = (v: number) => coin.price && Number(coin.price) >= 100 ? v.toFixed(2) : v >= 1 ? v.toFixed(4) : v.toFixed(8)
  const fmtPct = (v: number | undefined) => v === undefined ? '—' : `${v >= 0 ? '+' : ''}${v}%`
  const sigCol = (s: string) => s === 'BUY' ? '#22c55e' : s === 'SELL' ? '#ef4444' : '#94a3b8'
  const biasCol = (b: string) => b === 'BULLISH' ? '#22c55e' : b === 'BEARISH' ? '#ef4444' : '#94a3b8'

  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-5">

        {/* ─── Header ───────────────────────────────────────────── */}
        <div className="flex items-start gap-4 pb-4 border-b border-[rgba(255,255,255,0.06)]">
          <CoinIcon symbol={coin.symbol} size={52} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold">{coin.name}</h2>
              <span className="text-sm text-slate-400 font-mono">{coin.symbol}</span>
              {coin.signal && (
                <span className="px-2 py-0.5 rounded text-xs font-bold"
                  style={{ background: coin.signal === 'BUY' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: coin.signal === 'BUY' ? '#22c55e' : '#ef4444' }}>
                  {coin.signal === 'BUY' ? '▲' : '▼'} {coin.signal}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-2xl font-bold">${fmtP(a.p)}</span>
              <span className={`text-sm font-semibold ${(coin.h24 ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPct(coin.h24)} 24H</span>
              <span className={`text-xs ${(coin.h1 ?? 0) >= 0 ? 'text-green-300' : 'text-red-300'}`}>{fmtPct(coin.h1)} 1H</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-slate-400 mb-0.5">AI Score</div>
            <div className="text-3xl font-bold leading-none" style={{ color: a.aiScore >= 70 ? '#22c55e' : a.aiScore >= 50 ? '#eab308' : '#ef4444' }}>
              {a.aiScore}<span className="text-sm text-slate-500">/100</span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: a.aiScore >= 70 ? '#22c55e' : a.aiScore >= 50 ? '#eab308' : '#ef4444' }}>
              {a.aiScore >= 70 ? 'Strong BUY' : a.aiScore >= 50 ? 'Watch' : 'Weak'}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors flex-shrink-0 text-lg leading-none px-1">✕</button>
        </div>

        {/* ─── 1. Moon Phase + 2. Timeframe Potential ───────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card-glass rounded-xl p-4">
            <SectionHead icon={a.moon.icon} title="Moon Phase" sub="Lunar market bias indicator" />
            <div className="flex items-center gap-4">
              <div className="text-5xl">{a.moon.icon}</div>
              <div>
                <div className="font-bold text-sm">{a.moon.name}</div>
                <div className={`text-xs mt-1.5 px-2 py-0.5 rounded inline-block font-semibold ${a.moon.bias === 'bullish' ? 'bg-green-500/10 text-green-400' : a.moon.bias === 'bearish' ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'}`}>
                  {a.moon.bias === 'bullish' ? '▲ Accumulation window' : a.moon.bias === 'bearish' ? '▼ Distribution caution' : '◆ Neutral — wait confirmation'}
                </div>
              </div>
            </div>
          </div>
          <div className="card-glass rounded-xl p-4">
            <SectionHead icon="⏱" title="Timeframe Potential" sub="Multi-TF directional bias" />
            <div className="space-y-2">
              {a.timeframes.map(({ tf, bias, pct }) => (
                <div key={tf} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400 w-7 flex-shrink-0">{tf}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: biasCol(bias) }} />
                  </div>
                  <span className="text-xs font-bold w-16 text-right" style={{ color: biasCol(bias) }}>{bias}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── 3. Expert Chart ──────────────────────────────────── */}
        <div className="card-glass rounded-xl p-4">
          <SectionHead icon="📊" title="Expert Chart" sub="MA20 · EMA12 · MACD · Support & Resistance" />
          <div className="flex items-center gap-4 mb-3 flex-wrap text-[10px]">
            {[['─', '#00f0ff', 'Price'], ['─', '#f59e0b', 'MA20'], ['─', '#6366f1', 'EMA12'], ['- -', '#22c55e', 'Support'], ['- -', '#ef4444', 'Resist']].map(([sym, col, lbl]) => (
              <div key={lbl} className="flex items-center gap-1">
                <span style={{ color: col as string, fontWeight: 'bold', fontSize: 13 }}>{sym}</span>
                <span className="text-slate-400">{lbl}</span>
              </div>
            ))}
          </div>
          <ExpertChart seed={a.sd} />
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              ['Support S1', `$${fmtP(a.s1)}`, '#22c55e', 'rgba(34,197,94,0.07)'],
              ['Support S2', `$${fmtP(a.s2)}`, '#4ade80', 'rgba(34,197,94,0.04)'],
              ['Resist R1',  `$${fmtP(a.r1)}`, '#ef4444', 'rgba(239,68,68,0.07)'],
              ['Resist R2',  `$${fmtP(a.r2)}`, '#f87171', 'rgba(239,68,68,0.04)'],
            ].map(([lbl, val, color, bg]) => (
              <div key={lbl} className="rounded-lg p-2.5" style={{ background: bg as string, border: `1px solid ${color}30` }}>
                <div className="text-slate-400">{lbl}</div>
                <div className="font-bold mt-0.5" style={{ color: color as string }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 4. Market Data + 5. Price Changes ───────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card-glass rounded-xl p-4">
            <SectionHead icon="📈" title="Market Data" />
            <div className="space-y-2 text-xs">
              {[
                ['Price',      `$${fmtP(a.p)}`],
                ['Market Cap', coin.mcap   ?? '—'],
                ['Vol 24H',    coin.volume ?? '—'],
                ['Liquidity',  coin.liq    ?? '—'],
                ['Vol/MCap',   a.volMcap + '%'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card-glass rounded-xl p-4">
            <SectionHead icon="📉" title="Price Changes" />
            <div className="space-y-2 text-xs">
              {([['1H', coin.h1], ['24H', coin.h24], ['7D', coin.d7], ['30D', a.d30], ['YTD', a.ytd]] as [string, number | undefined][]).map(
                ([lbl, val]) => (
                  <div key={lbl} className="flex items-center justify-between">
                    <span className="text-slate-400">{lbl}</span>
                    <span className={`font-bold ${(val ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPct(val)}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* ─── 6. Volume, MCap & Whale Insight ─────────────────── */}
        <div className="card-glass rounded-xl p-4">
          <SectionHead icon="🐋" title="Volume, Market Cap & Whale Insight" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-slate-400 mb-1">Whale Net Flow</div>
              <div className={`text-base font-bold ${a.whaleFlow === 'NET INFLOW' ? 'text-green-400' : 'text-red-400'}`}>
                {a.whaleFlow === 'NET INFLOW' ? '▲' : '▼'} {a.whaleFlow}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{a.whaleFlowPct}% of 24H volume</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Vol/MCap Ratio</div>
              <div className="text-base font-bold" style={{ color: parseFloat(a.volMcap) > 40 ? '#f59e0b' : '#94a3b8' }}>{a.volMcap}%</div>
              <div className="text-xs text-slate-400 mt-0.5">{parseFloat(a.volMcap) > 50 ? 'Extreme activity' : parseFloat(a.volMcap) > 25 ? 'High activity' : 'Normal'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1.5">Exchange Flow</div>
              <div className="space-y-1.5">
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5"><span className="text-green-400">Inflow</span><span className="text-green-400">{(prng(a.sd, 47) * 40 + 30).toFixed(0)}%</span></div>
                  <div className="h-1.5 bg-slate-800 rounded"><div className="h-full bg-green-500 rounded" style={{ width: `${prng(a.sd, 47) * 40 + 30}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5"><span className="text-red-400">Outflow</span><span className="text-red-400">{(prng(a.sd, 48) * 35 + 20).toFixed(0)}%</span></div>
                  <div className="h-1.5 bg-slate-800 rounded"><div className="h-full bg-red-500 rounded" style={{ width: `${prng(a.sd, 48) * 35 + 20}%` }} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 7. Fibonacci Potential ───────────────────────────── */}
        <div className="card-glass rounded-xl p-4">
          <SectionHead icon="🔢" title="Fibonacci Potential" sub="Current price vs key retracement levels" />
          <div className="space-y-1.5">
            {a.fibRet.map((f) => <FibRow key={String(f.level)} {...f} />)}
          </div>
        </div>

        {/* ─── 8. Macro Sentiment ───────────────────────────────── */}
        <div className="card-glass rounded-xl p-4">
          <SectionHead icon="🌍" title="Macro Sentiment" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-slate-400 mb-1.5">Fear & Greed Index</div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold" style={{ color: a.fgColor }}>{a.fg}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: a.fgColor + '1a', color: a.fgColor }}>{a.fgLabel}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gradient-to-r from-red-600 via-yellow-400 to-green-500 relative">
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#0b1220] shadow" style={{ left: `calc(${a.fg}% - 6px)` }} />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5"><span>Fear</span><span>Greed</span></div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1.5">BTC Correlation</div>
              <div className="text-2xl font-bold text-white">{a.btcCorr}</div>
              <div className="text-xs text-slate-400 mt-1">{parseFloat(a.btcCorr) > 0.6 ? 'High positive corr' : parseFloat(a.btcCorr) < 0 ? 'Inverse / uncorrelated' : 'Weak correlation'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1.5">Sector Sentiment</div>
              <div className="text-base font-bold" style={{ color: biasCol(a.sector) }}>{a.sector}</div>
              <div className="text-xs text-slate-400 mt-1">DeFi / Alt ecosystem</div>
            </div>
          </div>
        </div>

        {/* ─── 9. Futures Analysis ──────────────────────────────── */}
        <div className="card-glass rounded-xl p-4">
          <SectionHead icon="📊" title="Futures Analysis — BTC/USDT Perp" sub="Perpetual contract metrics" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {[
              ['Open Interest',    a.futures.oi,       '#94a3b8'],
              ['Funding Rate',     a.futures.funding,  parseFloat(a.futures.funding) >= 0 ? '#22c55e' : '#ef4444'],
              ['OI Change 24H',    a.futures.oiChg,    a.futures.oiChg.startsWith('+') ? '#22c55e' : '#ef4444'],
              ['Est. Liq Longs',   a.futures.liqLong,  '#f59e0b'],
              ['Est. Liq Shorts',  a.futures.liqShort, '#f59e0b'],
              ['Long/Short',       `${a.futures.lshort}/${100 - a.futures.lshort}`, a.futures.lshort > 50 ? '#22c55e' : '#ef4444'],
            ].map(([lbl, val, col]) => (
              <div key={lbl as string} className="bg-[rgba(255,255,255,0.03)] rounded-lg p-3">
                <div className="text-[10px] text-slate-400 mb-0.5">{lbl}</div>
                <div className="font-bold text-sm" style={{ color: col as string }}>{val}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1.5">Long/Short Ratio</div>
            <div className="h-2.5 rounded-full overflow-hidden flex">
              <div className="bg-green-500 h-full" style={{ width: `${a.futures.lshort}%` }} />
              <div className="bg-red-500 h-full" style={{ width: `${100 - a.futures.lshort}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-green-400 font-semibold">{a.futures.lshort}% Long</span>
              <span className="text-red-400 font-semibold">{100 - a.futures.lshort}% Short</span>
            </div>
          </div>
        </div>

        {/* ─── 10. Indicator Guide ──────────────────────────────── */}
        <div className="card-glass rounded-xl p-4">
          <SectionHead icon="📐" title="Indicator Guide — MA / EMA / MACD" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[360px]">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.05)] text-slate-400 text-[10px] uppercase tracking-wide">
                  <th className="py-2 text-left">Indicator</th>
                  <th className="py-2 text-right">Value</th>
                  <th className="py-2 text-right">vs Price</th>
                  <th className="py-2 text-right">Signal</th>
                </tr>
              </thead>
              <tbody>
                {a.indicators.map((ind) => (
                  <tr key={ind.name} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="py-1.5 font-medium">{ind.name}</td>
                    <td className="py-1.5 text-right font-mono text-slate-300">${ind.val}</td>
                    <td className="py-1.5 text-right">
                      {ind.name !== 'MACD' && ind.name !== 'RSI 14' && ind.name !== 'Stoch' ? (
                        <span className="text-xs" style={{ color: a.p > parseFloat(ind.val.replace('$','')) ? '#22c55e' : '#ef4444' }}>
                          {a.p > parseFloat(ind.val.replace('$','')) ? '▲ Above' : '▼ Below'}
                        </span>
                      ) : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="py-1.5 text-right">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: sigCol(ind.sig) + '20', color: sigCol(ind.sig) }}>
                        {ind.sig}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── 11. AI Coin Scoring ──────────────────────────────── */}
        <div className="card-glass rounded-xl p-4">
          <SectionHead icon="🤖" title="AI Coin Scoring & Rankings" />
          <div className="flex items-center gap-5 mb-5">
            <div className="relative w-18 h-18 flex-shrink-0" style={{ width: 72, height: 72 }}>
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.9" fill="none"
                  stroke={a.aiScore >= 70 ? '#22c55e' : a.aiScore >= 50 ? '#eab308' : '#ef4444'}
                  strokeWidth="3.5"
                  strokeDasharray={`${a.aiScore} ${100 - a.aiScore}`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-base font-bold">{a.aiScore}</div>
            </div>
            <div>
              <div className="font-bold text-lg" style={{ color: a.aiScore >= 70 ? '#22c55e' : a.aiScore >= 50 ? '#eab308' : '#ef4444' }}>
                {a.aiScore >= 75 ? 'Strong Signal' : a.aiScore >= 60 ? 'Moderate Signal' : a.aiScore >= 50 ? 'Watch Zone' : 'Weak Signal'}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Composite AI score from 6 factors</div>
              <div className="text-xs text-slate-500 mt-0.5">Updated: {new Date().toLocaleTimeString()}</div>
            </div>
          </div>
          <div className="space-y-2.5">
            {a.aiBreakdown.map((b) => <ScoreBar key={b.label} label={b.label} score={b.score} />)}
          </div>
        </div>

        {/* ─── 12. Fibonacci Retracement & Extension Levels ────── */}
        <div className="card-glass rounded-xl p-4">
          <SectionHead icon="📐" title="Fibonacci Retracement & Extension Levels" sub="Based on recent major swing high/low" />
          <div className="mb-4">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00f0ff] inline-block" />Retracement Levels
            </div>
            <div className="space-y-1">
              {a.fibRet.map((f) => <FibRow key={String(f.level)} {...f} />)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#6366f1] inline-block" />Extension Targets
            </div>
            <div className="space-y-1">
              {a.fibExt.map((f) => <FibRow key={f.level} level={f.level} price={f.price} label={f.label} isCurrent={false} ext />)}
            </div>
          </div>
        </div>

      </div>
    </Modal>
  )
}
