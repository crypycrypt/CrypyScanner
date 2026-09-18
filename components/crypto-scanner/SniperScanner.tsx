"use client"
import { useMemo, useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useSniperScanner } from '../../lib/realTimeHooks'
import { getFuturesAnalysis } from './FuturesAnalysis'
import SignalPriceChart from './SignalPriceChart'

interface SniperSignal {
  active: boolean;
  score: number;
  label: string;
}

interface SniperCoin {
  symbol: string;
  signal: string;
  price: number;
  ch24h: number;
  score: number;
  rsi: number;
  volRatio: number;
  closes?: number[];
  candles?: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
  signals: Record<string, SniperSignal>;
}

const SIGNAL_MAX: Record<string, number> = {
  sweep: 25,
  volume: 20,
  candle: 15,
  bos: 20,
  fvg: 10,
  rsi: 10,
}

type CssVars = CSSProperties & Record<string, string | number>

const NODE_DEFS = [
  { key: 'sweep', title: 'SCOUT', color: '#42d9ff', role: 'DISCOVERY', desc: 'Finds liquidity sweeps and stop hunts across scanned pairs.', state: (n: number) => `${n} SWEEP DETECTED` },
  { key: 'volume', title: 'FLOW', color: '#ffc34a', role: 'SMART MONEY', desc: 'Tracks volume spikes and unusual smart-money inflow.', state: (n: number, top: number) => `TOP VOL RATIO ${top.toFixed(1)}x` },
  { key: 'candle', title: 'STRUCTURE', color: '#a78bfa', role: 'PRICE ACTION', desc: 'Detects hammers and bullish engulfing reversals.', state: (n: number) => `${n} REVERSAL CANDLE` },
  { key: 'bos', title: 'BREAKOUT', color: '#ff7442', role: 'MOMENTUM', desc: 'Confirms break of structure to the upside.', state: (n: number) => `${n} BOS DETECTED` },
  { key: 'fvg', title: 'DEMAND', color: '#25e5a2', role: 'ZONES', desc: 'Maps FVG and demand zones near price.', state: (n: number) => `${n} AT DEMAND` },
  { key: 'rsi', title: 'DEFENSE', color: '#ff5262', role: 'RSI CHECK', desc: 'Checks RSI oversold conditions and divergence.', state: (n: number) => `${n} OVERSOLD / DIVERGENCE` },
] as const

function formatPrice(price: number) {
  if (price < 0.01) return price.toFixed(6)
  if (price < 1) return price.toFixed(4)
  return price.toFixed(2)
}

function nowJakarta() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Jakarta' })
}

