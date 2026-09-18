"use client"

import React from 'react';

interface FuturesAnalysisProps {
  coin: any;
  marketChart?: any;
}

// ── Logika pure (getFuturesAnalysis + helper + tipe FuturesResult) DIPINDAH ke
// lib/futuresAnalysis.ts. Alasan: file ini ber-directive "use client" sehingga
// fungsinya tidak bisa diimpor dari API route / modul server. Setelah dipindah,
// lib/sniperTelegramAlert.ts (server) dapat menghitung rekomendasi futures yang
// SAMA PERSIS dengan panel "FUTURES RECOMMENDATION · $SYM/USDT PERP" di halaman
// sniper-scanner — satu sumber rumus, tanpa duplikasi.
// Di-re-export di sini agar import lama (`from './FuturesAnalysis'`) tetap jalan:
// FuturesAnalysisPage.tsx, SniperScanner.tsx, LiveMarketIndicators.tsx.
import { getFuturesAnalysis } from '../../lib/futuresAnalysis';
export { getFuturesAnalysis };
export type { FuturesResult } from '../../lib/futuresAnalysis';

export default function FuturesAnalysis({ coin, marketChart }: FuturesAnalysisProps) {
  const f = getFuturesAnalysis(coin, marketChart);

  if (f.isNeutral) {
    return (
      <div className="analysis-section futures-panel futures-neutral">
        <h3>⚡ Futures Analysis</h3>
        <div className="futures-neutral-msg">
          <span className="futures-dir-badge" style={{ background: '#374151', color: '#94a3b8' }}>
            ⚪ NETRAL — Hindari Futures
          </span>
          <p>Sinyal tidak cukup kuat untuk masuk posisi futures saat ini.<br />
          Tunggu konfirmasi breakout atau reversal yang lebih jelas.</p>
          <div className="futures-disclaimer">
            ⚠️ Futures berisiko tinggi. Selalu gunakan SL dan hanya trading dengan modal yang siap hilang.
          </div>
        </div>
      </div>
    );
  }

  const isLong = f.direction.startsWith('long');
  const isShort = f.direction.startsWith('short');
  const panelClass = isLong ? 'futures-long' : isShort ? 'futures-short' : '';

  return (
    <div className={`analysis-section futures-panel ${panelClass}`}>
      <h3>⚡ Futures Analysis — {coin.symbol.toUpperCase()}/USDT Perp</h3>

      <div className="futures-top-row">
        {/* Arah & Leverage */}
        <div className="futures-direction-card">
          <div className="futures-dir-label">Rekomendasi</div>
          <div className="futures-dir-badge" style={{ color: f.dirColor }}>
            {f.dirEmoji} {f.dirLabel}
          </div>
          <div className="futures-leverage-row">
            <span className="futures-lev-label">Leverage Optimal</span>
            <span className="futures-lev-badge" style={{ borderColor: f.dirColor, color: f.dirColor }}>
              {f.leverage}×
            </span>
          </div>
          <div className="futures-confidence">Confidence: {f.confidence}</div>
          <div className="futures-confidence">Volatilitas: {f.volatilityLevel}</div>
        </div>

        {/* Entry / TP / SL / Liq */}
        <div className="futures-levels-card">
          <table className="futures-table">
            <thead>
              <tr><th>Level</th><th>Harga</th><th>%</th></tr>
            </thead>
            <tbody>
              <tr className="futures-row-entry">
                <td>🎯 Entry</td>
                <td>{f.entry}</td>
                <td>—</td>
              </tr>
              <tr className="futures-row-tp1">
                <td>✅ Take Profit 1</td>
                <td>{f.tp1}</td>
                <td className="tp-pct">{isShort ? '−' : '+'}{f.rewardPct}%</td>
              </tr>
              <tr className="futures-row-tp2">
                <td>🚀 Take Profit 2</td>
                <td>{f.tp2}</td>
                <td className="tp-pct">{isShort ? '−' : '+'}{(parseFloat(f.rewardPct) * 1.8).toFixed(2)}%</td>
              </tr>
              <tr className="futures-row-sl">
                <td>🛑 Stop Loss</td>
                <td>{f.sl}</td>
                <td className="sl-pct">{isShort ? '+' : '−'}{f.riskPct}%</td>
              </tr>
              <tr className="futures-row-liq">
                <td>💀 Est. Liquidasi</td>
                <td>{f.liqEstimate}</td>
                <td>pada {f.leverage}×</td>
              </tr>
            </tbody>
          </table>
          <div className="futures-rr">Risk / Reward: <strong>1 : {f.rrRatio}</strong></div>
        </div>

        {/* Indikator */}
        <div className="futures-indicators-card">
          <div className="futures-ind-title">Indikator Teknikal</div>
          <div className="futures-ind-row">
            <span>RSI(14)</span>
            <span className={parseFloat(f.rsi) < 30 ? 'ind-oversold' : parseFloat(f.rsi) > 70 ? 'ind-overbought' : 'ind-neutral'}>
              {f.rsi}
            </span>
          </div>
          <div className="futures-ind-row">
            <span>ATR%</span>
            <span>{f.atrPct}%</span>
          </div>
          <div className="futures-ind-row">
            <span>Support</span>
            <span>{f.support}</span>
          </div>
          <div className="futures-ind-row">
            <span>Resistance</span>
            <span>{f.resistance}</span>
          </div>
          <div className="futures-ind-title" style={{ marginTop: '8px' }}>Faktor Sinyal</div>
          {f.factors.map((fc, i) => (
            <div key={i} className="futures-factor">• {fc}</div>
          ))}
        </div>
      </div>

      <div className="futures-disclaimer">
        ⚠️ <strong>Disclaimer:</strong> Analisis ini bersifat edukatif dan BUKAN saran keuangan.
        Futures berisiko tinggi — harga bisa bergerak berlawanan kapan saja.
        Gunakan SL wajib, posisi maksimal 1–3% dari modal, dan pahami risiko liquidasi sebelum trading.
      </div>
    </div>
  );
}