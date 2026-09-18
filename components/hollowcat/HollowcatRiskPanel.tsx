'use client';

import React from 'react';

interface Props {
  analysis: any;
}

export default function HollowcatRiskPanel({ analysis }: Props) {
  const d = analysis?.dashboard;
  if (!d) return null;

  return (
    <div className="space-y-6">
      {/* Risk Levels */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-4">Risk Management</h3>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400 mb-1">Entry</div>
            <div className="text-lg font-bold font-mono text-white">{d.risk.entry.toFixed(4)}</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400 mb-1">Stop Loss</div>
            <div className="text-lg font-bold font-mono text-red-400">{d.risk.stopLoss.toFixed(4)}</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400 mb-1">TP1</div>
            <div className="text-lg font-bold font-mono text-green-400">{d.risk.tp1.toFixed(4)}</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400 mb-1">TP2</div>
            <div className="text-lg font-bold font-mono text-green-400">{d.risk.tp2.toFixed(4)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400 mb-1">TP3</div>
            <div className="text-lg font-bold font-mono text-green-400">{d.risk.tp3.toFixed(4)}</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400 mb-1">Expected RR</div>
            <div className="text-lg font-bold font-mono text-white">{d.risk.expectedRR.toFixed(2)}</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400 mb-1">Risk %</div>
            <div className="text-lg font-bold font-mono text-yellow-400">{d.risk.riskPercent.toFixed(2)}%</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400 mb-1">Position Size</div>
            <div className="text-lg font-bold font-mono text-white">{d.risk.positionSize.toFixed(2)}</div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
          <div className="text-xs text-slate-400">Risk Explanation</div>
          <div className="text-xs text-slate-300 mt-1">{d.risk.explanation}</div>
        </div>
      </div>

      {/* Risk/Reward Visualization */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-3">Risk/Reward Visualization</h3>
        <div className="h-40 bg-[rgba(0,0,0,0.3)] rounded-lg border border-[rgba(148,163,184,0.1)] flex items-end justify-center gap-8 p-4">
          {/* Risk bar */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-red-400 mb-1">Risk</div>
            <div
              className="w-8 bg-red-500/30 border border-red-500 rounded-t"
              style={{ height: `${Math.min(100, d.risk.riskPercent * 10)}px` }}
            />
            <div className="text-xs font-mono text-red-400 mt-1">{d.risk.riskPercent.toFixed(2)}%</div>
          </div>

          {/* TP1 bar */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-green-400 mb-1">TP1</div>
            <div
              className="w-8 bg-green-500/30 border border-green-500 rounded-t"
              style={{ height: `${Math.min(100, d.risk.expectedRR * 15)}px` }}
            />
            <div className="text-xs font-mono text-green-400 mt-1">{d.risk.expectedRR.toFixed(2)}x</div>
          </div>

          {/* TP2 bar */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-green-400 mb-1">TP2</div>
            <div
              className="w-8 bg-green-500/30 border border-green-500 rounded-t"
              style={{ height: `${Math.min(100, d.risk.expectedRR * 30)}px` }}
            />
            <div className="text-xs font-mono text-green-400 mt-1">{(d.risk.expectedRR * 2).toFixed(2)}x</div>
          </div>

          {/* TP3 bar */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-green-400 mb-1">TP3</div>
            <div
              className="w-8 bg-green-500/30 border border-green-500 rounded-t"
              style={{ height: `${Math.min(100, d.risk.expectedRR * 45)}px` }}
            />
            <div className="text-xs font-mono text-green-400 mt-1">{(d.risk.expectedRR * 3).toFixed(2)}x</div>
          </div>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-3">⚠️ Risk Assessment</h3>
        <div className="space-y-3 text-xs">
          {[
            { label: 'Risk/Reward Ratio', value: d.risk.expectedRR, threshold: 2, color: d.risk.expectedRR >= 2 ? '#4ade80' : d.risk.expectedRR >= 1 ? '#fbbf24' : '#f87171' },
            { label: 'Risk Percentage', value: d.risk.riskPercent, threshold: 2, color: d.risk.riskPercent <= 2 ? '#4ade80' : d.risk.riskPercent <= 5 ? '#fbbf24' : '#f87171', invert: true },
            { label: 'Trend Strength', value: d.trend.strength, threshold: 50, color: d.trend.strength >= 50 ? '#4ade80' : '#f87171' },
            { label: 'Volume Confirmation', value: d.volume.confirmation ? 100 : 0, threshold: 50, color: d.volume.confirmation ? '#4ade80' : '#f87171' },
            { label: 'FVG Available', value: d.fvg.freshBullish.length + d.fvg.freshBearish.length > 0 ? 80 : 0, threshold: 50, color: d.fvg.freshBullish.length + d.fvg.freshBearish.length > 0 ? '#4ade80' : '#f87171' },
            { label: 'Manipulation Score', value: d.manipulation?.manipulationScore || 0, threshold: 40, color: (d.manipulation?.manipulationScore || 0) <= 40 ? '#4ade80' : (d.manipulation?.manipulationScore || 0) <= 60 ? '#fbbf24' : '#f87171', invert: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-slate-400">{item.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${item.value}%`, backgroundColor: item.color }}
                  />
                </div>
                <span className="font-mono w-12 text-right" style={{ color: item.color }}>
                  {typeof item.value === 'boolean' ? (item.value ? 'YES' : 'NO') : item.value.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