export default function SniperScanner() {
  const [timeframe, setTimeframe] = useState('1h')
  const [topN, setTopN] = useState(100)
  const { data, isLoading, isError, refetch } = useSniperScanner(timeframe, topN)
  // Placeholder stabil agar SSR & hydration cocok (hindari hydration mismatch
  // karena jam berubah antara render server dan client); waktu asli di-set saat mount.
  const [clock, setClock] = useState('--:--:--')
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)

  useEffect(() => {
    setClock(nowJakarta())
    const id = setInterval(() => setClock(nowJakarta()), 1000)
    return () => clearInterval(id)
  }, [])

  const coins: SniperCoin[] = useMemo(() => {
    const list = (data?.coins || []) as SniperCoin[]
    return [...list].sort((a, b) => b.score - a.score)
  }, [data])

  const totalScanned = data?.totalScanned ?? 0
  const top = coins[0] || null
  const selected = coins.find((c) => c.symbol === selectedSymbol) ?? top

  const snipers = coins.filter((c) => c.score >= 80).length
  const watches = coins.filter((c) => c.score >= 60 && c.score < 80).length
  const activeSignals = coins.reduce((sum, c) => sum + Object.values(c.signals).filter((s) => s.active).length, 0)

  // Per-signal-type counts + top volume ratio
  const signalCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    let topVol = 1
    for (const c of coins) {
      if (c.volRatio > topVol) topVol = c.volRatio
      for (const [key, sig] of Object.entries(c.signals)) {
        if (sig.active) counts[key] = (counts[key] || 0) + 1
      }
    }
    return { counts, topVol }
  }, [coins])

  const selectedActive = selected
    ? Object.entries(selected.signals)
        .filter(([, s]) => s.active)
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 4)
    : []

  const selectedReason = selectedActive.length
    ? selectedActive.map(([key, s]) => s.label).join(' + ')
    : 'Menunggu konfirmasi sinyal lebih kuat'

  // Timeline events for the selected coin
  const timeline = useMemo(() => {
    if (!selected) return []
    const base = new Date(data?.scannedAt || Date.now())
    const rows: { time: string; tag: string; text: string; cls: string }[] = []
    Object.entries(selected.signals).forEach(([key, s], i) => {
      const d = new Date(base.getTime() + i * 4000)
      rows.push({
        time: d.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Jakarta' }),
        tag: key.toUpperCase(),
        text: s.active ? s.label : `${s.label.replace(/^.*?\s/, '')} belum terkonfirmasi`,
        cls: s.active ? 'ok' : 'warn',
      })
    })
    return rows
  }, [selected, data])

  const tickerCoins = coins.slice(0, 8)

  const formatUsd = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`
    return `$${Math.round(v).toLocaleString()}`
  }

  // ── Data-driven animation parameters (recomputed live from each scan) ──
  const selectedScore = selected?.score ?? 0
  const beamDur = Math.max(1.2, 12 - selectedScore / 12)
  const pulseDur = Math.max(1.1, 4 - selectedScore / 45)
  const flowDur = Math.max(1, 4 - activeSignals / 40)

  // ── Futures recommendation (entry / SL / TP) merged from Futures Analysis ──
  const futures = useMemo(() => {
    if (!selected) return null
    const closes = selected.closes || []
    const coin = {
      symbol: selected.symbol,
      current_price: selected.price,
      price_change_percentage_1h_in_currency: 0,
      price_change_percentage_24h: selected.ch24h,
      price_change_percentage_7d_in_currency: 0,
      market_cap: 0,
      total_volume: 0,
      sparkline_in_7d: { price: closes },
    }
    return getFuturesAnalysis(coin)
  }, [selected])

  const isShort = futures ? futures.direction.startsWith('short') : false

  const tickerItems = (
    <>
      <span>TF <b>{timeframe.toUpperCase()}</b></span>
      {tickerCoins.map((c) => (
        <span key={c.symbol}>
          {c.symbol} <b className={c.ch24h >= 0 ? '' : 'r'}>{c.ch24h >= 0 ? '▲' : '▼'} {Math.abs(c.ch24h).toFixed(2)}%</b>
        </span>
      ))}
      <span>SCANNED <b>+{totalScanned}</b></span>
      <span>ACTIVE SIGNALS <b>+{activeSignals}</b></span>
    </>
  )

  return (
    <div className="nx-root">
      <div className="nx-app">
        {/* ── Top bar ── */}
        <header className="nx-top">
          <div>
            <div className="nx-tag">WHALERADAR AI · AI SIGNAL INTELLIGENCE TERMINAL</div>
          </div>
          <div className="nx-toolbar">
            {['15m', '1h', '4h'].map((tf) => (
              <button
                key={tf}
                className={timeframe === tf ? 'active' : ''}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
            <select value={topN} onChange={(e) => setTopN(parseInt(e.target.value, 10))}>
              <option value={50}>TOP 50</option>
              <option value={100}>TOP 100</option>
              <option value={200}>TOP 200</option>
            </select>
            <button onClick={() => refetch()}>⟳ REFRESH</button>
          </div>
          <div className="nx-live"><i /> LIVE · {clock}</div>
        </header>

        {/* ── Ticker ── */}
        <div className="nx-ticker">
          <div className="nx-ticker-track">
            {tickerItems}
            {tickerItems}
          </div>
        </div>

        {/* ── KPI row ── */}
        <section className="nx-kpis">
          <div className="nx-kpi">
            <div className="nx-klabel">TOKENS SCANNED</div>
            <div className="nx-kval">{totalScanned.toLocaleString()}</div>
            <div className="nx-ksub">last scan · {data?.timeframe || timeframe}</div>
          </div>
          <div className="nx-kpi">
            <div className="nx-klabel">AI SIGNAL ZONES</div>
            <div className="nx-kval nx-yellow">{snipers}</div>
            <div className="nx-ksub">score ≥ 80</div>
          </div>
          <div className="nx-kpi">
            <div className="nx-klabel">WATCHLIST</div>
            <div className="nx-kval nx-cyan">{watches}</div>
            <div className="nx-ksub">score 60–79</div>
          </div>
          <div className="nx-kpi">
            <div className="nx-klabel">ACTIVE SIGNALS</div>
            <div className="nx-kval nx-green">{activeSignals}</div>
            <div className="nx-ksub">across {coins.length} coins</div>
          </div>
          <div className="nx-kpi">
            <div className="nx-klabel">SYSTEM HEALTH</div>
            <div className={`nx-kval ${isError ? 'nx-red' : 'nx-green'}`}>{isLoading ? 'BOOT' : isError ? 'OFFLINE' : 'LIVE'}</div>
            <div className="nx-ksub">{isError ? 'connection lost' : 'realtime · auto-refresh 20s'}</div>
          </div>
        </section>

        {/* ── Layout ── */}
        {isLoading && (
          <section className="nx-panel"><div className="nx-loading">SCANNING MARKET FOR AI SIGNAL SETUPS…</div></section>
        )}

        {!isLoading && isError && coins.length === 0 && (
          <section className="nx-panel">
            <div className="nx-empty">
              <div>
                <img src="/assets/ic_luv.svg" alt="" className="nx-empty-icon" />
                <div className="nx-red">KONEKSI DATA GAGAL · SISTEM OFFLINE</div>
                <div style={{ marginTop: 6, fontSize: 8, color: '#596873' }}>PERIKSA KONEKSI / TEKAN REFRESH UNTUK COBA LAGI</div>
                <button className="nx-empty-btn" onClick={() => refetch()}>⟳ REFRESH</button>
              </div>
            </div>
          </section>
        )}

        {!isLoading && !isError && coins.length === 0 && (
          <section className="nx-panel">
            <div className="nx-empty">
              <div>
                <img src="/assets/ic_luv.svg" alt="" className="nx-empty-icon" />
                <div>BELUM ADA SETUP KUAT SAAT INI</div>
                <div style={{ marginTop: 6, fontSize: 8, color: '#596873' }}>CUBA TIMEFRAME BERBEDA / REFRESH</div>
              </div>
            </div>
          </section>
        )}

        {!isLoading && coins.length > 0 && (
          <>
            <div className="nx-layout">
              {/* ── Intelligence Floor ── */}
              <section className="nx-panel nx-floor" id="nx-floor">
                <div className="nx-ph">
                  <div className="nx-pt">THE INTELLIGENCE FLOOR</div>
                  <div className="nx-meta">6 MODULES · AI SIGNAL ORCHESTRATOR ONLINE</div>
                </div>
                <div className="nx-floorbody" style={{ '--flow-dur': `${flowDur.toFixed(1)}s` } as CssVars}>
                  <div className="nx-grid" />
                  <div className="nx-ring r1" />
                  <div className="nx-ring r2" />
                  <div className="nx-ring r3" />
                  <div className="nx-cross" />
                  <div className="nx-cross x" />
                  <div className="nx-beam" style={{ '--rot-dur': `${beamDur.toFixed(1)}s` } as CssVars} />
                  <div className="nx-connector nx-c1" />
                  <div className="nx-connector nx-c2" />
                  <div className="nx-connector nx-c3" />
                  <div className="nx-connector nx-c4" />
                  <div className="nx-connector nx-c5" />
                  <div className="nx-connector nx-c6" />

                  <div className="nx-core" style={{ '--pulse-dur': `${pulseDur.toFixed(1)}s` } as CssVars}>
                    <div className="nx-core-label">AI SIGNAL CORE</div>
                    <div className="nx-core-score">{selected ? selected.score : '–'}</div>
                    <div className="nx-core-small">
                      {selected ? `$${selected.symbol} · CONSENSUS ${Object.values(selected.signals).filter((s) => s.active).length}/6` : 'NO DATA'}
                    </div>
                  </div>

                  {NODE_DEFS.map((node, i) => {
                    const count = signalCounts.counts[node.key] || 0
                    const max = SIGNAL_MAX[node.key] || 1
                    const sig = selected?.signals[node.key]
                    const sigPct = sig ? Math.min(100, Math.round((sig.score / max) * 100)) : 0
                    const meterWidth = sig?.active ? Math.max(10, sigPct) : 8
                    const stateText =
                      node.key === 'volume'
                        ? node.state(count, signalCounts.topVol)
                        : node.state(count)
                    return (
                      <div className={`nx-node nx-n${i + 1}${sig?.active ? ' live' : ''}`} key={node.key}>
                        <div className="nx-nh">
                          <strong style={{ color: node.color }}>● {node.title}</strong>
                          <small>{node.role}</small>
                        </div>
                        <div className="nx-desc">{node.desc}</div>
                        <div className="nx-meter">
                          <i style={{ background: node.color, width: `${meterWidth}%` }} />
                        </div>
                        <div className="nx-state">{sig?.active ? `${node.title} ${sigPct}% · ${sig.label}` : stateText}</div>
                      </div>
                    )
                  })}

                  <div className="nx-statusbar">
                    <span>MISSION <b>SCAN → VERIFY → TIME → SIGNAL</b></span>
                    <span>LIVE DATA · NO EXECUTION</span>
                  </div>
                </div>
              </section>

              {/* ── Right column ── */}
              <aside className="nx-rightcol">
                {/* Current Signal */}
                <section className="nx-panel nx-signal" id="nx-signal">
                  <div className="nx-ph">
                    <div className="nx-pt">CURRENT SIGNAL</div>
                    <div className="nx-meta">{coins.length} CANDIDATE{coins.length > 1 ? 'S' : ''} · CLICK TO ANALYZE</div>
                  </div>

                  {coins.length > 1 && (
                    <div className="nx-signal-list">
                      {coins.map((c) => {
                        const isActive = c.symbol === selected.symbol
                        return (
                          <button
                            key={c.symbol}
                            type="button"
                            className={`nx-signal-item${isActive ? ' active' : ''}`}
                            onClick={() => setSelectedSymbol(c.symbol)}
                          >
                            <span className="nx-sym">${c.symbol}</span>
                            <span className={c.ch24h >= 0 ? 'nx-green' : 'nx-red'}>
                              {c.ch24h >= 0 ? '▲' : '▼'} {Math.abs(c.ch24h).toFixed(2)}%
                            </span>
                            <b className={c.score >= 80 ? 'nx-green' : c.score >= 60 ? 'nx-warn' : 'nx-red'}>{c.score}</b>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <div className="nx-signalbox">
                    <div className="nx-signalrow">
                      <div className="nx-token">${selected.symbol}</div>
                      <div className="nx-badge">{selected.signal.replace(/^\S+\s/, '')}</div>
                    </div>
                    <div className="nx-sigscore nx-green">{selected.score}<small>/100</small></div>
                    <div className="nx-reason">${selected.symbol} @ ${formatPrice(selected.price)} · {selected.ch24h >= 0 ? '+' : ''}{selected.ch24h.toFixed(2)}% 24H</div>
                    <div className="nx-signal-stats">
                      <div><span>RSI</span><b className={selected.rsi <= 30 ? 'nx-green' : selected.rsi >= 70 ? 'nx-red' : ''}>{selected.rsi.toFixed(1)}</b></div>
                      <div><span>VOL RATIO</span><b className={selected.volRatio >= 1.3 ? 'nx-green' : ''}>{selected.volRatio.toFixed(1)}x</b></div>
                      <div><span>CONSENSUS</span><b>{Object.values(selected.signals).filter((s) => s.active).length}/6</b></div>
                    </div>
                    <div className="nx-factor">
                      {selectedActive.map(([key, sig]) => {
                        const pct = Math.min(100, Math.round((sig.score / (SIGNAL_MAX[key] || 1)) * 100))
                        return (
                          <div key={key} style={{ marginTop: 8 }}>
                            <div className="nx-factorline"><span>{key.toUpperCase()}</span><b>{sig.score}</b></div>
                            <div className="nx-fbar"><i style={{ width: `${pct}%` }} /></div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="nx-selected-reason">{selectedReason}</div>
                  </div>
                  <div className="nx-actions">
                    <button className="nx-primary" onClick={() => refetch()}>ANALYZE</button>
                    <button onClick={() => setSelectedSymbol(null)}>TOP</button>
                    <button onClick={() => refetch()}>REFRESH</button>
                  </div>
                </section>

                {/* Volume Flow */}
                <section className="nx-panel nx-sidepanel">
                  <div className="nx-ph"><div className="nx-pt">VOLUME FLOW</div><div className="nx-meta">SMART MONEY</div></div>
                  <div className="nx-rows">
                    {[...coins].sort((a, b) => b.volRatio - a.volRatio).slice(0, 4).map((c) => (
                      <div className="nx-srow" key={c.symbol}>
                        <span>${c.symbol} <em>{c.volRatio.toFixed(1)}x</em></span>
                        <b>{c.score}</b>
                        <span className={c.volRatio >= 2 ? 'nx-green' : c.volRatio >= 1.3 ? 'nx-warn' : ''}>{c.volRatio >= 2 ? 'HIGH' : c.volRatio >= 1.3 ? 'MED' : 'LOW'}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Opportunity Queue */}
                <section className="nx-panel nx-sidepanel" id="nx-queue">
                  <div className="nx-ph"><div className="nx-pt">LIVE OPPORTUNITY QUEUE</div><div className="nx-meta">TOP 4</div></div>
                  <div className="nx-rows">
                    {coins.slice(0, 4).map((c) => (
                      <div className="nx-srow" key={c.symbol}>
                        <span>${c.symbol} <em>{c.ch24h >= 0 ? '+' : ''}{c.ch24h.toFixed(1)}%</em></span>
                        <b>{c.score}</b>
                        <span className={c.score >= 80 ? 'nx-green' : c.score >= 60 ? 'nx-warn' : 'nx-red'}>{c.score >= 80 ? 'AI SIGNAL' : c.score >= 60 ? 'WATCH' : 'SETUP'}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
            </div>

            {/* ── Futures recommendation (entry / SL / TP) ── */}
            {futures && (
              <section className="nx-panel nx-futures" id="nx-futures">
                <div className="nx-ph">
                  <div className="nx-pt">FUTURES RECOMMENDATION · ${selected.symbol}/USDT PERP</div>
                  <div className="nx-meta">ENTRY / TP / SL · REAL-TIME LOGIC</div>
                </div>
                <div className="nx-futures-grid">
                  <div className="nx-fdir">
                    <div className="nx-fdir-label">REKOMENDASI</div>
                    <div className="nx-fdir-badge" style={{ color: futures.dirColor, borderColor: futures.dirColor }}>
                      {futures.dirEmoji} {futures.dirLabel}
                    </div>
                    <div className="nx-fdir-row"><span>Leverage</span><b style={{ color: futures.dirColor }}>{futures.leverage}×</b></div>
                    <div className="nx-fdir-row"><span>Score</span><b>{futures.score}</b></div>
                    <div className="nx-fdir-row"><span>Confidence</span><b>{futures.confidence}</b></div>
                    <div className="nx-fdir-row"><span>Volatilitas</span><b>{futures.volatilityLevel}</b></div>
                  </div>
                  <table className="nx-flevels">
                    <thead>
                      <tr><th>LEVEL</th><th>HARGA</th><th>%</th></tr>
                    </thead>
                    <tbody>
                      <tr className="nx-f-entry"><td>🎯 Entry</td><td>{futures.entry}</td><td>—</td></tr>
                      <tr className="nx-f-tp1"><td>✅ Take Profit 1</td><td>{futures.tp1}</td><td className="nx-tp">{isShort ? '−' : '+'}{futures.rewardPct}%</td></tr>
                      <tr className="nx-f-tp2"><td>🚀 Take Profit 2</td><td>{futures.tp2}</td><td className="nx-tp">{isShort ? '−' : '+'}{(parseFloat(futures.rewardPct) * 1.8).toFixed(2)}%</td></tr>
                      <tr className="nx-f-sl"><td>🛑 Stop Loss</td><td>{futures.sl}</td><td className="nx-sl">{isShort ? '+' : '−'}{futures.riskPct}%</td></tr>
                      <tr className="nx-f-liq"><td>💀 Est. Liquidasi</td><td>{futures.liqEstimate}</td><td>pada {futures.leverage}×</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="nx-futures-note">R/R 1:{futures.rrRatio} · RSI {futures.rsi} · ATR {futures.atrPct}% · Support {futures.support} · Resistance {futures.resistance} · {futures.factors.join(' · ')}</div>
              </section>
            )}

            {/* ── Expert chart (TradingView) ── */}
            {selected && (
              <section className="nx-panel nx-chart" id="nx-chart">
                <SignalPriceChart symbol={selected.symbol} />
              </section>
            )}

            {/* ── Bottom row ── */}
            <section className="nx-bottom">
              <div className="nx-panel" id="nx-timeline">
                <div className="nx-ph"><div className="nx-pt">SIGNAL TIMELINE · ${selected.symbol}</div><div className="nx-meta">WHY NOW</div></div>
                <div className="nx-timeline">
                  {timeline.map((t, i) => (
                    <div className="nx-tl" key={i}><time>{t.time}</time><b>{t.tag}</b><span className={t.cls}>{t.text}</span></div>
                  ))}
                </div>
              </div>

              <div className="nx-panel">
                <div className="nx-ph"><div className="nx-pt">ACTIVE SIGNAL MAP</div><div className="nx-meta">VELOCITY</div></div>
                <div className="nx-tagcloud">
                  {Object.entries(signalCounts.counts).sort((a, b) => b[1] - a[1]).map(([key, n]) => (
                    <span key={key} className={n >= 8 ? 'hot' : n >= 4 ? 'rise' : ''}>{key.toUpperCase()} +{n}</span>
                  ))}
                </div>
              </div>

              <div className="nx-panel">
                <div className="nx-ph"><div className="nx-pt">SYSTEM ORCHESTRATOR</div><div className="nx-meta">MISSION CONTROL</div></div>
                <div className="nx-rows">
                  <div className="nx-srow"><span>Discovery</span><b className="nx-green">ONLINE</b><em>{totalScanned} scanned</em></div>
                  <div className="nx-srow"><span>Signal engine</span><b className="nx-green">ACTIVE</b><em>{activeSignals} signals</em></div>
                  <div className="nx-srow"><span>Timeframe</span><b className="nx-green">{timeframe.toUpperCase()}</b><em>live klines</em></div>
                  <div className="nx-srow"><span>Execution</span><b className="nx-yellow">DISABLED</b><em>analysis only</em></div>
                </div>
              </div>
            </section>

            <div className="nx-footer">
              AI SIGNAL · WHALERADAR AI · DECISION SUPPORT ONLY · REALTIME MARKET DATA · NO GUARANTEE OF PROFIT
            </div>
          </>
        )}
      </div>
    </div>
  )
}
