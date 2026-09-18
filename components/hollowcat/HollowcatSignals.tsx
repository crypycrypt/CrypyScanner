'use client';

import React from 'react';

interface Props {
  analysis: any;
}

export default function HollowcatSignals({ analysis }: Props) {
   const d = analysis?.dashboard;
   const rsiDiv = analysis?.rsiDivergence;
   if (!d) return null;

  return (
    <div className="space-y-6">
      {/* Signal Overview */}
      <div className="card-glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-300">🎯 Signal Overview</h3>
          <span className={`text-lg font-bold ${
            d.entry.signal === 'LONG' ? 'text-green-400' :
            d.entry.signal === 'SHORT' ? 'text-red-400' :
            d.entry.signal === 'WAIT' ? 'text-yellow-400' :
            'text-slate-400'
          }`}>
            {d.entry.signal}
          </span>
        </div>

        {/* Probability Bars */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-green-400 font-semibold">LONG</span>
              <span className="font-mono">{d.probability.longProbability}%</span>
            </div>
            <div className="h-3 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-500"
                style={{ width: `${d.probability.longProbability}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-red-400 font-semibold">SHORT</span>
              <span className="font-mono">{d.probability.shortProbability}%</span>
            </div>
            <div className="h-3 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500"
                style={{ width: `${d.probability.shortProbability}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400">Confidence</div>
            <div className="text-xl font-bold text-white">{d.probability.confidenceScore}%</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400">Expected RR</div>
            <div className="text-xl font-bold text-white">{d.risk.expectedRR.toFixed(2)}</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400">Rating</div>
            <div className="text-xl font-bold" style={{
              color: d.quality.rating === 'A+' ? '#4ade80' :
                     d.quality.rating === 'A' ? '#22c55e' :
                     d.quality.rating === 'B' ? '#fbbf24' :
                     d.quality.rating === 'C' ? '#f97316' :
                     d.quality.rating === 'D' ? '#ef4444' : '#64748b'
            }}>
              {d.quality.rating}
            </div>
          </div>
        </div>
      </div>

      {/* Probability Scores */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-3">📊 Probability Scores</h3>
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Trend', value: d.probability.scores.trend, weight: '20%', color: '#60a5fa' },
            { label: 'Volume', value: d.probability.scores.volume, weight: '15%', color: '#4ade80' },
            { label: 'Liquidity', value: d.probability.scores.liquidity, weight: '15%', color: '#fbbf24' },
            { label: 'Structure', value: d.probability.scores.structure, weight: '15%', color: '#a78bfa' },
            { label: 'Regression', value: d.probability.scores.regression, weight: '10%', color: '#06b6d4' },
            { label: 'FVG', value: d.probability.scores.fvg, weight: '10%', color: '#f472b6' },
            { label: 'Order Block', value: d.probability.scores.orderBlock, weight: '10%', color: '#fb923c' },
            { label: 'Momentum', value: d.probability.scores.momentum, weight: '5%', color: '#34d399' },
            { label: 'ATR', value: d.probability.scores.atr, weight: '5%', color: '#818cf8' },
            { label: 'VWAP', value: d.probability.scores.vwap, weight: '5%', color: '#c084fc' },
          ].map((score) => (
            <div key={score.label} className="text-center">
              <div className="text-xs text-slate-400 mb-1">{score.label}</div>
              <div className="text-xs text-slate-500 mb-2">{score.weight}</div>
              <div className="relative w-12 h-12 mx-auto">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18" cy="18" r="15.5"
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18" cy="18" r="15.5"
                    fill="none"
                    stroke={score.color}
                    strokeWidth="3"
                    strokeDasharray={`${score.value} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                  {score.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RSI Divergence Panel */}
       <div className="card-glass rounded-xl p-5">
         <h3 className="text-sm font-bold text-slate-300 mb-3">📊 RSI Momentum Divergence</h3>
         <div className="grid grid-cols-3 gap-3">
           <div className="text-center">
             <div className="text-xs text-slate-400 mb-1">RSI Value</div>
             <div className="text-lg font-bold font-mono" style={{ color: rsiDiv?.rsiLine > 70 ? '#f87171' : rsiDiv?.rsiLine < 30 ? '#4ade80' : '#e2e8f0' }}>
               {rsiDiv?.rsiLine.toFixed(1) || '—'}
             </div>
           </div>
           <div className="text-center">
             <div className="text-xs text-slate-400 mb-1">Bullish Divergences</div>
             <div className="text-lg font-bold text-green-400">{rsiDiv?.bullishDivergences.length || 0}</div>
           </div>
           <div className="text-center">
             <div className="text-xs text-slate-400 mb-1">Bearish Divergences</div>
             <div className="text-lg font-bold text-red-400">{rsiDiv?.bearishDivergences.length || 0}</div>
           </div>
         </div>
         {rsiDiv?.explanation && (
           <div className="mt-3 text-xs text-slate-400">{rsiDiv.explanation}</div>
         )}
       </div>

       {/* Entry Reasons */}
       <div className="card-glass rounded-xl p-5">
         <h3 className="text-sm font-bold text-slate-300 mb-3">📝 Signal Reasons</h3>
         <div className="space-y-2">
           {d.entry.reasons.map((reason: string, i: number) => (
             <div key={i} className="flex items-start gap-2 text-xs">
               <span className={`mt-0.5 ${reason.startsWith('✓') ? 'text-green-400' : reason.startsWith('⏳') ? 'text-yellow-400' : reason.startsWith('🚫') ? 'text-red-400' : 'text-slate-400'}`}>
                 {reason.startsWith('✓') ? '✓' : reason.startsWith('⏳') ? '⏳' : reason.startsWith('🚫') ? '🚫' : '•'}
               </span>
               <span className="text-slate-300">{reason.replace(/^[✓⏳🚫•]\s*/, '')}</span>
             </div>
           ))}
         </div>
       </div>

       {/* Full Explanation */}
       <div className="card-glass rounded-xl p-5">
         <h3 className="text-sm font-bold text-slate-300 mb-3">📋 Full Explanation</h3>
         <div className="text-xs text-slate-400 space-y-2">
           <p><span className="text-indigo-400 font-semibold">Trend:</span> {d.trend.explanation}</p>
           <p><span className="text-indigo-400 font-semibold">Structure:</span> {d.marketStructure.explanation}</p>
           <p><span className="text-indigo-400 font-semibold">FVG:</span> {d.fvg.explanation}</p>
           <p><span className="text-indigo-400 font-semibold">Probability:</span> {d.probability.explanation}</p>
           <p><span className="text-indigo-400 font-semibold">Risk:</span> {d.risk.explanation}</p>
           <p><span className="text-indigo-400 font-semibold">Quality:</span> {d.quality.explanation}</p>
           <p><span className="text-indigo-400 font-semibold">Entry:</span> {d.entry.explanation}</p>
           <p><span className="text-indigo-400 font-semibold">RSI Divergence:</span> {rsiDiv?.explanation || 'No divergence detected'}</p>
           <p><span className="text-red-400 font-semibold">Manipulation:</span> {d.manipulation?.explanation || 'No manipulation detected'}</p>
         </div>
       </div>
    </div>
  );
}
