'use client';

import React from 'react';

interface Props {
  analysis: any;
}

export default function HollowcatEntryEngine({ analysis }: Props) {
   const d = analysis?.dashboard;
   const rsiDiv = analysis?.rsiDivergence;
   if (!d) return null;

   const entry = d.entry;

  return (
    <div className="space-y-6">
      {/* Signal Banner */}
      <div className={`card-glass rounded-xl p-6 border-l-4 ${
        entry.signal === 'LONG' ? 'border-green-500' :
        entry.signal === 'SHORT' ? 'border-red-500' :
        entry.signal === 'WAIT' ? 'border-yellow-500' :
        'border-slate-500'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 mb-1">Entry Signal</div>
            <div className={`text-3xl font-bold ${
              entry.signal === 'LONG' ? 'text-green-400' :
              entry.signal === 'SHORT' ? 'text-red-400' :
              entry.signal === 'WAIT' ? 'text-yellow-400' :
              'text-slate-400'
            }`}>
              {entry.signal === 'LONG' ? '🟢 LONG' :
               entry.signal === 'SHORT' ? '🔴 SHORT' :
               entry.signal === 'WAIT' ? '⏳ WAIT' : '🚫 NO TRADE'}
            </div>
            {entry.manipulation?.manipulationScore > 30 && (
              <div className={`text-xs mt-1 ${entry.manipulation.manipulationScore > 60 ? 'text-red-400' : 'text-yellow-400'}`}>
                ⚠️ Manipulation Risk: {entry.manipulation.manipulationScore}/100
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Confidence</div>
            <div className="text-2xl font-bold text-white">{entry.probability.confidenceScore}%</div>
          </div>
        </div>
      </div>

      {/* Entry Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entry Parameters */}
        <div className="card-glass rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-4">🚀 Entry Parameters</h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Entry Price</span>
              <span className="font-mono font-semibold">{entry.entryPrice.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Stop Loss</span>
              <span className="font-mono text-red-400">{entry.risk.stopLoss.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">TP1</span>
              <span className="font-mono text-green-400">{entry.risk.tp1.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">TP2</span>
              <span className="font-mono text-green-400">{entry.risk.tp2.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">TP3</span>
              <span className="font-mono text-green-400">{entry.risk.tp3.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Expected RR</span>
              <span className="font-mono font-semibold">{entry.risk.expectedRR.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Risk %</span>
              <span className="font-mono">{entry.risk.riskPercent.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Position Size</span>
              <span className="font-mono">{entry.risk.positionSize.toFixed(2)} units</span>
            </div>
          </div>
        </div>

        {/* Trade Quality */}
        <div className="card-glass rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-4">⭐ Trade Quality</h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Rating</span>
              <span className="text-xl font-bold" style={{ color: entry.quality.rating === 'A+' ? '#4ade80' : entry.quality.rating === 'A' ? '#22c55e' : entry.quality.rating === 'B' ? '#fbbf24' : entry.quality.rating === 'C' ? '#f97316' : entry.quality.rating === 'D' ? '#ef4444' : '#64748b' }}>
                {entry.quality.rating}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Score</span>
              <span className="font-mono">{entry.quality.score}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">LONG Prob</span>
              <span className="font-mono">{entry.probability.longProbability}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">SHORT Prob</span>
              <span className="font-mono">{entry.probability.shortProbability}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Trend</span>
              <span className="font-mono">{d.trend.direction}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Regime</span>
              <span className="font-mono">{d.marketRegime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">RSI</span>
              <span className="font-mono" style={{ color: rsiDiv?.rsiLine > 70 ? '#f87171' : rsiDiv?.rsiLine < 30 ? '#4ade80' : '#e2e8f0' }}>
                {rsiDiv?.rsiLine.toFixed(1) || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Bullish Divergences</span>
              <span className="font-mono text-green-400">{rsiDiv?.bullishDivergences.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Bearish Divergences</span>
              <span className="font-mono text-red-400">{rsiDiv?.bearishDivergences.length || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* RSI Divergence Alert */}
      {(rsiDiv?.bullishDivergences.length > 0 || rsiDiv?.bearishDivergences.length > 0) && (
        <div className="card-glass rounded-xl p-5 border-l-4 border-indigo-500">
          <h3 className="text-sm font-bold text-slate-300 mb-3">📊 RSI Momentum Divergence Alert</h3>
          <div className="space-y-2 text-xs">
            {rsiDiv.bullishDivergences.map((div: any, i: number) => (
              <div key={`bull-${i}`} className="flex items-start gap-2 text-green-300">
                <span className="mt-0.5">📈</span>
                <span>Bullish divergence at candle #{div.index} — Price made lower low while RSI made higher low (strength: {div.strength.toFixed(1)}). Suggests potential LONG entry.</span>
              </div>
            ))}
            {rsiDiv.bearishDivergences.map((div: any, i: number) => (
              <div key={`bear-${i}`} className="flex items-start gap-2 text-red-300">
                <span className="mt-0.5">📉</span>
                <span>Bearish divergence at candle #{div.index} — Price made higher high while RSI made lower high (strength: {div.strength.toFixed(1)}). Suggests potential SHORT entry.</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entry Reasons */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-4">📝 Entry Decision Reasons</h3>
        <div className="space-y-2">
          {entry.reasons.map((reason: string, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-[rgba(255,255,255,0.02)]">
              <span className={`mt-0.5 ${reason.startsWith('✓') ? 'text-green-400' : reason.startsWith('⏳') ? 'text-yellow-400' : reason.startsWith('🚫') ? 'text-red-400' : 'text-slate-400'}`}>
                {reason.startsWith('✓') ? '✓' : reason.startsWith('⏳') ? '⏳' : reason.startsWith('🚫') ? '🚫' : '•'}
              </span>
              <span className="text-slate-300">{reason.replace(/^[✓⏳🚫•]\s*/, '')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Entry Explanation */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-3">📋 Entry Engine Explanation</h3>
        <div className="text-xs text-slate-400">{entry.explanation}</div>
      </div>
    </div>
  );
}
