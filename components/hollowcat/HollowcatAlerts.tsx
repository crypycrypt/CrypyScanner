'use client';

import React, { useState } from 'react';

interface Props {
  analysis: any;
}

export default function HollowcatAlerts({ analysis }: Props) {
  const d = analysis?.dashboard;
  const alerts = analysis?.alerts || [];
  const [alertConfigs, setAlertConfigs] = useState([
    { channel: 'TRADINGVIEW', enabled: true, webhookUrl: '' },
    { channel: 'WEBHOOK', enabled: false, webhookUrl: '' },
    { channel: 'TELEGRAM', enabled: false, telegramBotId: '' },
    { channel: 'DISCORD', enabled: false, discordWebhook: '' },
  ]);

  const handleToggle = (index: number) => {
    const newConfigs = [...alertConfigs];
    newConfigs[index].enabled = !newConfigs[index].enabled;
    setAlertConfigs(newConfigs);
  };

  return (
  <div className="space-y-6">
    {/* Alert Status */}
    <div className="card-glass rounded-xl p-5">
      <h3 className="text-sm font-bold text-slate-300 mb-4">Alert Status</h3>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
          <div className="text-xs text-slate-400 mb-1">Current Signal</div>
          <div className={`text-lg font-bold ${
            d?.entry.signal === 'LONG' ? 'text-green-400' :
            d?.entry.signal === 'SHORT' ? 'text-red-400' :
            d?.entry.signal === 'WAIT' ? 'text-yellow-400' : 'text-slate-400'
          }`}>
            {d?.entry.signal || 'N/A'}
          </div>
        </div>
        <div className="text-center p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
          <div className="text-xs text-slate-400 mb-1">Confidence</div>
          <div className="text-lg font-bold text-white">{d?.probability.confidenceScore || 0}%</div>
        </div>
      </div>

      {/* Manipulation Warnings */}
      {d?.manipulation?.signals && d.manipulation.signals.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <h4 className="text-xs font-bold text-red-400 mb-2">⚠️ Market Maker Manipulation Warnings</h4>
          <div className="space-y-1">
            {d.manipulation.signals.map((signal: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-red-300">{signal.type.replace(/_/g, ' ')}</span>
                <span className="text-red-400 font-mono">{signal.riskScore}/100</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-red-400">
            Manipulation Score: {d.manipulation.manipulationScore}/100
            {d.manipulation.manipulationScore > 60 && ' - HIGH RISK'}
            {d.manipulation.manipulationScore > 40 && d.manipulation.manipulationScore <= 60 && ' - MODERATE RISK'}
          </div>
        </div>
      )}

        {/* Alert Triggers */}
        <div className="space-y-3">
          {alerts.map((alert: any, i: number) => (
            <div key={i} className={`p-3 rounded-lg border ${
              alert.triggered
                ? 'bg-[rgba(74,222,128,0.05)] border-green-500/20'
                : 'bg-[rgba(255,255,255,0.02)] border-[rgba(148,163,184,0.1)]'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">{alert.channel}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  alert.triggered ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {alert.triggered ? 'TRIGGERED' : 'INACTIVE'}
                </span>
              </div>
              <div className="text-xs text-slate-400">{alert.message}</div>
              <div className="text-xs text-slate-500 mt-1">{alert.explanation}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Configuration */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-4">⚙️ Alert Configuration</h3>

        <div className="space-y-4">
          {alertConfigs.map((config, i) => (
            <div key={config.channel} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(148,163,184,0.1)]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(i)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    config.enabled ? 'bg-indigo-600' : 'bg-slate-600'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    config.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
                <span className="text-sm font-semibold text-white">{config.channel}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`${config.channel} URL/ID`}
                  className="px-3 py-1.5 rounded text-xs bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white w-48"
                  value={config.webhookUrl || config.telegramBotId || config.discordWebhook || ''}
                  onChange={(e) => {
                    const newConfigs = [...alertConfigs];
                    if (config.channel === 'TRADINGVIEW') newConfigs[i].webhookUrl = e.target.value;
                    if (config.channel === 'WEBHOOK') newConfigs[i].webhookUrl = e.target.value;
                    if (config.channel === 'TELEGRAM') newConfigs[i].telegramBotId = e.target.value;
                    if (config.channel === 'DISCORD') newConfigs[i].discordWebhook = e.target.value;
                    setAlertConfigs(newConfigs);
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <button className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors">
          Save Alert Config
        </button>
      </div>

      {/* Alert History */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-300 mb-3">📜 Alert History</h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between p-2 rounded bg-[rgba(255,255,255,0.02)]">
            <span className="text-slate-400">2 min ago</span>
            <span className="text-green-400">LONG signal triggered</span>
            <span className="text-slate-500">91% confidence</span>
          </div>
          <div className="flex justify-between p-2 rounded bg-[rgba(255,255,255,0.02)]">
            <span className="text-slate-400">15 min ago</span>
            <span className="text-yellow-400">WAIT signal</span>
            <span className="text-slate-500">45% confidence</span>
          </div>
          <div className="flex justify-between p-2 rounded bg-[rgba(255,255,255,0.02)]">
            <span className="text-slate-400">1 hour ago</span>
            <span className="text-red-400">SHORT signal triggered</span>
            <span className="text-slate-500">78% confidence</span>
          </div>
        </div>
      </div>
    </div>
  );
}
