'use client';

import React from 'react';

interface Props {
  analysis: any;
}

export default function HollowcatTradeQuality({ analysis }: Props) {
  const d = analysis?.dashboard;
  if (!d) return null;

  const ratingColors: Record<string, string> = {
    'A+': '#4ade80',
    'A': '#22c55e',
    'B': '#fbbf24',
    'C': '#f97316',
    'D': '#ef4444',
    'AVOID': '#64748b',
  };

  const ratingDescriptions: Record<string, string> = {
    'A+': 'Exceptional setup - highest conviction',
    'A': 'Strong setup - high confidence',
    'B': 'Good setup - moderate confidence',
    'C': 'Average setup - consider waiting',
    'D': 'Below average - high risk or low reward',
    'AVOID': 'Avoid trade - insufficient quality',
  };

  return (
    <div className="space-y-6">
      {/* Rating Display */}
      <div className="card-glass rounded-xl p-8 text-center">
        <div className="text-sm text-slate-400 mb-2">Trade Quality Rating</div>
        <div
          className="text-6xl font-bold mb-2"
          style={{ color: ratingColors[d.quality.rating] }}
        >
          {d.quality.rating}
        </div>
        <div className="text-sm text-slate-300 mb-4">{ratingDescriptions[d.quality.rating]}</div>

        {/* Score Bar */}
        <div className="w-full max-w-md mx-auto">
          <div className="h-4 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${d.quality.score}%`,
                backgroundColor: ratingColors[d.quality.rating],
              }}
            />
          </div>
          <div className="text-xs text-slate-500 mt-1">Score: {d.quality.score}/100</div>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-4">Factor Breakdown</h3>
        <div className="space-y-3">
          {Object.entries(d.quality.factors)
            .sort((a: any, b: any) => b[1] - a[1])
            .map(([factor, value]: any) => (
              <div key={factor} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-32 capitalize">{factor}</span>
                <div className="flex-1 h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${value}%`,
                      backgroundColor: value >= 70 ? '#4ade80' : value >= 40 ? '#fbbf24' : '#f87171',
                    }}
                  />
                </div>
                <span className="text-xs font-mono w-8 text-right">{value}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Quality Explanation */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-3">📋 Quality Assessment</h3>
        <div className="text-xs text-slate-400 space-y-2">
          <p>{d.quality.explanation}</p>
          <p className="mt-2"><span className="text-indigo-400 font-semibold">Probability Confidence:</span> {d.probability.confidenceScore}%</p>
          <p><span className="text-indigo-400 font-semibold">Expected RR:</span> {d.risk.expectedRR.toFixed(2)}</p>
          <p><span className="text-indigo-400 font-semibold">Risk %:</span> {d.risk.riskPercent.toFixed(2)}%</p>
          <p><span className="text-indigo-400 font-semibold">Trend Strength:</span> {d.trend.strength}/100</p>
          <p><span className="text-indigo-400 font-semibold">Volume Confirmation:</span> {d.volume.confirmation ? 'YES' : 'NO'}</p>
          <p><span className="text-red-400 font-semibold">Manipulation Score:</span> {d.manipulation?.manipulationScore || 0}/100</p>
          {d.manipulation?.signals && d.manipulation.signals.length > 0 && (
            <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
              <div className="text-red-400 font-semibold mb-1">Manipulation Warnings:</div>
              {d.manipulation.signals.map((signal: any, i: number) => (
                <div key={i} className="text-red-300">• {signal.type.replace(/_/g, ' ')}: {signal.riskScore}/100</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rating Scale */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-3">Rating Scale</h3>
        <div className="space-y-2 text-xs">
          {[
            { rating: 'A+', desc: 'Exceptional - all factors aligned', color: '#4ade80' },
            { rating: 'A', desc: 'Strong - high confidence setup', color: '#22c55e' },
            { rating: 'B', desc: 'Good - moderate confidence', color: '#fbbf24' },
            { rating: 'C', desc: 'Average - consider waiting', color: '#f97316' },
            { rating: 'D', desc: 'Below average - high risk', color: '#ef4444' },
            { rating: 'AVOID', desc: 'Avoid - insufficient quality', color: '#64748b' },
          ].map(({ rating, desc, color }) => (
            <div key={rating} className="flex items-center gap-3 p-2 rounded bg-[rgba(255,255,255,0.02)]">
              <span className="font-bold w-10" style={{ color }}>{rating}</span>
              <span className="text-slate-400">{desc}</span>
              {d.quality.rating === rating && <span className="ml-auto text-green-400">● Current</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
