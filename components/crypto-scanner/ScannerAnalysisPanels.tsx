"use client"
import { useMemo, useState } from 'react'
import {
  CoinAnalysis,
  MoonPhaseInfo,
  getMoonPhaseDates,
  formatUsd,
  formatPrice,
  formatCompact,
  scoreColor,
} from '../../lib/cryptoScannerAnalysis'

function fmtMoonDate(d: Date): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des']
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Moon Phase Analysis
// ─────────────────────────────────────────────────────────────────────────────
export function MoonPhasePanel({ coin }: { coin: CoinAnalysis }) {
  const moon: MoonPhaseInfo = coin.moon
  const phases = getMoonPhaseDates()
  const illumPct = Math.round((moon.illumination || 0) * 100)
  const daysInCycle = moon.phase?.toFixed(1) ?? '—'
  const daysToFull = moon.phaseIndex < 4
    ? ((4 - moon.phaseIndex) * 3.7).toFixed(0)
    : ((8 - moon.phaseIndex + 4) * 3.7).toFixed(0)
  const aiWeightColor = moon.aiWeight > 0 ? '#4ade80' : moon.aiWeight < 0 ? '#f87171' : '#94a3b8'
  const aiWeightStr = moon.aiWeight >= 0 ? `+${moon.aiWeight} pts` : `${moon.aiWeight} pts`

  return (
    <div className="space-y-4">
      {/* Current phase summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-glass rounded-xl p-3">
          <div className="text-3xl mb-1">{moon.icon}</div>
          <div className="text-xs text-slate-400">Fase Saat Ini</div>
          <div className="font-semibold text-sm text-white">{moon.name}</div>
        </div>
        <div className="card-glass rounded-xl p-3">
          <div className="text-xs text-slate-400 mb-1">Bias Lunar</div>
          <div className="font-semibold text-sm" style={{ color: moon.biasColor }}>{moon.bias}</div>
        </div>
        <div className="card-glass rounded-xl p-3">
          <div className="text-xs text-slate-400 mb-1">Iluminasi</div>
          <div className="font-semibold text-sm text-white">{illumPct}%</div>
          <div className="text-[10px] text-slate-500">hari siklus {daysInCycle}</div>
        </div>
        <div className="card-glass rounded-xl p-3">
          <div className="text-xs text-slate-400 mb-1">Bobot AI Score</div>
          <div className="font-semibold text-sm" style={{ color: aiWeightColor }}>{aiWeightStr}</div>
          <div className="text-[10px] text-slate-500">~{daysToFull} hari ke Full Moon</div>
        </div>
      </div>

      {/* 8-phase cycle */}
      <div className="card-glass rounded-xl p-4">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">Siklus 8 Fase Lunar</div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {phases.map((p, i) => {
            const isActive = i === moon.phaseIndex
            return (
              <div key={i} className="flex items-center gap-1 flex-shrink-0">
                <div
                  className={`flex flex-col items-center px-2 py-1.5 rounded-lg border ${
                    isActive ? 'border-indigo-500 bg-[rgba(99,102,241,0.15)]' : 'border-[rgba(255,255,255,0.06)]'
                  }`}
                  title={`${p.name} — ${fmtMoonDate(p.start)}`}
                >
                  <span className="text-lg leading-none">{p.icon}</span>
                  <span className="text-[9px] mt-1 text-slate-400 whitespace-nowrap">{p.name}</span>
                  {isActive && <span className="text-[9px] font-bold text-indigo-400">Saat ini</span>}
                  <span className="text-[9px] text-slate-500">{fmtMoonDate(p.start)}</span>
                </div>
                {i < phases.length - 1 && <div className="w-2 h-px bg-[rgba(255,255,255,0.12)]" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Crypto impact + strategy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card-glass rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Dampak ke Crypto</div>
          <p className="text-sm text-slate-200">{moon.cryptoImpact}</p>
        </div>
        <div className="card-glass rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Strategi</div>
          <p className="text-sm text-slate-200">{moon.strategy}</p>
        </div>
      </div>

      {/* How moon factors into AI score */}
      <div className="card-glass rounded-xl p-4 border border-[rgba(99,102,241,0.2)]">
        <div className="font-semibold text-sm text-indigo-300 mb-2">Bagaimana Moon Phase masuk ke AI Score?</div>
        <p className="text-xs text-slate-300 leading-relaxed">
          AI Score <strong>{coin.name}</strong> ({coin.symbol}) dibangun dari <strong>6 faktor teknikal</strong> (Momentum 24h, Trend 7D, Likuiditas, MCap Rank, RSI, Futures Signal). Moon Phase ditambahkan sebagai faktor ke-7 — sebuah <em>sentiment modifier</em> berbasis korelasi historis siklus lunar. Nilainya ditambahkan langsung ke skor: fase bullish ({'🌔'} +5, {'🌒'} +3) menaikkan skor, fase exhaustion ({'🌕'} -8) menurunkannya.
        </p>
        <div className="mt-3 rounded-lg bg-[rgba(0,0,0,0.25)] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Kontribusi saat ini</div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{moon.icon}</span>
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">{moon.name} ({moon.bias})</span>
                <span style={{ color: aiWeightColor }}>{aiWeightStr}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.abs(moon.aiWeight) / 8 * 100)}%`, background: aiWeightColor }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-500 leading-relaxed">
        💡 <strong>Catatan:</strong> Moon Phase adalah faktor <em>probabilistik</em>, bukan deterministik. Digunakan sebagai konteks tambahan, bukan sinyal utama. Selalu kombinasikan dengan analisis teknikal (MA/EMA/MACD) dan fundamental.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Fibonacci Potential
// ─────────────────────────────────────────────────────────────────────────────
export function FibonacciPanel({ coin }: { coin: CoinAnalysis }) {
  const fib = coin.fibonacci
  if (!fib) {
    return (
      <div className="card-glass rounded-xl p-8 text-center text-slate-400">
        📐 Data harga historis tidak cukup untuk menghitung level Fibonacci.
      </div>
    )
  }

  const accuracyColor = fib.accuracy === 'High' ? '#4ade80' : fib.accuracy === 'Medium' ? '#fbbf24' : '#f87171'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-glass rounded-xl p-3">
          <div className="text-xs text-slate-400">Trend Direction</div>
          <div className="font-semibold text-sm" style={{ color: fib.trend === 'up' ? '#22c55e' : '#ef4444' }}>
            {fib.trend === 'up' ? '📈 Uptrend' : '📉 Downtrend'}
          </div>
        </div>
        <div className="card-glass rounded-xl p-3">
          <div className="text-xs text-slate-400">High (Lookback)</div>
          <div className="font-semibold text-sm text-white">{formatPrice(fib.high)}</div>
        </div>
        <div className="card-glass rounded-xl p-3">
          <div className="text-xs text-slate-400">Low (Lookback)</div>
          <div className="font-semibold text-sm text-white">{formatPrice(fib.low)}</div>
        </div>
        <div className="card-glass rounded-xl p-3">
          <div className="text-xs text-slate-400">Accuracy</div>
          <div className="font-semibold text-sm" style={{ color: accuracyColor }}>{fib.accuracy}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card-glass rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">Retracement Levels</div>
          <div className="space-y-2">
            {fib.retracements.map((lvl) => (
              <div key={lvl.ratio} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{(lvl.ratio * 100).toFixed(1)}%</span>
                <span className="font-mono font-semibold text-white">{formatPrice(lvl.level)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card-glass rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">Extension Levels</div>
          <div className="space-y-2">
            {fib.extensions.map((lvl) => (
              <div key={lvl.ratio} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{(lvl.ratio * 100).toFixed(1)}%</span>
                <span className="font-mono font-semibold text-white">{formatPrice(lvl.level)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-glass rounded-xl p-4">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Accuracy Note</div>
        <p className="text-sm text-slate-200">{fib.note}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Futures Analysis
// ─────────────────────────────────────────────────────────────────────────────
export function FuturesPanel({ coin }: { coin: CoinAnalysis }) {
  const f = coin.futures

  if (f.isNeutral) {
    return (
      <div className="card-glass rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">⚪</div>
        <h4 className="text-lg font-bold text-slate-300 mb-2">NETRAL — Hindari Futures</h4>
        <p className="text-slate-400 text-sm mb-4">
          Sinyal tidak cukup kuat untuk masuk posisi futures saat ini.<br />
          Tunggu konfirmasi breakout atau reversal yang lebih jelas.
        </p>
        <div className="text-xs text-slate-500 border-t border-[rgba(255,255,255,0.06)] pt-3">
          ⚠️ Futures berisiko tinggi. Selalu gunakan SL dan hanya trading dengan modal yang siap hilang.
        </div>
      </div>
    )
  }

  const isLong = f.direction.startsWith('long')
  const isShort = f.direction.startsWith('short')
  const tpPct = (p: number) => `${isShort ? '−' : '+'}${p.toFixed(2)}%`

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Direction */}
        <div className="card-glass rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-2">Rekomendasi</div>
          <div className="text-xl font-bold mb-3" style={{ color: f.dirColor }}>
            {f.dirEmoji} {f.dirLabel}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-slate-400">Leverage Optimal</span>
            <span className="px-2 py-0.5 rounded text-sm font-bold border" style={{ borderColor: f.dirColor, color: f.dirColor }}>
              {f.leverage}×
            </span>
          </div>
          <div className="text-xs text-slate-400 mb-1">Confidence: <span className="text-slate-200">{f.confidence}</span></div>
          <div className="text-xs text-slate-400">Volatilitas: <span className="text-slate-200">{f.volatilityLevel}</span></div>
        </div>

        {/* Levels */}
        <div className="card-glass rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Entry / TP / SL / Liq</div>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-[rgba(255,255,255,0.04)]">
                <td className="py-1.5 text-slate-400">🎯 Entry</td>
                <td className="py-1.5 text-right font-mono text-white">{formatCompact(f.entry)}</td>
                <td className="py-1.5 text-right text-slate-500">—</td>
              </tr>
              <tr className="border-b border-[rgba(255,255,255,0.04)]">
                <td className="py-1.5 text-green-400">✅ TP1</td>
                <td className="py-1.5 text-right font-mono text-white">{formatCompact(f.tp1)}</td>
                <td className="py-1.5 text-right text-green-400">{tpPct(f.rewardPct)}</td>
              </tr>
              <tr className="border-b border-[rgba(255,255,255,0.04)]">
                <td className="py-1.5 text-green-400">🚀 TP2</td>
                <td className="py-1.5 text-right font-mono text-white">{formatCompact(f.tp2)}</td>
                <td className="py-1.5 text-right text-green-400">{tpPct(f.rewardPct * 1.8)}</td>
              </tr>
              <tr className="border-b border-[rgba(255,255,255,0.04)]">
                <td className="py-1.5 text-red-400">🛑 SL</td>
                <td className="py-1.5 text-right font-mono text-white">{formatCompact(f.sl)}</td>
                <td className="py-1.5 text-right text-red-400">{isShort ? '+' : '−'}{f.riskPct.toFixed(2)}%</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate-400">💀 Liq.</td>
                <td className="py-1.5 text-right font-mono text-white">{formatCompact(f.liqEstimate)}</td>
                <td className="py-1.5 text-right text-slate-500">@{f.leverage}×</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-2 text-xs text-slate-300">
            Risk / Reward: <strong className="text-white">1 : {f.rrRatio.toFixed(2)}</strong>
          </div>
        </div>

        {/* Indicators */}
        <div className="card-glass rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Indikator Teknikal</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">RSI(14)</span>
              <span className={f.rsi < 30 ? 'text-green-400' : f.rsi > 70 ? 'text-red-400' : 'text-slate-200'}>{f.rsi.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ATR%</span>
              <span className="text-slate-200">{f.atrPct.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Support</span>
              <span className="text-green-400 font-mono">{formatCompact(f.support)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Resistance</span>
              <span className="text-red-400 font-mono">{formatCompact(f.resistance)}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Faktor Sinyal</div>
            <div className="space-y-1">
              {f.factors.map((fc, i) => (
                <div key={i} className="text-[11px] text-slate-300">• {fc}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-500 leading-relaxed border-t border-[rgba(255,255,255,0.06)] pt-3">
        ⚠️ <strong>Disclaimer:</strong> Analisis ini bersifat edukatif dan BUKAN saran keuangan. Futures berisiko tinggi — gunakan SL wajib, posisi maksimal 1–3% dari modal.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicator Guide
// ─────────────────────────────────────────────────────────────────────────────
export function IndicatorGuidePanel({ coin }: { coin: CoinAnalysis }) {
  const ig = coin.indicators
  const fmt = (n: number | null) => (n != null && Number.isFinite(n) ? formatPrice(n) : '—')
  const fmtI = (n: number | null) => (n != null && Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(4)}` : '—')
  const overallColor = ig.overallOk ? '#4ade80' : '#f87171'

  const card = (title: string, formula: string, desc: string, checks: { id: string; ok: boolean; label: string; note: string }[]) => (
    <div className="card-glass rounded-xl p-4">
      <div className="font-semibold text-sm text-white mb-1">{title}</div>
      <div className="text-[10px] font-mono text-indigo-300 mb-2">{formula}</div>
      <div className="text-xs text-slate-400 mb-3">{desc}</div>
      <div className="space-y-2">
        {checks.map((c) => (
          <div key={c.id} className={`rounded-lg p-2 border ${c.ok ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
            <div className={`text-xs font-semibold ${c.ok ? 'text-green-400' : 'text-red-400'}`}>{c.label}</div>
            <div className="text-[10px] text-slate-500">{c.note}</div>
          </div>
        ))}
      </div>
    </div>
  )

  const byId = (id: string) => ig.checks.filter((c) => c.id === id)

  return (
    <div className="space-y-4">
      <div className="card-glass rounded-xl p-4 flex items-center justify-between" style={{ borderColor: overallColor }}>
        <span className="font-bold text-white" style={{ color: overallColor }}>{ig.overallLabel}</span>
        <span className="text-xs text-slate-400">{ig.bullCount} dari {ig.totalCount} kondisi bullish terpenuhi</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {card('MA (Moving Average)', 'MA20 = (P₁ + P₂ + … + P₂₀) ÷ 20', 'Rata-rata harga sederhana 20 hari terakhir. Bertindak sebagai support/resistance dinamis.', byId('ma20'))}
        {card('⚡ EMA (Exponential MA)', 'EMAₜ = Pₜ × k + EMAₜ₋₁ × (1−k) · k = 2÷(n+1)', 'Seperti MA tapi memberi bobot lebih pada harga terbaru. Lebih reaktif terhadap perubahan harga.', byId('ema20').concat(byId('ema20v50')))}
        {card('MACD (Momentum)', 'MACD = EMA12 − EMA26 · Signal = EMA9(MACD) · Hist = MACD − Signal', 'Mengukur kekuatan dan arah momentum. Histogram positif = momentum naik.', byId('macd').concat(byId('hist')))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-glass rounded-xl p-3">
          <div className="text-[10px] text-slate-400">MA20</div>
          <div className="font-mono text-sm text-white">{fmt(ig.ma20)}</div>
        </div>
        <div className="card-glass rounded-xl p-3">
          <div className="text-[10px] text-slate-400">EMA20</div>
          <div className="font-mono text-sm text-white">{fmt(ig.ema20)}</div>
        </div>
        <div className="card-glass rounded-xl p-3">
          <div className="text-[10px] text-slate-400">EMA50</div>
          <div className="font-mono text-sm text-white">{fmt(ig.ema50)}</div>
        </div>
        <div className="card-glass rounded-xl p-3">
          <div className="text-[10px] text-slate-400">MACD / Hist</div>
          <div className="font-mono text-xs text-white">{fmtI(ig.macd)} / {fmtI(ig.histogram)}</div>
        </div>
      </div>

      <div className="card-glass rounded-xl p-4">
        <strong className="text-xs text-white">💡 Cara baca gabungan:</strong>
        <span className="text-xs text-slate-400">
          {' '}Bullish paling kuat = Harga {'>'} MA20 {'>'} MA50, EMA20 {'>'} EMA50 (Golden Cross), MACD {'>'} Signal {'>'} 0, Histogram positif membesar.
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Coin Scoring (single coin breakdown)
// ─────────────────────────────────────────────────────────────────────────────
export function AIScorePanel({ coin }: { coin: CoinAnalysis }) {
  const color = scoreColor(coin.aiScore)
  const rec = useMemo(() => {
    if (coin.aiScore >= 80) return { icon: '🚀', color: '#4ade80', text: 'Sangat Bullish — Setup bagus untuk entry' }
    if (coin.aiScore >= 65) return { icon: '📈', color: '#86efac', text: 'Bullish — Momentum positif, perhatikan volume' }
    if (coin.aiScore >= 50) return { icon: '🔵', color: '#94a3b8', text: 'Netral — Tunggu sinyal lebih kuat' }
    if (coin.aiScore >= 35) return { icon: '📉', color: '#fca5a5', text: 'Bearish lemah — Hati-hati, risk meningkat' }
    return { icon: '⚠️', color: '#f87171', text: 'Sangat Bearish — Hindari atau short only' }
  }, [coin.aiScore])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card-glass rounded-xl p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{coin.image ? <img src={coin.image} alt="" width={40} height={40} className="rounded-full" /> : '🪙'}</div>
          <div>
            <div className="font-bold text-white">{coin.name} <span className="text-slate-400 text-xs">{coin.symbol}</span></div>
            <div className="text-sm text-slate-300">{formatPrice(coin.current_price)}</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${coin.aiScore} ${100 - coin.aiScore}`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold" style={{ color }}>{coin.aiScore}</span>
              <span className="text-[8px] text-slate-500">/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="card-glass rounded-xl p-3" style={{ borderLeft: `3px solid ${rec.color}` }}>
        <span className="text-sm">{rec.icon} <strong style={{ color: rec.color }}>{rec.text}</strong></span>
      </div>

      {/* Factor breakdown */}
      <div className="card-glass rounded-xl p-4">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">Breakdown 7 Faktor</div>
        <div className="space-y-3">
          {coin.factors.map((f, i) => {
            const pct = Math.min(100, (Math.abs(f.value) / f.max) * 100)
            const barColor = f.value >= 0 ? '#4ade80' : '#f87171'
            return (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">{f.label}</span>
                  <span className="text-slate-400">{f.desc}</span>
                  <span className="font-semibold" style={{ color: f.value >= 0 ? '#4ade80' : '#f87171' }}>
                    {f.value >= 0 ? '+' : ''}{f.value}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="card-glass rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-slate-400">
          Futures: <strong style={{ color: coin.aiScore >= 50 ? '#4ade80' : '#f87171' }}>{coin.futuresDir} {coin.leverage}×</strong>
        </span>
        <span className="text-xs text-slate-400">
          RSI: <strong style={{ color: coin.rsi < 30 ? '#4ade80' : coin.rsi > 70 ? '#f87171' : '#94a3b8' }}>{coin.rsi}</strong>
        </span>
        <span className="text-xs text-slate-400">
          MCap: <strong className="text-white">{formatUsd(coin.market_cap)}</strong> (#{coin.market_cap_rank})
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Coin Scoring & Rankings grid
// ─────────────────────────────────────────────────────────────────────────────
const RANK_FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'excellent', label: 'Excellent (80+)' },
  { id: 'good', label: 'Good (65+)' },
  { id: 'best-liquidity', label: 'Likuiditas Terbaik' },
] as const

export function AIRankingsPanel({ coins, onAnalyze }: { coins: CoinAnalysis[]; onAnalyze?: (id: string) => void }) {
  const [filter, setFilter] = useState<typeof RANK_FILTERS[number]['id']>('all')

  const filtered = useMemo(() => {
    if (filter === 'excellent') return coins.filter((c) => c.aiScore >= 80)
    if (filter === 'good') return coins.filter((c) => c.aiScore >= 65)
    if (filter === 'best-liquidity') {
      return [...coins]
        .sort((a, b) => (b.total_volume / (b.market_cap || 1)) - (a.total_volume / (a.market_cap || 1)))
        .slice(0, 30)
    }
    return coins
  }, [coins, filter])

  const stars = (score: number) => '⭐'.repeat(Math.max(1, Math.floor(score / 20)))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 flex-wrap">
        {RANK_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              filter === f.id
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.06)] text-slate-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">{filtered.length} koin</span>
      </div>

      {filtered.length === 0 ? (
        <div className="card-glass rounded-xl p-10 text-center text-slate-400">
          Tidak ada koin yang memenuhi filter ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((coin, index) => {
            const color = scoreColor(coin.aiScore)
            return (
              <div
                key={coin.id}
                className="card-glass rounded-xl p-4 flex flex-col border border-[rgba(255,255,255,0.06)] hover:border-indigo-500/40 transition-colors cursor-pointer"
                onClick={() => onAnalyze?.(coin.id)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                  {coin.image ? <img src={coin.image} alt="" width={24} height={24} className="rounded-full" /> : <span>🪙</span>}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-white truncate">{coin.name}</div>
                    <div className="text-[10px] text-slate-500">{coin.symbol}</div>
                  </div>
                </div>

                <div className="flex items-end justify-between mb-1">
                  <span className="text-2xl font-bold" style={{ color }}>{coin.aiScore}</span>
                  <span className="text-[10px] text-slate-500">/100</span>
                </div>
                <div className="text-xs mb-2">{stars(coin.aiScore)}</div>
                <div className="text-xs text-slate-300 mb-1">{formatPrice(coin.current_price)}</div>
                <div className="text-[10px] text-slate-500 mb-3">
                  RSI {coin.rsi} &nbsp;|&nbsp; {coin.futuresDir} {coin.leverage}×
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onAnalyze?.(coin.id) }}
                  className="mt-auto w-full px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(0,240,255,0.10)] text-[#00f0ff] border border-[rgba(0,240,255,0.22)] hover:bg-[rgba(0,240,255,0.18)] transition-colors"
                >
                  🔍 Analyze
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
