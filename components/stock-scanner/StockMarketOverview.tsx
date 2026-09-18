"use client"

import React, { useEffect, useState } from 'react';

interface StockMarketOverviewProps {
  market: 'IDX' | 'US';
}

interface Mover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  marketCap: number;
}

interface IndexQuote {
  label: string;
  symbol: string;
  price: number;
  changePct: number;
}

interface SessionInfo {
  label: string;
  open: boolean;
}

interface WatchEntry {
  ticker: string;
  coinSymbol: string;
  coinName: string;
  currency: 'IDR' | 'USD';
  bias: 'BUY' | 'SELL';
  currentPrice: number;
  triggerPrice: number;
  distancePct: number;
  bullish: number;
  bearish: number;
  reason: string;
}

interface Overview {
  movers: { gainers: Mover[]; losers: Mover[]; mostActive: Mover[]; total: number; scannedAt: string };
  indices: IndexQuote[];
  sessions: SessionInfo[];
  watchlist: WatchEntry[];
}

type Tab = 'gainers' | 'losers' | 'active';

const StockMarketOverview: React.FC<StockMarketOverviewProps> = ({ market }) => {
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<Tab>('gainers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currency = market === 'IDX' ? 'IDR' : 'USD';
  const fmtPrice = (v: number) => {
    if (currency === 'IDR') return 'Rp' + Math.round(v).toLocaleString('id-ID');
    return '$' + v.toFixed(2);
  };
  const fmtVolume = (v: number) => {
    if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return String(v);
  };

  const load = async (force = false) => {
    try {
      const res = await fetch(`/api/stock-scanner/${market.toLowerCase()}/overview${force ? '?force=1' : ''}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load(false);
    const t = setInterval(() => load(false), 3 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  const list = data ? (tab === 'gainers' ? data.movers.gainers : tab === 'losers' ? data.movers.losers : data.movers.mostActive) : [];

  return (
    <div className="card-glass rounded-xl p-4 mb-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 pb-4 border-b border-white/10">
        {data?.indices.map(idx => (
          <div key={idx.symbol} className="flex items-baseline gap-2">
            <span className="text-slate-400 text-xs font-semibold">{idx.label}</span>
            <span className="text-slate-100 font-bold text-sm">{idx.price ? idx.price.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '—'}</span>
            {idx.price > 0 && (
              <span className={`text-xs font-bold ${idx.changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {idx.changePct >= 0 ? '▲' : '▼'} {idx.changePct >= 0 ? '+' : ''}{idx.changePct}%
              </span>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2 ml-auto">
          {data?.sessions.map(s => (
            <span key={s.label} className={`text-[11px] px-2 py-0.5 rounded-full border ${s.open ? 'border-green-400/50 text-green-300 bg-green-500/10' : 'border-slate-600 text-slate-500 bg-slate-800/40'}`}>
              {s.open ? '🟢' : '🔴'} {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-slate-100 font-bold text-sm">🔥 Top Movers {market} Hari Ini</span>
        <div className="flex gap-1.5 ml-2">
          {([
            ['gainers', '🚀 Gainers'],
            ['losers', '📉 Losers'],
            ['active', '⚡ Most Active'],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${tab === id ? 'bg-cyan-400 text-slate-900 border-cyan-400 font-bold' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-slate-600 text-[11px] ml-auto">{data?.movers.total ? `${data.movers.total}+ saham dipindai live` : ''}</span>
        <button onClick={() => { setLoading(true); load(true); }} className="text-xs px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-cyan-400">⟳</button>
      </div>

      {loading && <div className="text-slate-500 text-sm py-6 text-center">Memuat data live…</div>}
      {!loading && error && <div className="text-red-400 text-sm py-4">Gagal memuat: {error}</div>}
      {!loading && !error && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {list.length === 0 && <span className="text-slate-500 text-sm">Tidak ada data.</span>}
          {list.map(m => {
            const up = m.change >= 0;
            return (
              <div key={m.symbol} className={`min-w-[130px] flex-shrink-0 rounded-lg border px-3 py-2 ${up ? 'bg-green-500/5 border-green-500/25' : 'bg-red-500/5 border-red-500/25'}`}>
                <div className="text-slate-100 font-bold text-sm truncate" title={m.name}>{market === 'IDX' ? m.symbol : m.symbol}</div>
                <div className={`text-base font-extrabold ${up ? 'text-green-400' : 'text-red-400'}`}>{up ? '▲' : '▼'} {up ? '+' : ''}{m.change.toFixed(2)}%</div>
                <div className="text-slate-400 text-[11px]">{fmtPrice(m.price)}</div>
                <div className="text-slate-600 text-[10px]">Vol {fmtVolume(m.volume)}</div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && !!data?.watchlist.length && (
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-slate-100 font-bold text-sm">👀 Sedang Dipantau</span>
            <span className="text-slate-600 text-[11px]">near-miss — belum lolos gate, dekat dengan level breakout/breakdown</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {data.watchlist.map(w => {
              const isLong = w.bias === 'BUY';
              return (
                <div key={w.ticker} className={`min-w-[170px] flex-shrink-0 rounded-lg border px-3 py-2 ${isLong ? 'bg-slate-800/60 border-green-500/20' : 'bg-slate-800/60 border-red-500/20'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-100 font-bold text-sm">{w.coinSymbol}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isLong ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>{w.bias}</span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-1">Now {fmtPrice(w.currentPrice)}</div>
                  <div className="text-slate-300 text-[11px]">Trigger {fmtPrice(w.triggerPrice)} ({w.distancePct}% lagi)</div>
                  <div className="text-slate-500 text-[10px] mt-1">Bull {w.bullish}% · Bear {w.bearish}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default StockMarketOverview;
