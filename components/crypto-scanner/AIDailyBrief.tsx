"use client"

import React, { useState, useEffect } from 'react';

interface AIDailyBriefData {
  ok: boolean;
  fngValue?: number;
  fngLabel?: string;
  bull?: number;
  bear?: number;
  macro?: Record<string, { price: number; chg: number }>;
  recommendations?: Array<{
    type: 'buy' | 'caution' | 'info' | 'hot' | 'tip';
    market: string;
    icon: string;
    text: string;
  }>;
  sampleHeadlines?: string[];
  hotSectors?: Array<{ sector: string; mentions: number }>;
  newsCount?: number;
  cached?: boolean;
}

function AIDailyBrief() {
  const [data, setData] = useState<AIDailyBriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrief = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For now, we'll create mock data that matches crypto-scanner's structure
      // In a real implementation, this would fetch from an API endpoint
      const mockData: AIDailyBriefData = {
        ok: true,
        fngValue: 68,
        fngLabel: 'Greed',
        bull: 42,
        bear: 18,
        macro: {
          'BTC-USD': { price: 43250, chg: 2.3 },
          '^GSPC': { price: 5120.45, chg: 0.8 },
          '^IXIC': { price: 16200.75, chg: 1.2 },
          '^JKSE': { price: 7250.3, chg: 0.5 },
          'GC=F': { price: 1985.6, chg: -0.3 },
          'CL=F': { price: 78.45, chg: 1.1 },
          'EURUSD=X': { price: 1.0856, chg: -0.2 }
        },
        recommendations: [
          {
            type: 'buy',
            market: 'Crypto',
            icon: '📈',
            text: 'BTC menunjukkan momentum bullish dengan volume meningkat. Watch level $43,500 sebagai resistance utama.'
          },
          {
            type: 'hot',
            market: 'Stocks',
            icon: '🔥',
            text: 'Sektor AI & Tech trending di news dengan 24 sebutan. Watchlist: NVDA, MSFT, META.'
          },
          {
            type: 'caution',
            market: 'Macro',
            icon: '⚠️',
            text: 'FED meeting minggu depan berpotensi menyebabkan volatilitas tinggi di semua aset.'
          }
        ],
        sampleHeadlines: [
          'Bitcoin ETF inflows mencapai rekor baru minggu ini',
          'AI sector menunjukkan momentum kuat dengan volume tinggi',
          'Whale activity meningkat di altcoin mid-cap',
          'Market sentiment bullish dengan Fear & Greed di level 68',
          'Tech stocks outperform setelah earnings season'
        ],
        hotSectors: [
          { sector: 'AI & Tech', mentions: 24 },
          { sector: 'Crypto', mentions: 18 },
          { sector: 'Green Energy', mentions: 12 }
        ],
        newsCount: 42,
        cached: false
      };
      
      setData(mockData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI Daily Brief');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrief();
    
    // Auto-refresh every 15 minutes
    const interval = setInterval(fetchBrief, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const macroLabel = (sym: string) => {
    const map: Record<string, string> = { 
      '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ', '^JKSE': 'IHSG', 
      'BTC-USD': 'BTC', 'GC=F': 'Gold', 'CL=F': 'Oil', 'EURUSD=X': 'EUR/USD' 
    };
    return map[sym] || sym;
  };

  const fmtPrice = (sym: string, price: number) => {
    if (sym === 'BTC-USD') return '$' + Number(price).toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (sym === '^JKSE') return Number(price).toLocaleString('id-ID', { maximumFractionDigits: 0 });
    if (sym === 'EURUSD=X') return price.toFixed(4);
    return '$' + Number(price).toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-blue-600/30 rounded-xl p-4 flex items-center gap-3">
        <span className="text-xl animate-spin">⏳</span>
        <span className="text-slate-400 text-sm">Menganalisa pasar dan berita terkini…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-red-400/30 rounded-xl p-4 text-red-400 text-sm">
        ⚠ AI Brief gagal memuat: {error}
        <button 
          onClick={fetchBrief}
          className="ml-3 bg-slate-800 border border-slate-600 text-blue-400 px-3 py-1 rounded text-xs"
        >
          ↺ Retry
        </button>
      </div>
    );
  }

  if (!data || !data.ok) return null;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('id-ID', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  });

  // Fear & Greed
  const fngVal = data.fngValue ? parseInt(data.fngValue.toString()) : null;
  const fngColor = fngVal === null ? '#64748b' : 
    fngVal >= 75 ? '#ef4444' : 
    fngVal >= 55 ? '#f59e0b' : 
    fngVal >= 45 ? '#a3e635' : 
    fngVal >= 25 ? '#22c55e' : '#38bdf8';

  // Sentiment bar
  const total = (data.bull || 0) + (data.bear || 0) || 1;
  const bullPct = Math.round((data.bull! / total) * 100);
  const bearPct = 100 - bullPct;
  const sentColor = bullPct >= 60 ? '#22c55e' : bullPct <= 40 ? '#ef4444' : '#f59e0b';

  // Macro ticker pills
  const macroPills = Object.entries(data.macro || {}).map(([sym, v]) => {
    if (!v || v.price == null) return null;
    const up = v.chg >= 0;
    const color = up ? '#22c55e' : '#ef4444';
    const arrow = up ? '▲' : '▼';
    
    return (
      <div key={sym} className="bg-slate-800 border border-slate-600 rounded-lg p-2 flex flex-col items-center min-w-[80px]">
        <span className="text-slate-400 text-xs font-semibold tracking-wide">{macroLabel(sym)}</span>
        <span className="text-white text-sm font-bold">{fmtPrice(sym, v.price)}</span>
        <span className="text-xs font-semibold" style={{ color }}>
          {arrow} {up ? '+' : ''}{v.chg}%
        </span>
      </div>
    );
  }).filter(Boolean);

  // Recommendation cards
  const recTypeStyle = {
    buy:     { bg: 'bg-green-900/20', border: 'border-green-500/40', accent: '#22c55e', badge: 'BUY SIGNAL' },
    caution: { bg: 'bg-orange-900/20', border: 'border-orange-500/40', accent: '#f59e0b', badge: 'CAUTION' },
    info:    { bg: 'bg-indigo-900/20', border: 'border-indigo-500/40', accent: '#6366f1', badge: 'INFO' },
    hot:     { bg: 'bg-red-900/20', border: 'border-red-500/40', accent: '#ef4444', badge: 'HOT SECTOR' },
    tip:     { bg: 'bg-emerald-900/20', border: 'border-emerald-500/40', accent: '#34d399', badge: 'TIPS' },
  };

  const recCards = data.recommendations?.map((rec, i) => {
    const st = recTypeStyle[rec.type] || recTypeStyle.info;
    
    return (
      <div key={i} className={st.bg + ' border rounded-xl p-3 flex gap-3 items-start'} style={{ borderColor: st.border }}>
        <span className="text-xl">{rec.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="px-2 py-0.5 rounded-full text-xs font-bold tracking-wide"
              style={{ backgroundColor: st.accent + '22', color: st.accent, border: `1px solid ${st.accent}44` }}
            >
              {st.badge}
            </span>
            <span className="text-slate-400 text-xs">{rec.market}</span>
          </div>
          <div className="text-slate-200 text-sm leading-relaxed">{rec.text}</div>
        </div>
      </div>
    );
  });

  // Hot sectors badges
  const hotBadges = data.hotSectors?.slice(0, 5).map((s, i) => (
    <span 
      key={i}
      className="px-3 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b40' }}
    >
      {s.sector} <span style={{ opacity: 0.6 }}>{s.mentions}x</span>
    </span>
  ));

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-blue-600/30 rounded-xl p-5 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-blue-400 rounded-lg p-2 text-lg">🤖</div>
          <div>
            <div className="text-white text-lg font-bold">AI Daily Brief</div>
            <div className="text-slate-500 text-xs">
              {dateStr} · Diperbarui {timeStr} {data.cached ? '(cached)' : '(live)'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Fear & Greed badge */}
          {fngVal !== null && (
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-2 text-center">
              <div className="text-slate-400 text-xs font-semibold tracking-wide">FEAR & GREED</div>
              <div className="text-2xl font-black" style={{ color: fngColor }}>{fngVal}</div>
              <div className="text-xs" style={{ color: fngColor }}>{data.fngLabel || ''}</div>
            </div>
          )}
          
          {/* Sentiment */}
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-2 min-w-[100px]">
            <div className="text-slate-400 text-xs font-semibold tracking-wide mb-1">NEWS SENTIMENT</div>
            <div className="bg-slate-900 rounded h-2 overflow-hidden mb-1">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-300 rounded transition-all duration-500"
                style={{ width: `${bullPct}%` }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-green-500 text-xs">🐂 {data.bull || 0}</span>
              <span className="text-xs font-bold" style={{ color: sentColor }}>{bullPct}% Bull</span>
              <span className="text-red-500 text-xs">🐻 {data.bear || 0}</span>
            </div>
          </div>
          
          <button 
            onClick={fetchBrief}
            className="bg-slate-800 border border-slate-600 text-blue-400 px-3 py-1.5 rounded text-sm font-semibold"
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Macro ticker strip */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        {macroPills}
      </div>

      {/* Hot sectors */}
      {hotBadges && hotBadges.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-slate-500 text-xs font-semibold">🔥 TRENDING:</span>
          {hotBadges}
          <span className="text-slate-500 text-xs">dari {data.newsCount || 0} berita</span>
        </div>
      )}

      {/* Main grid: recs + headlines */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-4">
        {/* Left: Recommendations */}
        <div className="flex flex-col gap-2">
          <div className="text-slate-400 text-xs font-semibold tracking-wide mb-1">
            📊 ANALISA & REKOMENDASI HARI INI
          </div>
          {recCards && recCards.length > 0 ? recCards : (
            <div className="text-slate-500 text-sm">Tidak ada rekomendasi saat ini.</div>
          )}
        </div>

        {/* Right: Headlines */}
        <div>
          <div className="text-slate-400 text-xs font-semibold tracking-wide mb-2">
            📰 HEADLINE TERKINI
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 max-h-72 overflow-y-auto">
            {data.sampleHeadlines && data.sampleHeadlines.length > 0 ? (
              data.sampleHeadlines.map((headline, i) => (
                <div key={i} className="text-slate-400 text-xs py-1 border-b border-slate-800 last:border-b-0">
                  • {headline}
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs">Tidak ada berita terbaru.</div>
            )}
          </div>
          
          <div className="mt-3 bg-slate-900 border border-slate-700 rounded-xl p-3">
            <div className="text-slate-500 text-xs mb-1">⚠️ DISCLAIMER</div>
            <div className="text-slate-600 text-xs leading-relaxed">
              Analisa ini bersifat informatif berdasarkan data publik (RSS news, Yahoo Finance, Fear&Greed Index). 
              <strong className="text-slate-500"> Bukan saran investasi.</strong> Selalu lakukan riset sendiri (DYOR) sebelum trading.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIDailyBrief;