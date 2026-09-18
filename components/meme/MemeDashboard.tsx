"use client"

import { useEffect, useMemo, useState } from 'react'
import { usePaperTrader } from '../../lib/usePaperTrader'
import type { AutoPosition, AutoTraderState } from '../../lib/useAutoTrader'
import type { BrutalSignal, PendingOrder } from '../../lib/brutalEngine'

type Signal = { coinId: string; coinSymbol: string; signal: string; confidence: number; currentPrice: number; timestamp: string; marketRegime?: string; signalReason?: string }
type Decision = { agent: string; score: number; approved: boolean; reason: string; veto?: boolean }
type Candidate = { address: string; symbol: string; aiScore: number; price: number; narrative?: string }
type WhaleAlert = { id: string; symbol: string; direction: string; subtype: string; score: number; usdValue: number; label: string; demo: boolean }
const agentMeta = [
  ['SCANNER', 'new launches · anomalies', '#28e994'], ['NARRATIVE', 'trend · cultural velocity', '#b47cff'], ['WALLET', 'smart money · clusters', '#52b9ff'], ['STRUCTURE', 'order book · liquidity depth', '#ffc94d'], ['RISK', 'liquidity · drawdown veto', '#ff5968'],
] as const
// Berapa lama satu coin boleh "dipentaskan" di lantai setelah kelima agen
// menyatakan TIDAK layak eksekusi, sebelum fokus maju ke coin berikutnya.
// Tanpa jeda ini lantai akan berkedip tiap poll (4s) dan pipeline tidak terbaca.
const FOCUS_DWELL_MS = 12_000
// Objek stabil untuk fallback — kalau `{}` dibuat inline tiap render, identitasnya
// berubah terus dan seluruh rantai useMemo/useEffect di bawahnya ikut ter-recompute.
const NO_VERDICTS: Record<string, { pass: boolean; reason: string; at: string; signal: string; confidence: number }> = {}
const NO_POSITIONS: AutoPosition[] = []
// Endpoint bisa membalas objek error ({ error }) alih-alih array, atau array
// berisi null saat scan gagal. Saring di pintu masuk supaya `.coinId` / `.address`
// di bawah tidak pernah membaca undefined. Module scope = identitas stabil.
const rows = <T,>(value: unknown, key: keyof T): T[] => Array.isArray(value)
  ? value.filter((row): row is T => !!row && typeof row === 'object' && (row as T)[key] !== undefined && (row as T)[key] !== null)
  : []
