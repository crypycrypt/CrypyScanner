'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import HollowcatDashboard from '../../components/hollowcat/HollowcatDashboard';
import HollowcatChart from '../../components/hollowcat/HollowcatChart';
import HollowcatSignals from '../../components/hollowcat/HollowcatSignals';
import HollowcatRiskPanel from '../../components/hollowcat/HollowcatRiskPanel';
import HollowcatAlerts from '../../components/hollowcat/HollowcatAlerts';
import HollowcatBacktest from '../../components/hollowcat/HollowcatBacktest';
import HollowcatTradeQuality from '../../components/hollowcat/HollowcatTradeQuality';
import HollowcatEntryEngine from '../../components/hollowcat/HollowcatEntryEngine';

const TIMEFRAME_OPTIONS = [
  { value: '15m', label: '15M', days: '1' },
  { value: '30m', label: '30M', days: '2' },
  { value: '1h',  label: '1H',  days: '7' },
  { value: '4h',  label: '4H',  days: '30' },
  { value: '1d',  label: '1D',  days: '90' },
  { value: '7d',  label: '7D',  days: '180' },
  { value: '14d', label: '14D', days: '365' },
  { value: '30d', label: '30D', days: '365' },
];

interface CoinOption {
  id: string;
  symbol: string;
  name: string;
  pair: string;
  thumb?: string;
  market_cap_rank?: number;
}

