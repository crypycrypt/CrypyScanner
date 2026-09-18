'use client';

import React from 'react';

interface Props {
  analysis: any;
}

export default function HollowcatDashboard({ analysis }: Props) {
   const d = analysis?.dashboard;
   const rsiDiv = analysis?.rsiDivergence;
   const isLoading = !analysis;

   if (isLoading) {
     return (
       <div className="card-glass rounded-xl p-8 text-center">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
         <p className="text-slate-400">Loading Hollowcat analysis...</p>
       </div>
     );
   }

   if (!d) {
     return (
       <div className="card-glass rounded-xl p-8 text-center">
         <p className="text-slate-400">No dashboard data available. Try refreshing.</p>
       </div>
     );
   }

   return (
     <div className="space-y-6">
       {/* KPI Row */}
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
         <StatCard
           label="LONG Probability"
           value={`${d.probability.longProbability}%`}
           color={d.probability.longProbability > 60 ? '#4ade80' : d.probability.longProbability > 40 ? '#fbbf24' : '#f87171'}
           sub={d.probability.scores.trend > 50 ? 'Trend aligned' : 'Trend weak'}
         />
         <StatCard
           label="SHORT Probability"
           value={`${d.probability.shortProbability}%`}
           color={d.probability.shortProbability > 60 ? '#f87171' : d.probability.shortProbability > 40 ? '#fbbf24' : '#4ade80'}
           sub={d.probability.scores.trend > 50 ? 'Trend aligned' : 'Trend weak'}
         />
         <StatCard
           label="Confidence"
           value={`${d.probability.confidenceScore}%`}
           color={d.probability.confidenceScore > 70 ? '#4ade80' : d.probability.confidenceScore > 40 ? '#fbbf24' : '#f87171'}
           sub={`Rating: ${d.quality.rating}`}
         />
         <StatCard
           label="Expected RR"
           value={d.risk.expectedRR.toFixed(2)}
           color={d.risk.expectedRR >= 2 ? '#4ade80' : d.risk.expectedRR >= 1 ? '#fbbf24' : '#f87171'}
           sub={`Risk: ${d.risk.riskPercent}%`}
         />
         <StatCard
           label="Manipulation Score"
           value={`${d.manipulation?.manipulationScore || 0}/100`}
           color={(d.manipulation?.manipulationScore || 0) > 60 ? '#ef4444' : (d.manipulation?.manipulationScore || 0) > 40 ? '#fbbf24' : '#4ade80'}
           sub={d.manipulation?.isManipulated ? 'HIGH RISK' : 'Clean signal'}
         />
       </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Panel */}
        <div className="card-glass rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-3">📈 Trend Analysis</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Direction</span><span className="font-semibold" style={{ color: d.trend.direction.includes('BULLISH') ? '#4ade80' : d.trend.direction.includes('BEARISH') ? '#f87171' : '#fbbf24' }}>{d.trend.direction}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Strength</span><span className="font-semibold">{d.trend.strength}/100</span></div>
            <div className="flex justify-between"><span className="text-slate-400">EMA200</span><span className="font-mono">{d.trend.ema200.toFixed(4)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Kalman Slope</span><span className="font-mono">{d.trend.kalmanSlope.toFixed(6)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">ATR</span><span className="font-mono">{d.trend.atr.toFixed(4)}</span></div>
            <div className="mt-2 p-2 rounded bg-[rgba(255,255,255,0.03)] text-slate-400">{d.trend.explanation}</div>
          </div>
        </div>

        {/* Market Structure Panel */}
        <div className="card-glass rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-3">🏗️ Market Structure</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Structure</span><span className="font-semibold">{d.marketStructure.currentStructure}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">BOS Events</span><span className="font-semibold">{d.marketStructure.bosEvents.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">CHoCH Events</span><span className="font-semibold">{d.marketStructure.chochEvents.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Swing Highs</span><span className="font-semibold">{d.marketStructure.swings.highs.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Swing Lows</span><span className="font-semibold">{d.marketStructure.swings.lows.length}</span></div>
            <div className="mt-2 p-2 rounded bg-[rgba(255,255,255,0.03)] text-slate-400">{d.marketStructure.explanation}</div>
          </div>
        </div>

        {/* FVG Panel */}
        <div className="card-glass rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-3">📐 Fair Value Gaps</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Total FVGs</span><span className="font-semibold">{d.fvg.zones.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Fresh Bullish</span><span className="font-semibold text-green-400">{d.fvg.freshBullish.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Fresh Bearish</span><span className="font-semibold text-red-400">{d.fvg.freshBearish.length}</span></div>
            <div className="mt-2 p-2 rounded bg-[rgba(255,255,255,0.03)] text-slate-400">{d.fvg.explanation}</div>
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liquidity Panel */}
        <div className="card-glass rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-3">💧 Liquidity</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Total Levels</span><span className="font-semibold">{d.liquidity.levels.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Buy Side</span><span className="font-semibold text-green-400">{d.liquidity.buySideLiquidity.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Sell Side</span><span className="font-semibold text-red-400">{d.liquidity.sellSideLiquidity.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Sweeps</span><span className="font-semibold text-yellow-400">{d.liquidity.sweeps.length}</span></div>
            <div className="mt-2 p-2 rounded bg-[rgba(255,255,255,0.03)] text-slate-400">{d.liquidity.explanation}</div>
          </div>
        </div>

        {/* Volume Panel */}
        <div className="card-glass rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-3">📊 Volume</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Spike</span><span className={`font-semibold ${d.volume.spike ? 'text-green-400' : 'text-slate-400'}`}>{d.volume.spike ? 'YES' : 'NO'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Relative Vol</span><span className="font-semibold">{d.volume.relativeVolume.toFixed(2)}x</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Strength</span><span className="font-semibold">{d.volume.volumeStrength}/100</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Confirmation</span><span className={`font-semibold ${d.volume.confirmation ? 'text-green-400' : 'text-red-400'}`}>{d.volume.confirmation ? 'YES' : 'NO'}</span></div>
            <div className="mt-2 p-2 rounded bg-[rgba(255,255,255,0.03)] text-slate-400">{d.volume.explanation}</div>
          </div>
        </div>

        {/* Regression Panel */}
        <div className="card-glass rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-3">📉 Regression</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Direction</span><span className="font-semibold">{d.regression.projectedDirection}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Slope</span><span className="font-mono">{d.regression.slope.toFixed(6)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">R²</span><span className="font-mono">{d.regression.r2.toFixed(3)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Channel Width</span><span className="font-mono">{d.regression.width.toFixed(4)}</span></div>
            <div className="mt-2 p-2 rounded bg-[rgba(255,255,255,0.03)] text-slate-400">{d.regression.explanation}</div>
          </div>
        </div>
      </div>

      {/* Market Regime & Candle Color */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         <div className="card-glass rounded-xl p-4 flex items-center justify-between">
           <div>
             <span className="text-xs text-slate-400">Market Regime</span>
             <div className="text-lg font-bold text-white mt-1">{d.marketRegime}</div>
           </div>
           <div className={`w-3 h-3 rounded-full ${d.marketRegime === 'TRENDING' ? 'bg-green-400' : d.marketRegime === 'SIDEWAYS' ? 'bg-yellow-400' : d.marketRegime === 'EXPANSION' ? 'bg-blue-400' : d.marketRegime === 'COMPRESSION' ? 'bg-purple-400' : d.marketRegime === 'ACCUMULATION' ? 'bg-cyan-400' : 'bg-red-400'}`} />
         </div>
         <div className="card-glass rounded-xl p-4 flex items-center justify-between">
           <div>
             <span className="text-xs text-slate-400">Candle Color</span>
             <div className="text-lg font-bold text-white mt-1">{d.candleColor.replace('_', ' ')}</div>
           </div>
           <div className={`w-6 h-6 rounded-full ${d.candleColor === 'DARK_GREEN' ? 'bg-green-600' : d.candleColor === 'LIGHT_GREEN' ? 'bg-green-400' : d.candleColor === 'GRAY' ? 'bg-gray-500' : d.candleColor === 'ORANGE' ? 'bg-orange-500' : 'bg-red-600'}`} />
         </div>
       </div>

       {/* RSI Momentum Divergence Panel */}
       <div className="card-glass rounded-xl p-5">
         <h3 className="text-sm font-bold text-slate-300 mb-3">📊 RSI Momentum Divergence</h3>
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           <div>
             <div className="text-xs text-slate-400 mb-1">RSI Value</div>
             <div className="text-lg font-bold font-mono" style={{ color: rsiDiv?.rsiLine > 70 ? '#f87171' : rsiDiv?.rsiLine < 30 ? '#4ade80' : '#e2e8f0' }}>
               {rsiDiv?.rsiLine.toFixed(1) || '—'}
             </div>
           </div>
           <div>
             <div className="text-xs text-slate-400 mb-1">Bullish Divergences</div>
             <div className="text-lg font-bold text-green-400">{rsiDiv?.bullishDivergences.length || 0}</div>
           </div>
           <div>
             <div className="text-xs text-slate-400 mb-1">Bearish Divergences</div>
             <div className="text-lg font-bold text-red-400">{rsiDiv?.bearishDivergences.length || 0}</div>
           </div>
           <div>
             <div className="text-xs text-slate-400 mb-1">RSI Explanation</div>
             <div className="text-xs text-slate-400 mt-1">{rsiDiv?.explanation || '—'}</div>
           </div>
         </div>
         {rsiDiv?.bullishDivergences.length > 0 && (
           <div className="mt-3 pt-3 border-t border-slate-700/50">
             <div className="text-xs text-green-400 font-semibold mb-1">Bullish Divergences (Price LL + RSI HL → Potential Long)</div>
             <div className="flex flex-wrap gap-2">
               {rsiDiv.bullishDivergences.map((div: any, i: number) => (
                 <span key={i} className="text-[10px] px-2 py-1 rounded bg-green-900/30 text-green-300 font-mono">
                   #{div.index} strength:{div.strength.toFixed(1)}
                 </span>
               ))}
             </div>
           </div>
         )}
         {rsiDiv?.bearishDivergences.length > 0 && (
           <div className="mt-3 pt-3 border-t border-slate-700/50">
             <div className="text-xs text-red-400 font-semibold mb-1">Bearish Divergences (Price HH + RSI LH → Potential Short)</div>
             <div className="flex flex-wrap gap-2">
               {rsiDiv.bearishDivergences.map((div: any, i: number) => (
                 <span key={i} className="text-[10px] px-2 py-1 rounded bg-red-900/30 text-red-300 font-mono">
                   #{div.index} strength:{div.strength.toFixed(1)}
                 </span>
               ))}
             </div>
           </div>
         )}
       </div>

      {/* Explanation */}
      <div className="card-glass rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-300 mb-2">📋 Full Analysis</h3>
        <div className="text-xs text-slate-400 space-y-1">
          <p><span className="text-indigo-400 font-semibold">Trend:</span> {d.trend.explanation}</p>
          <p><span className="text-indigo-400 font-semibold">Structure:</span> {d.marketStructure.explanation}</p>
          <p><span className="text-indigo-400 font-semibold">FVG:</span> {d.fvg.explanation}</p>
          <p><span className="text-indigo-400 font-semibold">Probability:</span> {d.probability.explanation}</p>
          <p><span className="text-indigo-400 font-semibold">Risk:</span> {d.risk.explanation}</p>
          <p><span className="text-indigo-400 font-semibold">Quality:</span> {d.quality.explanation}</p>
          <p><span className="text-red-400 font-semibold">Manipulation:</span> {d.manipulation?.explanation || 'No manipulation detected'}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: string; color: string; sub: string }) {
  return (
    <div className="card-glass rounded-xl p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}