const fmt = (n: number) => n >= 1 ? `$${n.toFixed(3)}` : `$${n.toFixed(6)}`
const usd = (n: number) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`
// Live "what am I checking right now" lines — always bound to the coin actually caught by the scanner.
function chatterFor(name: string, sym: string, detail: string, total: number, regime: string): string[] {
  const s = `$${sym}`
  switch (name) {
    case 'SCANNER': return [`${s} caught · ${detail}`, `checking ${s} launch freshness & volume spike…`, `ranking ${s} against ${total} live candidate${total === 1 ? '' : 's'}…`]
    case 'NARRATIVE': return [`reading ${s} trend & cultural velocity…`, `matching ${s} with ${regime} market regime…`, `measuring narrative momentum behind ${s}…`]
    case 'WALLET': return [`tracing smart-money clusters on ${s}…`, `checking whale inflow & OBV for ${s}…`, `scanning dev / bundler wallets of ${s}…`]
    case 'STRUCTURE': return [`mapping ${s} order book & liquidity depth…`, `validating ${s} entry range & R:R…`, `checking order-flow imbalance on ${s}…`]
    case 'RISK': return [`computing drawdown & liquidity veto for ${s}…`, `checking EV and stop distance on ${s}…`, `arming paper-safety gates before ${s} entry…`]
    default: return [`checking ${s}…`]
  }
}

export default function MemeDashboard() {
  const { state, acting, runAction, refetch } = usePaperTrader(4_000)
  const [signals, setSignals] = useState<Signal[]>([]), [candidates, setCandidates] = useState<Candidate[]>([]), [whaleAlerts, setWhaleAlerts] = useState<WhaleAlert[]>([]), [open, setOpen] = useState<Set<string>>(new Set()), [clock, setClock] = useState('')
  // `rows()` (module scope) menyaring respons API sebelum masuk state.
  useEffect(() => { const load = async () => { try { const [signalResponse, scannerResponse, whaleResponse] = await Promise.all([fetch('/api/crypto-scanner/signals', { cache: 'no-store' }), fetch('/api/meme-tokens?chain=solana&limit=12&sort=ai_score&min_liq=5000', { cache: 'no-store' }), fetch('/api/whale-alerts', { cache: 'no-store' })]); if (signalResponse.ok) setSignals(rows<Signal>(await signalResponse.json(), 'coinId')); if (scannerResponse.ok) { const data = await scannerResponse.json(); setCandidates(rows<Candidate>(data?.tokens, 'address')) } if (whaleResponse.ok) { const data = await whaleResponse.json(); setWhaleAlerts(rows<WhaleAlert>(data?.alerts, 'id')) } } catch {} }; load(); const id = setInterval(load, 15_000); return () => clearInterval(id) }, [])
  useEffect(() => { const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour12: false })); tick(); const id = setInterval(tick, 1_000); return () => clearInterval(id) }, [])
  const [tick, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 3_000); return () => clearInterval(id) }, [])
  // ── ANTRIAN BERJALAN ────────────────────────────────────────────────────────
  // Coin yang SUDAH masuk bucket OPEN POSITIONS tidak boleh muncul lagi di LIVE
  // SIGNAL QUEUE. Lantai lalu maju menilai coin berikutnya; kalau coin itu tidak
  // memenuhi kriteria eksekusi (ada veto / bukan 5/5), fokus maju lagi ke coin
  // setelahnya — terus berputar selama masih ada kandidat yang belum dieksekusi.
  const positions = state?.positions || NO_POSITIONS
  const held = useMemo(() => {
    const ids = new Set<string>(), syms = new Set<string>()
    positions.forEach(p => { if (!p) return; ids.add(p.coinId); syms.add(String(p.coinSymbol || '').toUpperCase()) })
    return (id: string, symbol: string) => ids.has(id) || syms.has(String(symbol || '').toUpperCase())
  }, [positions])
  const openSignals = useMemo(() => signals.filter(s => !held(s.coinId, s.coinSymbol)), [signals, held])
  const openCandidates = useMemo(() => candidates.filter(c => !held(c.address, c.symbol)), [candidates, held])
  const heldCount = signals.length - openSignals.length
  // "Tidak memenuhi kriteria eksekusi" diambil dari VONIS GERBANG penuh milik
  // paperTrader (`gateVerdicts`), bukan cuma konsensus 5 agen — gerbang juga
  // menolak sinyal basi, conf/R:R/EV di bawah batas, slippage, dan slot penuh.
  // Fallback ke konsensus agen dipakai hanya saat vonis belum terbit.
  const verdicts = state?.gateVerdicts || NO_VERDICTS
  const rejectedIds = useMemo(() => {
    const all = (state as any)?.agentDecisions || {}
    const out = new Set<string>()
    openSignals.forEach(s => {
      const v = verdicts[s.coinId]
      if (v) { if (!v.pass) out.add(s.coinId); return }
      const d: Decision[] = all[s.coinId] || []
      if (d.length >= agentMeta.length && (d.some(x => x.veto) || !d.every(x => x.approved))) out.add(s.coinId)
    })
    return out
  }, [openSignals, verdicts, state])
  // Urutan antrian: coin yang BELUM dinilai / LOLOS gerbang di atas, coin yang
  // sudah ditolak turun ke bawah. `sort` stabil → urutan confidence asli terjaga.
  // Efeknya lantai selalu memfokuskan "coin berikutnya yang masih mungkin
  // dieksekusi", persis seperti antrian scan yang berjalan maju.
  const ranked = useMemo(
    () => [...openSignals].sort((a, b) => Number(rejectedIds.has(a.coinId)) - Number(rejectedIds.has(b.coinId))),
    [openSignals, rejectedIds],
  )
  const [focus, setFocus] = useState<{ id: string; since: number } | null>(null)
  useEffect(() => {
    if (!ranked.length) { if (focus) setFocus(null); return }
    const at = focus ? ranked.findIndex(s => s.coinId === focus.id) : -1
    // Masih layak (belum selesai dinilai, atau lolos gerbang) → pertahankan fokus.
    if (at >= 0 && !rejectedIds.has(ranked[at].coinId)) return
    // Sudah ditolak → tunggu dwell habis supaya pipeline sempat terbaca, lalu maju.
    if (at >= 0 && focus && Date.now() - focus.since < FOCUS_DWELL_MS) return
    // Penerus: coin setelah fokus dulu (round-robin), baru yang di atasnya.
    const pool = at >= 0 ? [...ranked.slice(at + 1), ...ranked.slice(0, at)] : ranked
    // WAJIB: kalau hanya ada SATU kandidat dan ia ditolak, pool jadi kosong —
    // `pool[0]` undefined. Pertahankan fokus apa adanya; scan berikutnya yang
    // menambah kandidat akan memicu efek ini lagi.
    if (!pool.length) return
    const next = pool.find(s => !rejectedIds.has(s.coinId)) ?? pool[0]
    if (!next) return
    setFocus({ id: next.coinId, since: Date.now() })
  }, [ranked, rejectedIds, focus])
  const candidate = (focus ? ranked.find(s => s.coinId === focus.id) : undefined) || ranked[0] || null
  const queue = ranked.length ? ranked.slice(0, 5).map(signal => {
    const no = rejectedIds.has(signal.coinId)
    const why = verdicts[signal.coinId]?.reason
    return {
      id: signal.coinId, symbol: signal.coinSymbol, score: signal.confidence,
      detail: no ? `✕ ${why ? (why.length > 46 ? `${why.slice(0, 46)}…` : why) : 'tidak lolos gerbang'}` : `${signal.signal.toLowerCase()} · ${signal.marketRegime || 'scan'}`,
    }
  }) : openCandidates.slice(0, 5).map(token => ({ id: token.address, symbol: token.symbol, detail: `discovery · ${token.narrative || 'market'}`, score: token.aiScore }))
  // No coin caught yet => the floor stays silent, no bubble at all.
  const activeCoin = candidate
    ? { symbol: candidate.coinSymbol, detail: `${candidate.signal.toLowerCase()} · conf ${candidate.confidence}%`, routed: true }
    : queue[0] ? { symbol: queue[0].symbol, detail: queue[0].detail, routed: false } : null
  const decisions: Decision[] = candidate ? ((state as any)?.agentDecisions?.[candidate.coinId] || []) : []
  const getDecision = (name: string) => decisions.find(d => d.agent === name)
  // Alasan persis kenapa coin yang sedang dipentaskan lolos / ditolak gerbang.
  const verdictReason = candidate ? verdicts[candidate.coinId]?.reason : undefined
  // Sequential pipeline: SCANNER is always step 1; the next agent only starts
  // after the previous one reports. During pre-scan (discovery candidate, no
  // engine verdict yet) each step gets 2 ticks before handing over.
  const [stage, setStage] = useState(0)
  const [stageTick, setStageTick] = useState(0)
  useEffect(() => { setStage(0); setStageTick(tick) }, [activeCoin?.symbol])
  useEffect(() => {
    if (stage >= agentMeta.length) return
    const reported = decisions.find(x => x.agent === agentMeta[stage][0])
    if (reported ? tick > stageTick : tick - stageTick >= 2) { setStage(s => s + 1); setStageTick(tick) }
  }, [tick, stage, stageTick, decisions])
  const speaker = stage >= agentMeta.length ? tick % agentMeta.length : stage
  const passed = decisions.filter(d => d.approved).length
  const logs = state?.recentTrades || []
  const history = logs.filter(t => t.closedAt)
  const histWin = history.filter(t => t.pnlUsd >= 0).length
  const histPnl = history.reduce((sum, t) => sum + (t.pnlUsd || 0), 0)
  const allOpen = positions.length > 0 && open.size === positions.length
  const pnl = state?.totalPnl || 0
  const winRate = state?.stats.totalTrades ? state.stats.wins / state.stats.totalTrades * 100 : 0
  const gate = passed === 5 && !state?.circuitBreaker
  // ── SATU SALDO ─────────────────────────────────────────────────────────────
  // `balance` = kas nyata (modal + seluruh realized PnL dari sinyal NORMAL
  // maupun BRUTAL FUTURES). Equity = balance + unrealized posisi terbuka.
  const wallet = state?.wallet
  const balance = wallet?.balance ?? state?.balance ?? state?.totalEquity ?? 0
  const equityNow = wallet?.equity ?? state?.totalEquity ?? balance
  const usedMargin = wallet?.usedMargin ?? 0
  const freeMargin = wallet?.freeMargin ?? Math.max(0, balance - usedMargin)
  const realized = wallet?.realizedPnl ?? state?.stats?.realizedPnlUsd ?? balance - (wallet?.initialCapital ?? state?.capital ?? balance)
  const unrealized = wallet?.unrealizedPnl ?? state?.stats?.unrealizedPnlUsd ?? positions.reduce((sum, p) => sum + (p.pnlUsd || 0), 0)
  const capital = wallet?.initialCapital ?? state?.capital ?? 50
  const returnPct = wallet?.returnPct ?? (capital > 0 ? (equityNow - capital) / capital * 100 : 0)
  const bySource = wallet?.bySource ?? []
  const discoveryActivities = queue.length
    ? [
        { type: 'SCAN', message: `SCANNER reviewing ${queue.length} live Dex candidates · top: $${queue[0].symbol} · score ${queue[0].score}`, tone: 'good' as const },
        { type: 'NARRATIVE', message: 'NARRATIVE standby · step 2, starts after SCANNER reports', tone: 'warn' as const },
        { type: 'WALLET', message: 'WALLET standby · step 3, smart-money / whale-flow check', tone: 'warn' as const },
        { type: 'STRUCTURE', message: 'STRUCTURE standby · step 4, liquidity / order-flow / entry range', tone: 'warn' as const },
        { type: 'RISK', message: 'RISK standby · step 5, final veto before paper entry', tone: 'warn' as const },
      ]
    : [{ type: 'SCAN', message: 'SCANNER querying the live Dex market feed for eligible candidates', tone: 'warn' as const }]
  const toggle = (id: string) => setOpen(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(positions.map(p => p.coinId)))

  return <main className="cc-floor-app">
    <section className="cc-profile"><div className="cc-cover"><span>AUTONOMOUS PAPER TRADING · MONITORING TERMINAL</span><time className="cc-cover-clock">{clock}</time></div><div className="cc-profile-content"><div className="cc-avatar"><img src="/assets/ic_icon.png" alt="CrypyCrypt" /></div><div><h1>CrypyCrypt</h1><p>scanner · narrative · wallet intelligence · risk · structure · execution</p></div><div className="cc-profile-kpis"><Kpi label="SALDO" value={`$${balance.toFixed(2)}`} good={balance >= capital} /><Kpi label="SESSION PNL" value={usd(state?.dailyPnl || 0)} good={(state?.dailyPnl || 0) >= 0} /><Kpi label="BOT" value={state?.circuitBreaker ? 'SAFETY STOP' : state?.running ? 'HUNTING' : 'PAUSED'} good={!!state?.running} /></div><div className="cc-controls">{state?.circuitBreaker ? <button onClick={() => runAction('reset')}>RESET</button> : state?.running ? <button onClick={() => runAction('stop')}>PAUSE</button> : <button className="primary" onClick={() => runAction('start')}>{acting ? 'STARTING…' : 'START PAPER'}</button>}<button onClick={() => runAction('close-all')} disabled={!positions.length}>CLOSE ALL</button></div></div></section>
    <WalletStrip balance={balance} equity={equityNow} capital={capital} usedMargin={usedMargin} freeMargin={freeMargin} realized={realized} unrealized={unrealized} totalPnl={pnl} returnPct={returnPct} bySource={bySource} openCount={positions.length} />
    <section className="cc-metric-grid"><Kpi label="SALDO (KAS)" value={`$${balance.toFixed(2)}`} good={balance >= capital} /><Kpi label="EQUITY" value={`$${equityNow.toFixed(2)}`} good={equityNow >= capital} /><Kpi label="TOTAL PNL" value={`${usd(pnl)} · ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%`} good={pnl >= 0} /><Kpi label="MARGIN TERPAKAI" value={`$${usedMargin.toFixed(2)}`} warn={usedMargin > 0} /><Kpi label="WIN RATE" value={`${winRate.toFixed(1)}%`} /><Kpi label="DRAWDOWN" value={`${(state?.drawdownPct ?? 0).toFixed(1)}%`} good /></section>
    <BrutalPanel state={state} acting={acting} onToggle={() => runAction(state?.brutalMode === false ? 'brutal-on' : 'brutal-off')} />
    <div className="cc-main-grid"><section className="cc-panel"><PanelTitle title="AI AGENTS · MARKET HUNTING FLOOR" pill={gate ? '5/5 PASSED · READY' : !activeCoin ? 'PAPER BOT PAUSED' : `STEP ${Math.min(stage + 1, 5)}/5 · ${agentMeta[Math.min(stage, 4)][0]}`} /><div className="cc-stage">
      {/* Titik awal kawat harus mengikuti posisi character-nya. viewBox
          1000×650 + preserveAspectRatio="none" → y 1:1 dengan px (stage 650px),
          x diskalakan ke lebar stage (≈840px di container max-w-7xl).
          Path 1 = SCANNER→CORE: .cc-scanner left:60px top:418px → pusat bot
            x≈115px y≈445px → (138, 445).
          Path 5 = RISK→CORE: .cc-risk left:max(30%,232px) → pusat bot
            x≈307px y≈482px → (365, 510).
          Lihat catatan reposisi di styles/meme-terminal.css. */}
      <div className="cc-stage-grid" /><svg className="cc-wires" viewBox="0 0 1000 650" preserveAspectRatio="none"><path d="M138 445 Q290 432 440 320" /><path d="M365 90 Q415 220 440 320" /><path d="M610 145 Q550 245 440 320" /><path d="M605 500 Q515 405 440 320" /><path d="M365 510 Q405 415 440 320" /> <path className={gate ? 'hot' : ''} d="M440 320 Q650 300 810 360" /></svg>
      <div className="cc-queue"><div><b>LIVE {openSignals.length ? 'SIGNAL' : 'SCAN'} QUEUE</b><span>{queue.length} FOUND{heldCount ? ` · ${heldCount} SKIP (IN POSITION)` : ''}{(state as any)?.marketRegime ? ` · REGIME ${(state as any).marketRegime}` : ''}</span></div>{queue.map((item, i) => <div className={`cc-queue-item ${i === 0 ? 'active' : ''}`} key={item.id}><b>${item.symbol}</b><span>{item.detail}</span><em>{item.score}</em></div>)}{!queue.length && <small>{heldCount ? `Semua ${heldCount} sinyal live sudah jadi posisi · menunggu scan berikutnya…` : 'Scanning Binance + DexScreener live feed…'}</small>}</div>
      <div className="cc-whale-queue"><b>🐋 WHALE PRIORITY</b><span>{whaleAlerts.filter(alert => !alert.demo).length} LIVE</span>{whaleAlerts.slice(0, 3).map(alert => <div key={alert.id} className={alert.demo ? 'demo' : ''}><strong>${alert.symbol}</strong><small>{alert.direction.replace(/_/g, ' ').toLowerCase()}</small><em>{alert.demo ? 'DEMO' : alert.subtype.replace(/_/g, ' ')}</em></div>)}{!whaleAlerts.length && <small>Waiting for whale feed…</small>}</div>
      <div className="cc-route"><b>{candidate ? `$${candidate.coinSymbol}` : queue[0] ? `$${queue[0].symbol}` : 'WAITING'}</b> · {candidate ? `sequential pipeline · step ${Math.min(stage + 1, 5)}/5 ${agentMeta[Math.min(stage, 4)][0]}` : queue.length ? 'step 1/5 · SCANNER discovery in progress' : 'awaiting dynamic candidates'}</div>
      {agentMeta.map(([name, description, color], ai) => {
        const d = getDecision(name)
        const mode = !d ? 'think' : d.veto ? 'veto' : d.approved ? 'pass' : 'check'
        const turn = !!activeCoin && ai <= stage
        const talking = turn && ai === speaker
        const chatter = activeCoin ? chatterFor(name, activeCoin.symbol, activeCoin.detail, queue.length, (state as any)?.marketRegime || candidate?.marketRegime || 'neutral') : []
        const text = d ? d.reason : chatter[tick % chatter.length]
        const head = d ? `${mode === 'pass' ? '✓' : mode === 'veto' ? '✕' : '◦'} ${name} · ${activeCoin ? `$${activeCoin.symbol} · ` : ''}${d.score}` : `${name} · $${activeCoin?.symbol} · ${activeCoin?.routed ? 'ANALYZING' : 'PRE-SCAN'}`
        return <div className={`cc-agent cc-${name.toLowerCase()} ${d?.approved ? 'passed' : ''} ${talking && mode === 'think' ? 'working' : ''}`} key={name} style={{ '--agent': color } as React.CSSProperties}>
          {turn && activeCoin && <div className={`cc-bubble ${mode} ${talking ? 'talking' : 'mini'}`} key={`${activeCoin.symbol}-${mode}-${talking}-${text}`}>{talking ? <><b>{head}</b><span>{text}{mode !== 'pass' && mode !== 'veto' && <span className="cc-dots"><i /><i /><i /></span>}</span></> : mode === 'think' ? <span className="cc-dots"><i /><i /><i /></span> : <b>{mode === 'pass' ? '✓' : mode === 'veto' ? '✕' : '◦'}</b>}</div>}
          <div className="cc-bot"><i /><i /><u /></div><b>{name}</b><small>{description}</small><em>{d ? `${d.approved ? 'passed' : d.veto ? 'veto' : 'scoring'} · ${d.score}` : !activeCoin ? 'idle' : ai === stage ? 'working' : 'standby'}</em>
        </div>
      })}
      <div className={`cc-core ${gate ? 'armed' : ''}`}><i /><i /><div><b>{passed}/5</b><small>CONSENSUS</small></div><label>EXECUTION CORE</label><span>{agentMeta.map(([name, , color]) => <i className={getDecision(name)?.approved ? 'on' : ''} key={name} style={{ '--agent': color } as React.CSSProperties} />)}</span></div>
      <div className={`cc-gate ${gate ? 'armed' : ''}`}><i /><i /><u /><label>EXECUTION GATE</label></div><div className={`cc-status ${gate ? 'ok' : ''}`}><b>{gate ? 'READY TO SIMULATE' : state?.circuitBreaker ? 'SAFETY STOP' : 'HUNTING'}</b><small>{verdictReason || candidate?.signalReason || 'Signals are assessed independently before paper entry.'}</small></div>
      <div className="cc-legend"><b>AGENT STATUS · PIPELINE ORDER</b>{agentMeta.map(([name,,color], li) => { const d = getDecision(name); const now = !!activeCoin && li === stage && !d; return <div key={name} className={now ? 'now' : ''}><i style={{ background: color }} /><span>{li + 1}. {name[0] + name.slice(1).toLowerCase()}</span><strong className={d?.approved ? 'pass' : ''}>{d?.veto ? 'VETO' : d?.approved ? 'PASSED' : d ? 'CHECK' : now ? 'WORKING' : 'WAIT'}</strong></div> })}</div>
    </div></section>
    <section className="cc-panel cc-feed"><div className="cc-feed-title"><PanelTitle title="OPEN POSITIONS" pill={`${positions.length} OPEN · MARGIN $${usedMargin.toFixed(2)} · SISA $${freeMargin.toFixed(2)}`} /><button onClick={toggleAll}>{allOpen ? 'Collapse all' : 'Expand all'}</button></div><div className="cc-positions cc-scroll">{positions.length ? positions.map(position => <Position key={position.coinId} position={position} expanded={open.has(position.coinId)} onToggle={() => toggle(position.coinId)} />) : <div className="cc-empty">No open paper positions.<br />Setiap trade (normal maupun brutal futures) masuk ke sini dulu, lalu pindah ke POSITION HISTORY saat ditutup SL/TP/trailing/likuidasi.</div>}</div>
      <PanelTitle title="POSITION HISTORY" pill={`${history.length} TRADES · ${histWin}W/${history.length - histWin}L · ${usd(histPnl)} MASUK SALDO`} /><div className="cc-history cc-scroll">{history.length ? history.map((trade, index) => <div className="cc-trade" key={`${trade.coinId}-${trade.closedAt}-${index}`}><div className="cc-trade-top"><b>${trade.coinSymbol}</b><span className={`side ${trade.side === 'LONG' ? 'long' : 'short'}`}>{trade.side}</span>{(trade.leverage ?? 1) > 1 && <span className="lev">{trade.leverage}×</span>}<span className={`src ${trade.source === 'brutal-futures' ? 'brutal' : 'normal'}`}>{trade.source === 'brutal-futures' ? 'BRUTAL' : trade.source === 'paper-test-dex' ? 'DEX' : 'NORMAL'}</span><em className={trade.pnlUsd >= 0 ? 'pos' : 'neg'}>{trade.pnlUsd >= 0 ? '+' : ''}{(trade.pnlPct ?? 0).toFixed(2)}% ROE</em><strong className={trade.pnlUsd >= 0 ? 'pos' : 'neg'}>{usd(trade.pnlUsd)}</strong></div><div className="cc-trade-mid"><i className="buy">{trade.side === 'SHORT' ? 'OPEN SHORT' : 'BUY'} {fmt(trade.entryPrice)}</i><u>→</u><i className="sell">{trade.side === 'SHORT' ? 'CLOSE SHORT' : 'SELL'} {fmt(trade.exitPrice)}</i>{trade.marginUsd ? <span>margin ${trade.marginUsd.toFixed(2)}{trade.sizeUsd ? ` · notional $${trade.sizeUsd.toFixed(2)}` : ''}</span> : trade.sizeUsd ? <span>size ${trade.sizeUsd.toFixed(2)}</span> : null}</div><div className="cc-trade-bot"><time>{new Date(trade.closedAt || trade.openedAt || Date.now()).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time><span>{trade.reason}</span></div></div>) : <div className="cc-empty">No closed trades yet.<br />Setiap posisi yang ditutup (SL / TP / trailing / likuidasi / manual) otomatis pindah ke sini dan P&L-nya masuk ke satu saldo.</div>}</div>
      <PanelTitle title="ACTIVITY LOG" pill="STREAM" /><div className="cc-log-list cc-scroll">{state?.activities?.length ? state.activities.slice(0, 40).map((event, index) => <div className="cc-log" key={`${event.time}-${index}`}><time>{new Date(event.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time><b className={event.tone === 'bad' ? 'neg' : event.tone === 'good' ? 'pos' : ''}>{event.type}</b><span>{event.message}</span><em className={event.tone === 'bad' ? 'neg' : event.tone === 'good' ? 'pos' : ''}>{event.tone === 'bad' ? '×' : event.tone === 'good' ? '✓' : '·'}</em></div>) : discoveryActivities.map((event, index) => <div className="cc-log" key={event.type}><time>LIVE</time><b className={event.tone === 'good' ? 'pos' : ''}>{event.type}</b><span>{event.message}</span><em className={event.tone === 'good' ? 'pos' : ''}>{index === 0 ? '✓' : '·'}</em></div>)}</div></section></div>
  </main>
}

function Kpi({ label, value, good, warn }: { label: string; value: string; good?: boolean; warn?: boolean }) { return <div className="cc-kpi"><label>{label}</label><b className={good ? 'good' : warn ? 'warn' : ''}>{value}</b></div> }
function PanelTitle({ title, pill }: { title: string; pill: string }) { return <div className="cc-panel-title"><div><i /><b>{title}</b></div><span>{pill}</span></div> }
// ROE = return atas MARGIN yang dikunci dari satu saldo (bukan atas notional),
// jadi posisi brutal futures 10× dan posisi normal 1× sama-sama terbaca adil.
function Position({ position, expanded, onToggle }: { position: any; expanded: boolean; onToggle: () => void }) {
  const plus = position.pnlUsd >= 0
  const leverage = position.leverage ?? 1
  const margin = position.marginUsd ?? (leverage > 0 ? (position.notionalUsd ?? position.sizeUsd ?? 0) / leverage : 0)
  const notional = position.notionalUsd ?? position.sizeUsd ?? 0
  const roe = margin > 0 ? position.pnlUsd / margin * 100 : 0
  const brutal = position.source === 'brutal-futures'
  return <article className={`cc-position ${brutal ? 'brutal' : ''}`}><button onClick={onToggle}><b>${position.coinSymbol}</b><span className={`side ${position.side === 'LONG' ? 'long' : 'short'}`}>{position.side}</span>{leverage > 1 && <span className="lev">{leverage}×</span>}<span className={`src ${brutal ? 'brutal' : 'normal'}`}>{brutal ? 'BRUTAL' : position.source === 'paper-test-dex' ? 'DEX' : 'NORMAL'}</span><em className={plus ? 'pos' : 'neg'}>{plus ? '+' : ''}{roe.toFixed(2)}% ROE</em><i className={expanded ? 'up' : ''}>⌄</i><small>entry {fmt(position.entryPrice)} · margin ${margin.toFixed(2)} · notional ${notional.toFixed(2)} · {usd(position.pnlUsd)}</small></button>{expanded && <div className="cc-position-data"><Data label="ENTRY" value={fmt(position.entryPrice)} /><Data label="CURRENT" value={fmt(position.currentPrice)} tone={plus ? 'pos' : 'neg'} /><Data label="STOP LOSS" value={fmt(position.stopLoss)} tone="neg" /><Data label="TAKE PROFIT" value={fmt(position.tp1)} tone="pos" /><Data label="MARGIN (DIKUNCI)" value={`$${margin.toFixed(2)}`} tone="warn" /><Data label={`NOTIONAL ${leverage > 1 ? `(${leverage}×)` : ''}`} value={`$${notional.toFixed(2)}`} /><Data label="LIKUIDASI" value={position.liquidationPrice ? fmt(position.liquidationPrice) : 'n/a (1×)'} tone={position.liquidationPrice ? 'neg' : ''} /><Data label="UNREALIZED" value={`${usd(position.pnlUsd)} · ${roe >= 0 ? '+' : ''}${roe.toFixed(2)}%`} tone={plus ? 'pos' : 'neg'} /></div>}</article>
}
function Data({ label, value, tone = '' }: { label: string; value: string; tone?: string }) { return <div><label>{label}</label><b className={tone}>{value}</b></div> }

// ── SATU SALDO UNTUK SEMUA SUMBER ────────────────────────────────────────────
// Menegaskan bahwa sinyal NORMAL (live engine / DEX, 1×) dan BRUTAL FUTURES
// (2–20×) memakai dompet yang sama: satu `balance`, margin dikunci dari situ,
// dan tiap close mengembalikan margin + PnL ke saldo yang sama. Rincian per
// sumber hanya pembukuan, bukan saldo terpisah.
function WalletStrip({ balance, equity, capital, usedMargin, freeMargin, realized, unrealized, totalPnl, returnPct, bySource, openCount }: {
  balance: number; equity: number; capital: number; usedMargin: number; freeMargin: number
  realized: number; unrealized: number; totalPnl: number; returnPct: number
  bySource: Array<{ key: string; source: string; realized: number; unrealized: number; margin: number; trades: number; wins: number; losses: number; openPositions: number }>
  openCount: number
}) {
  return <section className="cc-panel cc-wallet">
    <PanelTitle title="SATU SALDO · NORMAL + BRUTAL FUTURES" pill={`MODAL $${capital.toFixed(2)} → SALDO $${balance.toFixed(2)} · ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`} />
    <div className="cc-wallet-main">
      <div className="cc-wallet-hero">
        <label>SALDO (KAS)</label>
        <b className={balance >= capital ? 'pos' : 'neg'}>${balance.toFixed(2)}</b>
        <small>modal ${capital.toFixed(2)} + realized {usd(realized)}</small>
      </div>
      <div className="cc-wallet-cells">
        <Data label="EQUITY" value={`$${equity.toFixed(2)}`} tone={equity >= capital ? 'pos' : 'neg'} />
        <Data label="REALIZED PNL" value={usd(realized)} tone={realized >= 0 ? 'pos' : 'neg'} />
        <Data label="UNREALIZED PNL" value={usd(unrealized)} tone={unrealized >= 0 ? 'pos' : 'neg'} />
        <Data label="TOTAL PNL" value={`${usd(totalPnl)} · ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`} tone={totalPnl >= 0 ? 'pos' : 'neg'} />
        <Data label="MARGIN TERKUNCI" value={`$${usedMargin.toFixed(2)}`} tone="warn" />
        <Data label="MARGIN BEBAS" value={`$${freeMargin.toFixed(2)}`} tone={freeMargin > 0.1 ? 'pos' : 'neg'} />
      </div>
    </div>
    <div className="cc-wallet-src">
      {bySource.length ? bySource.map(src => {
        const net = src.realized + src.unrealized
        return <div className={`cc-wallet-row ${src.key}`} key={src.key}>
          <b>{src.source}</b>
          <span>{src.trades} trade · {src.wins}W/{src.losses}L</span>
          <span>{src.openPositions} open{src.margin > 0 ? ` · margin $${src.margin.toFixed(2)}` : ''}</span>
          <em className={net >= 0 ? 'pos' : 'neg'}>{usd(net)}</em>
        </div>
      }) : <div className="cc-wallet-row empty"><b>BELUM ADA HASIL</b><span>Start Paper — tiap entry mengunci margin dari saldo ini, tiap close mengembalikannya plus PnL.</span><em>{usd(0)}</em></div>}
    </div>
    <div className="cc-wallet-note">Margin terpakai ${usedMargin.toFixed(2)} dari saldo ${balance.toFixed(2)} · bebas ${freeMargin.toFixed(2)} · {openCount} posisi terbuka. Rugi dibatasi sebesar margin (isolated) sehingga sisa saldo tetap aman.</div>
  </section>
}

// ── BRUTAL FUTURES ──────────────────────────────────────────────────────────
// Panel hasil scan perpetual Binance: arah LONG/SHORT/NETRAL per coin plus
// keputusan "boleh dieksekusi sekarang atau harus tunggu" — badge yang sama
// seperti menu Crypto Scanner → SIGNAL pada referensi crypto-scanner.
const brutalStatusMeta: Record<string, { cls: string; tag: string }> = {
  EXECUTE: { cls: 'execute', tag: 'EKSEKUSI' },
  WAIT_BREAKOUT: { cls: 'wait', tag: 'TUNGGU BREAKOUT' },
  WAIT_PULLBACK: { cls: 'wait', tag: 'TUNGGU PULLBACK' },
  WEAK: { cls: 'weak', tag: 'SINYAL LEMAH' },
  NEUTRAL: { cls: 'neutral', tag: 'NETRAL' },
}
const pct = (n: number | null | undefined, digits = 2) => n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`
const rat = (n: number | null | undefined, digits = 2) => n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(digits)
const compact = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`
const BRUTAL_FILTERS = ['ALL', 'EXECUTE', 'WAIT', 'NEUTRAL'] as const
type BrutalFilter = typeof BRUTAL_FILTERS[number]

function BrutalPanel({ state, acting, onToggle }: { state: AutoTraderState | null; acting: string | null; onToggle: () => void }) {
  const signals: BrutalSignal[] = state?.brutalSignals || []
  const pending: PendingOrder[] = state?.pendingOrders || []
  const stats = state?.brutalStats
  const on = state?.brutalMode !== false
  const [filter, setFilter] = useState<BrutalFilter>('ALL')
  const [openRows, setOpenRows] = useState<Set<string>>(new Set())
  const shown = signals.filter(s => filter === 'ALL' ? true
    : filter === 'EXECUTE' ? s.executable
    : filter === 'WAIT' ? s.status === 'WAIT_BREAKOUT' || s.status === 'WAIT_PULLBACK' || s.status === 'WEAK'
    : s.side === 'NEUTRAL')
  const toggleRow = (id: string) => setOpenRows(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const pill = !on ? 'BRUTAL OFF' : !signals.length ? 'SCANNING PERPETUAL…'
    : `${stats?.execute ?? 0} EKSEKUSI · ${stats?.waiting ?? 0} TUNGGU · ${stats?.pending ?? 0} PENDING`
  return <section className="cc-panel cc-brutal">
    <div className="cc-brutal-head">
      <PanelTitle title="BRUTAL FUTURES · LONG / SHORT + GERBANG EKSEKUSI" pill={pill} />
      <div className="cc-brutal-tools">
        {BRUTAL_FILTERS.map(f => <button key={f} className={`cc-brutal-chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f === 'ALL' ? `SEMUA ${signals.length}` : f === 'EXECUTE' ? `⚡ ${stats?.execute ?? 0}` : f === 'WAIT' ? `⏳ ${stats?.waiting ?? 0}` : `⚪ ${stats?.neutral ?? 0}`}</button>)}
        <button className={`cc-brutal-switch ${on ? 'on' : ''}`} onClick={onToggle} disabled={!!acting}>{on ? 'BRUTAL ON' : 'BRUTAL OFF'}</button>
      </div>
    </div>
    <div className="cc-brutal-src"><span>{state?.brutalSource || 'BRUTAL FUTURES · booting…'}</span><em>regime {(state?.brutalRegime || 'range').toUpperCase()}{state?.brutalScannedAt ? ` · scan ${new Date(state.brutalScannedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}</em></div>
    <div className="cc-brutal-stats">
      <MiniStat label="LONG" value={String(stats?.long ?? 0)} tone="pos" />
      <MiniStat label="SHORT" value={String(stats?.short ?? 0)} tone="neg" />
      <MiniStat label="NETRAL" value={String(stats?.neutral ?? 0)} />
      <MiniStat label="LAYAK EKSEKUSI" value={String(stats?.execute ?? 0)} tone="pos" />
      <MiniStat label="TUNGGU TRIGGER" value={String(stats?.waiting ?? 0)} tone="warn" />
      <MiniStat label="PENDING ORDER" value={String(stats?.pending ?? 0)} tone="warn" />
      <MiniStat label="TRIGGERED" value={String(stats?.triggered ?? 0)} tone="pos" />
    </div>
    <div className="cc-brutal-body">
      <div className="cc-brutal-list cc-scroll">
        {shown.length ? shown.map(s => {
          const meta = brutalStatusMeta[s.status] || brutalStatusMeta.WEAK
          const isOpen = openRows.has(s.symbol)
          return <article className={`cc-brutal-row ${meta.cls}`} key={s.symbol}>
            <button className="cc-brutal-main" onClick={() => toggleRow(s.symbol)}>
              <span className={`cc-brutal-side ${s.side.toLowerCase()}`}>{s.side === 'LONG' ? '▲' : s.side === 'SHORT' ? '▼' : '⚪'} {s.side}</span>
              <b className="cc-brutal-sym">${s.coinSymbol}</b>
              <em className="cc-brutal-price">{fmt(s.price)}</em>
              <span className={`cc-brutal-chg ${s.change24h >= 0 ? 'pos' : 'neg'}`}>{pct(s.change24h)}</span>
              <span className="cc-brutal-score">SKOR {s.score >= 0 ? '+' : ''}{s.score.toFixed(1)}</span>
              <span className="cc-brutal-conf">CONF {s.confidence.toFixed(0)}%</span>
              <span className={`cc-brutal-badge ${meta.cls}`}>{s.statusLabel}</span>
              <i className={`cc-brutal-caret ${isOpen ? 'up' : ''}`}>⌄</i>
            </button>
            <div className="cc-brutal-hint">{s.statusHint}</div>
            {isOpen && <div className="cc-brutal-detail">
              <div className="cc-brutal-grid">
                <Data label="ENTRY" value={fmt(s.entry)} />
                <Data label="TRIGGER" value={s.triggerPrice ? fmt(s.triggerPrice) : '—'} tone="warn" />
                <Data label="STOP LOSS" value={fmt(s.stopLoss)} tone="neg" />
                <Data label="TP1" value={fmt(s.tp1)} tone="pos" />
                <Data label="TP2" value={fmt(s.tp2)} tone="pos" />
                <Data label="R:R" value={`${s.rr.toFixed(2)}`} />
                <Data label="LEVERAGE" value={`${s.leverage}×`} />
                <Data label="RSI 15m" value={s.rsi.toFixed(1)} tone={s.rsi >= 70 ? 'neg' : s.rsi <= 30 ? 'pos' : ''} />
                <Data label="ATR %" value={`${s.atrPct.toFixed(2)}%`} />
                <Data label="FUNDING" value={pct(s.fundingPct, 4)} tone={(s.fundingPct ?? 0) > 0.01 ? 'neg' : (s.fundingPct ?? 0) < -0.01 ? 'pos' : ''} />
                <Data label="Δ OI 15m" value={pct(s.oiChangePct)} tone={(s.oiChangePct ?? 0) >= 0 ? 'pos' : 'neg'} />
                <Data label="OI BIAS" value={s.oiBias || '—'} />
                <Data label="TOP TRADER L/S" value={rat(s.topLsr)} tone={(s.topLsr ?? 1) >= 1 ? 'pos' : 'neg'} />
                <Data label="TAKER B/S" value={rat(s.takerRatio)} tone={(s.takerRatio ?? 1) >= 1 ? 'pos' : 'neg'} />
                <Data label="HTF 1h" value={s.htfAligned ? 'SEARAH' : 'TIDAK'} tone={s.htfAligned ? 'pos' : 'neg'} />
                <Data label="STRUCTURE" value={s.structure || '—'} />
                <Data label="SUPPORT" value={fmt(s.support)} />
                <Data label="RESISTANCE" value={fmt(s.resistance)} />
                <Data label="VOL 24H" value={compact(s.volume24h)} />
                <Data label="SYMBOL" value={s.symbol} />
              </div>
              {!!s.factors?.length && <div className="cc-brutal-factors"><b>FAKTOR PENILAIAN</b><div>{s.factors.map((f, i) => <span key={i}>{f}</span>)}</div></div>}
            </div>}
          </article>
        }) : <div className="cc-empty">{on
          ? <>Menunggu hasil scan perpetual Binance…<br />Universe = top USDT-M perp dengan volume 24h ≥ $5M.</>
          : <>BRUTAL MODE nonaktif.<br />Nyalakan untuk menganalisa futures LONG/SHORT + gerbang eksekusi.</>}</div>}
      </div>
      <div className="cc-brutal-side-col">
        <PanelTitle title="PENDING ORDERS" pill={`${pending.filter(p => p.status === 'PENDING').length} AKTIF · ${pending.filter(p => p.status === 'TRIGGERED').length} TRIGGERED`} />
        <div className="cc-pending-list cc-scroll">
          {pending.length ? pending.map(p => <div className={`cc-pending ${p.status.toLowerCase()}`} key={p.id}>
            <div className="cc-pending-top"><span className={`cc-brutal-side ${p.side.toLowerCase()}`}>{p.side === 'LONG' ? '▲' : '▼'} {p.side}</span><b>${p.coinSymbol}</b><em className={p.status === 'TRIGGERED' ? 'pos' : p.status === 'EXPIRED' ? 'neg' : 'warn'}>{p.status}</em></div>
            <div className="cc-pending-mid"><span>trigger <u>{fmt(p.triggerPrice)}</u></span><span>live <u>{fmt(p.lastPrice)}</u></span><span className={p.distancePct >= 0 ? 'pos' : 'neg'}>{pct(p.distancePct)}</span></div>
            <div className="cc-pending-bot"><span>SL {fmt(p.stopLoss)}</span><span>TP {fmt(p.tp1)} / {fmt(p.tp2)}</span><span>RR {p.rr.toFixed(1)}</span></div>
            <small>{p.reason}</small>
          </div>) : <div className="cc-empty">Belum ada pending order.<br />Setup “⏳ Tunggu di $X” otomatis dipantau di sini dan naik jadi EKSEKUSI saat trigger tersentuh.</div>}
        </div>
      </div>
    </div>
  </section>
}
function MiniStat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) { return <div className="cc-brutal-stat"><label>{label}</label><b className={tone}>{value}</b></div> }
