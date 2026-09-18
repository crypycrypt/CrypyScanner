'use client';

import React from 'react';

interface Props {
  analysis: any;
}

export default function HollowcatBacktest({ analysis }: Props) {
  const bt = analysis?.backtest;
  const d = analysis?.dashboard;

  if (!bt) {
    return (
      <div className="card-glass rounded-xl p-8 text-center">
        <div className="text-4xl mb-4">📉</div>
        <h3 className="text-lg font-bold text-slate-300 mb-2">No Backtest Data</h3>
        <p className="text-sm text-slate-400">Run analysis with backtest enabled to see results</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Win Rate" value={`${bt.winRate}%`} color={bt.winRate > 55 ? '#4ade80' : bt.winRate > 40 ? '#fbbf24' : '#f87171'} />
        <MetricCard label="Profit Factor" value={bt.profitFactor.toFixed(2)} color={bt.profitFactor > 1.5 ? '#4ade80' : bt.profitFactor > 1 ? '#fbbf24' : '#f87171'} />
        <MetricCard label="Total PnL" value={`$${bt.totalPnL.toFixed(2)}`} color={bt.totalPnL >= 0 ? '#4ade80' : '#f87171'} />
        <MetricCard label="Total Trades" value={bt.totalTrades.toString()} color="#60a5fa" />
      </div>

      {/* Detailed Metrics */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400">Expectancy</div>
            <div className="text-lg font-bold font-mono text-white">{bt.expectancy.toFixed(4)}</div>
          </div>
          <div className="p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400">Sharpe Ratio</div>
            <div className="text-lg font-bold font-mono text-white">{bt.sharpeRatio.toFixed(2)}</div>
          </div>
          <div className="p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400">Sortino Ratio</div>
            <div className="text-lg font-bold font-mono text-white">{bt.sortinoRatio.toFixed(2)}</div>
          </div>
          <div className="p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400">Max Drawdown</div>
            <div className="text-lg font-bold font-mono text-red-400">{bt.maxDrawdown.toFixed(4)}</div>
          </div>
          <div className="p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400">Recovery Factor</div>
            <div className="text-lg font-bold font-mono text-white">{bt.recoveryFactor.toFixed(2)}</div>
          </div>
          <div className="p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400">Winning Trades</div>
            <div className="text-lg font-bold font-mono text-green-400">{bt.winningTrades}</div>
          </div>
          <div className="p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400">Losing Trades</div>
            <div className="text-lg font-bold font-mono text-red-400">{bt.losingTrades}</div>
          </div>
          <div className="p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
            <div className="text-xs text-slate-400">Avg Win / Avg Loss</div>
            <div className="text-lg font-bold font-mono text-white">{bt.avgWin.toFixed(4)} / {bt.avgLoss.toFixed(4)}</div>
          </div>
        </div>
      </div>

      {/* Trade History */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-4">📜 Trade History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[rgba(148,163,184,0.1)] text-slate-400">
                <th className="px-3 py-2 text-left">Entry</th>
                <th className="px-3 py-2 text-left">Exit</th>
                <th className="px-3 py-2 text-left">Dir</th>
                <th className="px-3 py-2 text-right">Entry</th>
                <th className="px-3 py-2 text-right">Exit</th>
                <th className="px-3 py-2 text-right">PnL</th>
                <th className="px-3 py-2 text-right">RR</th>
                <th className="px-3 py-2 text-center">Rating</th>
                <th className="px-3 py-2 text-center">Manip</th>
              </tr>
            </thead>
            <tbody>
              {bt.trades.slice(-20).map((trade: any, i: number) => (
                <tr key={i} className="border-b border-[rgba(148,163,184,0.05)]">
                  <td className="px-3 py-2 text-slate-400">{trade.entryTime}</td>
                  <td className="px-3 py-2 text-slate-400">{trade.exitTime}</td>
                  <td className={`px-3 py-2 font-semibold ${trade.direction === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.direction}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{trade.entryPrice.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right font-mono">{trade.exitPrice.toFixed(4)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(4)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{trade.rr.toFixed(2)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      trade.rating === 'A+' || trade.rating === 'A' ? 'bg-green-500/20 text-green-400' :
                      trade.rating === 'B' ? 'bg-yellow-500/20 text-yellow-400' :
                      trade.rating === 'C' ? 'bg-orange-500/20 text-orange-400' :
                      trade.rating === 'D' ? 'bg-red-500/20 text-red-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {trade.rating}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      (trade.manipulationScore || 0) > 60 ? 'bg-red-500/20 text-red-400' :
                      (trade.manipulationScore || 0) > 40 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {trade.manipulationScore || 0}/100
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanation */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-2">📋 Backtest Explanation</h3>
        <div className="text-xs text-slate-400">{bt.explanation}</div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-lg font-bold font-mono" style={{ color }}>{value}</div>
    </div>
  );
}