export default function HollowcatPage() {
  const [analysis, setAnalysis]           = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [coinId, setCoinId]               = useState('bitcoin');
  const [symbol, setSymbol]               = useState('BTC/USDT');
  const [timeframe, setTimeframe]         = useState('1h');
  const [days, setDays]                   = useState('7');
  const [activeTab, setActiveTab]         = useState('dashboard');
  const [coinSearchQuery, setCoinSearchQuery] = useState('');
  const [coinDropdownOpen, setCoinDropdownOpen] = useState(false);
  const [coinList, setCoinList]           = useState<CoinOption[]>([]);
  const [coinListLoading, setCoinListLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const coinDropdownRef                   = useRef<HTMLDivElement>(null);
  const searchDebounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load top-500 coins on mount ──────────────────────────────────────────
  useEffect(() => {
    const fetchTopCoins = async () => {
      try {
        setCoinListLoading(true);
        const [page1, page2] = await Promise.all([
          fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false').then(r => r.json()),
          fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=2&sparkline=false').then(r => r.json()),
        ]);
        const combined: any[] = [...(Array.isArray(page1) ? page1 : []), ...(Array.isArray(page2) ? page2 : [])];
        // Deduplicate by id
        const seen = new Set<string>();
        const unique = combined.filter(c => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        });
        const mapped: CoinOption[] = unique.map(c => ({
          id: c.id,
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          pair: `${c.symbol.toUpperCase()}/USDT`,
          thumb: c.image,
          market_cap_rank: c.market_cap_rank,
        }));
        setCoinList(mapped);
      } catch (err) {
        console.error('Failed to load coin list:', err);
        // Fallback minimal list
        setCoinList([
          { id: 'bitcoin',   symbol: 'BTC',  name: 'Bitcoin',   pair: 'BTC/USDT'  },
          { id: 'ethereum',  symbol: 'ETH',  name: 'Ethereum',  pair: 'ETH/USDT'  },
          { id: 'solana',    symbol: 'SOL',  name: 'Solana',    pair: 'SOL/USDT'  },
          { id: 'ripple',    symbol: 'XRP',  name: 'Ripple',    pair: 'XRP/USDT'  },
          { id: 'cardano',   symbol: 'ADA',  name: 'Cardano',   pair: 'ADA/USDT'  },
        ]);
      } finally {
        setCoinListLoading(false);
      }
    };
    fetchTopCoins();
  }, []);

  // ── Close dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (coinDropdownRef.current && !coinDropdownRef.current.contains(e.target as Node)) {
        setCoinDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Fetch analysis when coin/timeframe changes ───────────────────────────
  const fetchAnalysis = useCallback(async (overrideCoinId?: string, overrideSymbol?: string, overrideTf?: string, overrideDays?: string) => {
    const _coinId    = overrideCoinId  || coinId;
    const _symbol    = overrideSymbol  || symbol;
    const _timeframe = overrideTf      || timeframe;
    const _days      = overrideDays    || days;
    try {
      setLoading(true);
      const res = await fetch(`/api/hollowcat?symbol=${_symbol}&timeframe=${_timeframe}&coinId=${_coinId}&days=${_days}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const text = await res.text();
      if (!text || text.trim() === '') throw new Error('Empty response from API');
      const data = JSON.parse(text);
      setAnalysis(data);
    } catch (error) {
      console.error('Error fetching Hollowcat analysis:', error);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [coinId, symbol, timeframe, days]);

  useEffect(() => {
    fetchAnalysis();
  }, [coinId, timeframe, days]);

  // ── Filtered coins for dropdown ──────────────────────────────────────────
  const filteredCoins = coinList.filter(coin =>
    coin.name.toLowerCase().includes(coinSearchQuery.toLowerCase()) ||
    coin.symbol.toLowerCase().includes(coinSearchQuery.toLowerCase())
  ).slice(0, 80); // show max 80 results for performance

  // ── Auto-search CoinGecko if nothing found locally ───────────────────────
  const handleSearchChange = (value: string) => {
    setCoinSearchQuery(value);
    setCoinDropdownOpen(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (value.length >= 2) {
      searchDebounceRef.current = setTimeout(async () => {
        const local = coinList.filter(c =>
          c.name.toLowerCase().includes(value.toLowerCase()) ||
          c.symbol.toLowerCase().includes(value.toLowerCase())
        );
        if (local.length === 0) {
          // Auto-search CoinGecko search endpoint
          try {
            setSearchLoading(true);
            const res  = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(value)}`);
            const data = await res.json();
            const coins: CoinOption[] = (data.coins || []).slice(0, 20).map((c: any) => ({
              id:     c.id,
              symbol: c.symbol.toUpperCase(),
              name:   c.name,
              pair:   `${c.symbol.toUpperCase()}/USDT`,
              thumb:  c.thumb,
              market_cap_rank: c.market_cap_rank,
            }));
            // Merge into coinList (deduplicated)
            setCoinList(prev => {
              const seen = new Set(prev.map(p => p.id));
              const newCoins = coins.filter(c => !seen.has(c.id));
              return [...prev, ...newCoins];
            });
          } catch (e) {
            console.error('Auto-search failed:', e);
          } finally {
            setSearchLoading(false);
          }
        }
      }, 500);
    }
  };

  // ── Select a coin ────────────────────────────────────────────────────────
  const selectCoin = (coin: CoinOption) => {
    setCoinId(coin.id);
    setSymbol(coin.pair);
    setCoinSearchQuery('');
    setCoinDropdownOpen(false);
  };

  // ── Select timeframe & auto-adjust days ─────────────────────────────────
  const handleTimeframeChange = (tfValue: string) => {
    const tf = TIMEFRAME_OPTIONS.find(t => t.value === tfValue);
    if (tf) {
      setTimeframe(tf.value);
      setDays(tf.days);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'chart',     label: 'Chart',     icon: '📈' },
    { id: 'signals',   label: 'Signals',   icon: '🎯' },
    { id: 'risk',      label: 'Risk',      icon: '🛡️' },
    { id: 'quality',   label: 'Quality',   icon: '⭐' },
    { id: 'entry',     label: 'Entry',     icon: '🚀' },
    { id: 'backtest',  label: 'Backtest',  icon: '📉' },
    { id: 'alerts',    label: 'Alerts',    icon: '🔔' },
  ];

  return (
    <div className="min-h-screen bg-[#0b1220] text-white font-ui">
      {/* Header */}
      <div className="border-b border-[rgba(148,163,184,0.12)] bg-[rgba(15,23,42,0.8)] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-neon">🐈 Hollowcat</h1>
              <span className="text-xs font-bold bg-[rgba(99,102,241,0.15)] text-indigo-400 px-2 py-1 rounded-full border border-[rgba(99,102,241,0.2)]">
                INSTITUTIONAL
              </span>
            </div>
            <button
              onClick={() => fetchAnalysis()}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-[rgba(99,102,241,0.15)] text-indigo-400 border border-[rgba(99,102,241,0.2)] hover:bg-[rgba(99,102,241,0.25)] transition-colors"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Coin & Timeframe Selector */}
          <div className="flex items-center gap-3 flex-wrap">

            {/* Searchable Coin Dropdown */}
            <div className="relative min-w-[240px]" ref={coinDropdownRef}>
              <div className="relative">
                <input
                  type="text"
                  placeholder={coinListLoading ? 'Loading 500 coins...' : 'Search 500+ coins...'}
                  value={coinSearchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setCoinDropdownOpen(true)}
                  className="w-full pl-3 pr-8 py-1.5 rounded-lg text-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {(coinListLoading || searchLoading) && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Currently selected */}
              {!coinDropdownOpen && coinSearchQuery === '' && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-indigo-400 font-bold pointer-events-none">
                  {coinList.find(c => c.id === coinId)?.symbol || 'BTC'}
                </div>
              )}

              {coinDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-lg bg-[#1e293b] border border-[rgba(255,255,255,0.06)] shadow-xl">
                  {filteredCoins.length > 0 ? filteredCoins.map((coin, idx) => (
                    <div
                      key={`${coin.id}-${idx}`}
                      onClick={() => selectCoin(coin)}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-[rgba(99,102,241,0.15)] flex items-center justify-between gap-2 ${coin.id === coinId ? 'bg-[rgba(99,102,241,0.1)] text-indigo-300' : 'text-white'}`}
                    >
                      <div className="flex items-center gap-2">
                        {coin.thumb && (
                          <img src={coin.thumb} alt={coin.symbol} className="w-4 h-4 rounded-full" />
                        )}
                        <span className="font-semibold text-xs">{coin.symbol}</span>
                        <span className="text-slate-400 text-xs">{coin.name}</span>
                      </div>
                      {coin.market_cap_rank && (
                        <span className="text-[10px] text-slate-500">#{coin.market_cap_rank}</span>
                      )}
                    </div>
                  )) : (
                    <div className="px-3 py-3 text-sm text-slate-400 text-center">
                      {searchLoading ? '🔍 Searching CoinGecko...' : 'No coins found'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-1">
              {TIMEFRAME_OPTIONS.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => handleTimeframeChange(tf.value)}
                  className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
                    timeframe === tf.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-slate-400 hover:text-white hover:bg-[rgba(255,255,255,0.08)]'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-500">{symbol}</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[rgba(148,163,184,0.12)] bg-[rgba(15,23,42,0.5)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-400 bg-[rgba(99,102,241,0.05)]'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-[rgba(255,255,255,0.02)]'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            <span className="ml-3 text-slate-400">Analyzing {symbol} [{timeframe}]...</span>
          </div>
        ) : !analysis ? (
          <div className="card-glass rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-bold text-slate-300 mb-2">Analysis Unavailable</h3>
            <p className="text-slate-400 text-sm">Unable to fetch analysis data. Please try refreshing.</p>
            <button
              onClick={() => fetchAnalysis()}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-[rgba(99,102,241,0.15)] text-indigo-400 border border-[rgba(99,102,241,0.2)] hover:bg-[rgba(99,102,241,0.25)] transition-colors"
            >
              🔄 Retry
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'dashboard' && <HollowcatDashboard analysis={analysis} />}
            {activeTab === 'chart'     && <HollowcatChart analysis={analysis} />}
            {activeTab === 'signals'   && <HollowcatSignals analysis={analysis} />}
            {activeTab === 'risk'      && <HollowcatRiskPanel analysis={analysis} />}
            {activeTab === 'quality'   && <HollowcatTradeQuality analysis={analysis} />}
            {activeTab === 'entry'     && <HollowcatEntryEngine analysis={analysis} />}
            {activeTab === 'backtest'  && <HollowcatBacktest analysis={analysis} />}
            {activeTab === 'alerts'    && <HollowcatAlerts analysis={analysis} />}
          </div>
        )}
      </main>
    </div>
  );
}
