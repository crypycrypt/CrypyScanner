// ══════════════════════════════════════════════════════════════════════════
//  PAPER TRADER — demo execution engine fed by REAL live signal scanning.
//
//  Signal sources (in priority order):
//    1. LIVE ENGINE  — lib/signalEngine.ts: real Binance data (ticker + 1h/4h
//       klines) through 13 quant engines ported 1:1 from crypto-scanner's
//       signal-bot.js + sniper-scanner.js (structure, BOS/CHoCH, liquidity,
//       supply/demand, volume profile, order flow, whale OBV proxy,
//       volatility, Monte Carlo, RSI+MACD+EMA, RSI divergence, Bayesian
//       posterior, sniper confluence) with Kelly + EV + HTF + regime gates.
//    2. DEX FALLBACK — live DexScreener discovery (top Solana pairs) so the
//       five-agent pipeline stays observable when the Binance universe
//       produces zero qualified setups (quiet market).
//
//  Every step is logged into `activities`: engine scan cycles, per-signal
//  discovery, each of the five agent verdicts, every hard-gate rejection,
//  paper entries with full sizing math, trailing-stop activation, exits and
//  circuit-breaker trips. The last raw scan report (per-coin check lines for
//  the whole universe) is exposed via `scanReport` in the snapshot.
// ══════════════════════════════════════════════════════════════════════════
import { peekLiveSignals, type LiveSignal, type ScanReport } from './signalEngine'
import { tickBrutal, type BrutalSignal, type PendingOrder } from './brutalEngine'
import { fetchJsonResilient } from './binanceDns'
import { notifyTelegram } from './telegramNotify'
import { dispatchBrutalAlerts } from './brutalTelegramAlert'

type Signal = {
  timestamp: string; coinId: string; coinSymbol: string; signal: 'LONG' | 'SHORT' | 'NEUTRAL'
  confidence: number; bullish: number; bearish: number; rr: number; expectedValue?: number
  kellyFraction?: number; currentPrice: number; entryLow: number; entryHigh: number
  stopLoss: number; tp1: number; tp2?: number; tp3?: number; marketRegime?: string; htfAligned?: boolean
  whaleScore?: number; whaleBias?: string; sniperScore?: number; volatilityScore?: number
  // ── MILESTONE 2 · REFERENCE MERGE (signal-bot.js): konteks struktur & likuiditas.
  // Diisi live engine; brutal mengisi swingTrend. Semua optional agar sinyal DEX
  // fallback tetap kompatibel. Dipakai agen STRUCTURE & RISK di evaluateAgents().
  structureQuality?: number; patternConfidence?: number; sweepProbability?: number
  buySideLiq?: number | null; sellSideLiq?: number | null
  delta24h?: number; imbalance24h?: number
  mcP10?: number; mcP90?: number
  volumeNodes?: { hvn: number[]; lvn: number[] }
  swingTrend?: string
  subScores?: Array<{ label: string; score: number; weight: number }>
  source?: 'live-signal-engine' | 'paper-test-dex' | 'brutal-futures'
  pairAddress?: string
  // Leverage khusus sinyal futures (BRUTAL MODE). Sinyal normal/DEX = 1× (spot-like).
  leverage?: number
}

export type AgentDecision = { agent: 'SCANNER' | 'NARRATIVE' | 'WALLET' | 'STRUCTURE' | 'RISK'; score: number; approved: boolean; reason: string; veto?: boolean }
export type Activity = { time: string; type: 'SCAN' | 'AGENT' | 'VETO' | 'ENTRY' | 'EXIT'; message: string; tone?: 'good' | 'warn' | 'bad' }

export type PaperPosition = {
  coinId: string; coinSymbol: string; side: string; entryPrice: number; currentPrice: number
  pnlUsd: number; sizeUsd: number; stopLoss: number; tp1: number; tp2: number
  trailActive: boolean; tp1Hit: boolean; tp2Hit: boolean; openedAt: string; quantity: number
  pairAddress?: string; source?: string
  // ── MARGIN ACCOUNTING (SATU SALDO BERSAMA) ────────────────────────────────
  // `sizeUsd` = notional (margin × leverage). `marginUsd` adalah bagian dari
  // `balance` yang dikunci saat entry dan dilepas lagi saat close, sehingga
  // sinyal normal (1×) maupun brutal futures (2–10×) memakai dompet yang sama.
  leverage: number; marginUsd: number; notionalUsd: number; liquidationPrice: number | null
}
type Trade = {
  coinId: string; coinSymbol: string; side: string; entryPrice: number; exitPrice: number
  pnlUsd: number; pnlPct: number; reason: string; openedAt: string; closedAt: string
  sizeUsd: number; source?: string; leverage: number; marginUsd: number
}
// Akumulasi hasil trading per sumber sinyal. Semuanya mengalir ke SATU `balance`;
// tabel ini hanya rincian supaya terlihat sumber mana yang menyumbang PnL.
export type SourcePnl = {
  key: string; source: string; realized: number; unrealized: number; margin: number
  trades: number; wins: number; losses: number; openPositions: number
}
export type Wallet = {
  initialCapital: number; balance: number; equity: number; usedMargin: number; freeMargin: number
  realizedPnl: number; unrealizedPnl: number; totalPnl: number; returnPct: number; bySource: SourcePnl[]
}
/**
 * Vonis GERBANG EKSEKUSI untuk satu coin — hasil akhir `valid()`, bukan sekadar
 * konsensus 5 agen. Dashboard memakainya untuk memutuskan apakah lantai harus
 * berhenti menampilkan coin ini dan lanjut menilai coin berikutnya:
 * `pass:false` = tidak memenuhi kriteria eksekusi, lengkap dengan alasan persis.
 */
export type GateVerdict = { pass: boolean; reason: string; at: string; signal: string; confidence: number }

type EngineState = {
  running: boolean; started: boolean; circuitBreaker: boolean; capital: number; balance: number
  peakEquity: number; dailyPnl: number; positions: Record<string, PaperPosition>; recentTrades: Trade[]
  processed: Set<string>; consecutiveLoss: number; lastTick: number; agentDecisions: Record<string, AgentDecision[]>
  gateVerdicts: Record<string, GateVerdict>
  activities: Activity[]; activityKeys: Set<string>; scanReport: ScanReport | null; lastReportAt: string; signalSource: string
  // BRUTAL FUTURES MODE
  brutalMode: boolean; brutalSignals: BrutalSignal[]; pendingOrders: PendingOrder[]
  brutalStats: BrutalStats | null; brutalRegime: string; brutalScannedAt: string; brutalSource: string; lastBrutalAt: string
  // realized PnL kumulatif per sumber (tidak ikut terpotong saat recentTrades di-trim)
  sourcePnl: Record<string, { realized: number; trades: number; wins: number; losses: number }>
}
type BrutalStats = { total: number; long: number; short: number; neutral: number; execute: number; waiting: number; pending: number; triggered: number }

// PAPER_TEST is deliberately permissive so the full pipeline can be observed
// with small test capital. Do not reuse these thresholds for live execution.
//
// ── MILESTONE 1 · FRESHNESS (angka punya justifikasi, bukan tuning sembarang) ──────
// maxSignalAgeMin 120 → 20 (non-brutal): live engine membangun sinyal dari
// structure 1h (BOS/CHoCH/liquidity) + HTF 4h dengan cache scan 4 menit dan
// heartbeat 15 detik. Setup yang masih valid DITERBITKAN ULANG dengan timestamp
// baru tiap siklus cache, jadi sinyal yang bertahan >20m (≈5 siklus) tanpa
// refresh berarti konteks candle 1h-nya sudah berganti — 20m = ⅓ candle LTF,
// pembacaan structure masih ter-anchor pada candle yang sedang berjalan.
// Batas lama 120m mengizinkan entry di atas structure berusia 2 candle penuh
// (BOS bisa sudah retracement total, SL/TP dari 2 candle lalu tidak relevan).
// DEX fallback refresh tiap 30s → tidak pernah menyentuh batas ini.
// Brutal futures tetap 120m (maxSignalAgeBrutalMin): mekanisme pending order-nya
// memang dirancang menunggu trigger tersentuh (pendingTtlMin 240, cache 90s,
// timestamp selalu segar), jadi batas umur di sana hanya jaring pengaman.
// Slippage: adverse 1.5% ≈ titik di mana R:R efektif setup tipikal (SL 3% /
// TP1 6%, R:R 2.0) jatuh ke (6−1.5)/(3+1.5) = 1.0 — di bawah gate minRR 1.1;
// favorable 3% = 2× filter universe |Δ24h| 1.5% dalam ≤20m → pergeseran rezim,
// bukan noise. R:R efektif SELALU dihitung ulang di harga live (gate adaptif
// per sinyal); persen tetap hanyalah backstop untuk setup ber-stop lebar.
//
// ── SLOT POSISI 2 → 5 (permintaan user) ─────────────────────────────────────────
// Aman terhadap margin tanpa mengubah struktur accounting (prinsip #2):
// notional = min(riskUsd/stopDistance, freeMargin×leverage, equity×maxNotionalX)
// ⇒ marginUsd = notional/leverage ≤ freeMargin — margin bebas TIDAK PERNAH
// negatif berapa pun slotnya; kalau saldo habis, veto deterministik `free < .1`
// di open() yang menolak entry (bukan slot). Risiko per posisi tidak berubah
// (≤ maxRiskPct 1.25% equity), jadi worst case 5 posisi stop-out serentak =
// 6.25% equity — itu melewati maxDailyLossPct 5%, artinya circuit breaker harian
// trip & engine berhenti sebelum kerugian berlanjut (backstop yang memang
// dirancang untuk skenario ini); maxDrawdownPct 8% tetap memagari di atasnya.
// Semua konsumen (gate valid(), log open(), command start, snapshot config)
// membaca CONFIG.maxPositions dinamis → satu perubahan ini merambat ke semuanya.
const CONFIG = { profile: 'PAPER_TEST', capital: 50, riskPct: .75, maxRiskPct: 1.25, maxPositions: 5, maxDailyLossPct: 5, maxDrawdownPct: 8, maxConsecutiveLoss: 3, minConfidence: 42, minBullish: 52, minBearish: 52, minRR: 1.1, maxSignalAgeMin: 20, maxSignalAgeBrutalMin: 120, maxAdverseSlippagePct: 1.5, maxFavorableSlippagePct: 3, slippageFallbackAgeMin: 5, maxStopDistancePct: 20, trailActivatePct: 1.2, trailDistancePct: .7, maxNotionalX: 6, maxLeverage: 20, blownEquityPct: 2 }
// Batas umur sinyal per sumber (lihat justifikasi MILESTONE 1 di atas).
const maxAgeFor = (signal: Signal) => signal.source === 'brutal-futures' ? CONFIG.maxSignalAgeBrutalMin : CONFIG.maxSignalAgeMin
const usd = (value: number) => `${value >= 0 ? '+' : '-'}$${Math.abs(value).toFixed(2)}`
const globalKey = '__crypycryptPaperTrader__' as const
const store = globalThis as typeof globalThis & { [globalKey]?: EngineState }
let discoveryCache: { signals: Signal[]; updatedAt: number } = { signals: [], updatedAt: 0 }
function state(): EngineState {
  const s = store[globalKey] ??= {
    running: false, started: false, circuitBreaker: false, capital: CONFIG.capital, balance: CONFIG.capital,
    peakEquity: CONFIG.capital, dailyPnl: 0, positions: {}, recentTrades: [], processed: new Set(),
    consecutiveLoss: 0, lastTick: 0, agentDecisions: {}, gateVerdicts: {}, activities: [], activityKeys: new Set(),
    scanReport: null, lastReportAt: '', signalSource: 'LIVE ENGINE · booting…',
    brutalMode: true, brutalSignals: [], pendingOrders: [], brutalStats: null,
    brutalRegime: 'range', brutalScannedAt: '', brutalSource: 'BRUTAL FUTURES · booting…', lastBrutalAt: '',
    sourcePnl: {},
  }
  // MIGRASI: state engine disimpan di globalThis supaya selamat dari hot-reload.
  // Objek yang dibuat sebelum BRUTAL MODE ada tidak punya field-nya, dan
  // `undefined` terbaca sebagai OFF. Lengkapi default di sini agar brutal engine
  // langsung aktif tanpa perlu restart dev server.
  if (typeof s.brutalMode !== 'boolean') s.brutalMode = true
  if (!Array.isArray(s.brutalSignals)) s.brutalSignals = []
  if (!Array.isArray(s.pendingOrders)) s.pendingOrders = []
  if (!s.brutalRegime) s.brutalRegime = 'range'
  if (typeof s.brutalScannedAt !== 'string') s.brutalScannedAt = ''
  if (typeof s.lastBrutalAt !== 'string') s.lastBrutalAt = ''
  if (!s.brutalSource || (s.brutalSource === 'BRUTAL FUTURES · OFF' && s.brutalMode)) s.brutalSource = 'BRUTAL FUTURES · booting…'
  if (!s.activityKeys) s.activityKeys = new Set(s.activities.map(a => `${a.type}-${a.time}-${a.message}`))
  if (!s.processed) s.processed = new Set()
  if (!s.sourcePnl || typeof s.sourcePnl !== 'object') s.sourcePnl = {}
  // MIGRASI: state lama belum punya buku vonis gerbang (dipakai dashboard untuk
  // memajukan antrian scan). Tanpa default ini akses `s.gateVerdicts[x]` melempar.
  if (!s.gateVerdicts || typeof s.gateVerdicts !== 'object') s.gateVerdicts = {}
  // MIGRASI MARGIN: posisi/riwayat yang dibuat sebelum margin accounting ada
  // dianggap 1× (notional == margin) supaya penjumlahan saldo tidak NaN.
  Object.values(s.positions).forEach(p => {
    if (!Number.isFinite(p.leverage) || p.leverage < 1) p.leverage = 1
    if (!Number.isFinite(p.sizeUsd) || p.sizeUsd <= 0) p.sizeUsd = Math.max(0, p.quantity * p.entryPrice)
    if (!Number.isFinite(p.notionalUsd) || p.notionalUsd <= 0) p.notionalUsd = p.sizeUsd
    if (!Number.isFinite(p.marginUsd) || p.marginUsd <= 0) p.marginUsd = p.notionalUsd / p.leverage
    if (p.liquidationPrice === undefined) p.liquidationPrice = null
    if (!Number.isFinite(p.pnlUsd)) p.pnlUsd = 0
  })
  s.recentTrades.forEach(t => {
    if (!Number.isFinite(t.leverage) || t.leverage < 1) t.leverage = 1
    if (!Number.isFinite(t.marginUsd) || t.marginUsd <= 0) t.marginUsd = (Number.isFinite(t.sizeUsd) && t.sizeUsd > 0 ? t.sizeUsd : 0) / t.leverage
  })
  // Saldo = satu-satunya sumber kebenaran. Kalau state lama korup/negatif,
  // pulihkan ke modal awal agar equity & drawdown tetap masuk akal.
  if (!Number.isFinite(s.balance) || s.balance < 0) s.balance = s.capital
  if (!Number.isFinite(s.capital) || s.capital <= 0) s.capital = CONFIG.capital
  // MIGRASI MODAL: kalau CONFIG.capital diubah (mis. $10 → $50), simulasi
  // dimulai ulang BERSIH dari modal baru — saldo, equity, posisi, riwayat, dan
  // buku per sumber direset supaya analisa pertumbuhan mulai dari modal baru.
  if (s.capital !== CONFIG.capital) {
    const lama = s.capital
    s.capital = CONFIG.capital; s.balance = CONFIG.capital
    s.peakEquity = CONFIG.capital; s.dailyPnl = 0
    s.positions = {}; s.recentTrades = []; s.sourcePnl = {}
    s.processed = new Set(); s.consecutiveLoss = 0; s.circuitBreaker = false
    activity(s, `capital-${CONFIG.capital}-${Date.now()}`, 'AGENT', `ENGINE · modal diubah $${lama.toFixed(2)} → $${CONFIG.capital.toFixed(2)} · simulasi dimulai ulang bersih · SALDO (KAS) $${CONFIG.capital.toFixed(2)} · semua harga tetap realtime · pertumbuhan dianalisa dari modal baru`, 'good')
  }
  return s
}
function activity(s: EngineState, key: string, type: Activity['type'], message: string, tone?: Activity['tone']) {
  if (s.activityKeys.has(key)) return
  s.activityKeys.add(key)
  s.activities.unshift({ time: new Date().toISOString(), type, message, tone })
  s.activities = s.activities.slice(0, 200)
  // keep the dedupe set from growing forever
  if (s.activityKeys.size > 400) s.activityKeys = new Set(s.activities.map(a => `${a.type}-${a.time}-${a.message}`))
}
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0
const sym = (signal: Signal) => signal.coinSymbol.toUpperCase()
// PnL dihitung atas NOTIONAL (quantity = notional / entry), jadi otomatis benar
// untuk spot-like 1× maupun futures ber-leverage: margin kecil, notional besar.
function pnl(pos: PaperPosition, price: number) { const direction = pos.side === 'LONG' ? 1 : -1; return (price - pos.entryPrice) * pos.quantity * direction }
function equity(s: EngineState) { return s.balance + Object.values(s.positions).reduce((sum, p) => sum + p.pnlUsd, 0) }

// ── SATU DOMPET UNTUK SEMUA SUMBER ────────────────────────────────────────────
// Sinyal normal (live engine / DEX fallback, 1×) dan brutal futures (2–20×)
// mengunci margin dari `balance` yang SAMA — tidak ada saldo terpisah.
const leverageOf = (pos: PaperPosition) => Number.isFinite(pos.leverage) && pos.leverage >= 1 ? pos.leverage : 1
const marginOf = (pos: PaperPosition) => Number.isFinite(pos.marginUsd) && pos.marginUsd > 0 ? pos.marginUsd : (pos.notionalUsd || pos.sizeUsd || 0) / leverageOf(pos)
const usedMargin = (s: EngineState) => Object.values(s.positions).reduce((sum, p) => sum + marginOf(p), 0)
const freeMargin = (s: EngineState) => Math.max(0, s.balance - usedMargin(s))
const unrealized = (s: EngineState) => Object.values(s.positions).reduce((sum, p) => sum + p.pnlUsd, 0)
const sourceKey = (source?: string) => source === 'brutal-futures' ? 'brutal-futures' : source === 'paper-test-dex' ? 'paper-test-dex' : 'live-signal-engine'
const sourceName = (key: string) => key === 'brutal-futures' ? 'BRUTAL FUTURES' : key === 'paper-test-dex' ? 'DEX FALLBACK' : 'LIVE ENGINE'

// Rincian kontribusi tiap sumber ke satu saldo: realized kumulatif (tidak hilang
// saat recentTrades di-trim) + unrealized & margin dari posisi yang masih terbuka.
function wallet(s: EngineState): Wallet {
  const positions = Object.values(s.positions)
  const keys = new Set<string>([...Object.keys(s.sourcePnl), ...positions.map(p => sourceKey(p.source))])
  const bySource: SourcePnl[] = [...keys].map(key => {
    const acc = s.sourcePnl[key] || { realized: 0, trades: 0, wins: 0, losses: 0 }
    const open = positions.filter(p => sourceKey(p.source) === key)
    return {
      key, source: sourceName(key),
      realized: acc.realized, trades: acc.trades, wins: acc.wins, losses: acc.losses,
      unrealized: open.reduce((sum, p) => sum + p.pnlUsd, 0),
      margin: open.reduce((sum, p) => sum + marginOf(p), 0),
      openPositions: open.length,
    }
  }).sort((a, b) => (b.realized + b.unrealized) - (a.realized + a.unrealized))
  const totalEquity = equity(s)
  return {
    initialCapital: s.capital, balance: s.balance, equity: totalEquity,
    usedMargin: usedMargin(s), freeMargin: freeMargin(s),
    realizedPnl: s.balance - s.capital, unrealizedPnl: unrealized(s),
    totalPnl: totalEquity - s.capital,
    returnPct: s.capital > 0 ? (totalEquity - s.capital) / s.capital * 100 : 0,
    bySource,
  }
}

// Fresh mark price: prefer the scanned signal price, else fetch a live Binance
// quote so open positions keep moving even when the coin drops out of the scan.
async function livePrice(coinId: string): Promise<number | null> {
  if (!/^[a-z0-9]{2,15}$/i.test(coinId)) return null // skip DEX mint addresses
  const symbol = `${coinId.toUpperCase()}USDT`
  // Futures price dulu (fapi — sumber yang sama dipakai BRUTAL MODE), lalu spot.
  const endpoints = [
    `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`,
    `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
  ]
  for (const url of endpoints) {
    try {
      // fetchJsonResilient: tahan blokir DNS ISP (DoH + SNI) untuk host Binance.
      const data = await fetchJsonResilient(url, 5_000)
      const price = parseFloat(data?.price)
      if (Number.isFinite(price) && price > 0) return price
    } catch { /* coba endpoint berikutnya */ }
  }
  return null
}

// DEX mint mark price: the EXACT pool the position was opened in when known
// (a mint can have many pools with wildly different prices), otherwise the most
// liquid Solana pool for that mint. Live DexScreener, no mock data.
async function dexPrice(mint: string, pairAddress?: string): Promise<number | null> {
  try {
    const url = pairAddress
      ? `https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`
      : `https://api.dexscreener.com/latest/dex/tokens/${mint}`
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6_000), cache: 'no-store' })
    if (!response.ok) return null
    const data = await response.json()
    const list = pairAddress ? [data?.pair].filter(Boolean) : (data?.pairs || [])
    const pairs = list.filter((p: any) => Number(p?.priceUsd) > 0)
    if (!pairs.length) return null
    const best = pairs.sort((a: any, b: any) => Number(b?.liquidity?.usd || 0) - Number(a?.liquidity?.usd || 0))[0]
    const price = Number(best.priceUsd)
    return Number.isFinite(price) && price > 0 ? price : null
  } catch { return null }
}

// Last-resort mark price for CoinGecko-style ids (e.g. `solana`).
async function geckoPrice(coinId: string): Promise<number | null> {
  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6_000), cache: 'no-store' })
    if (!response.ok) return null
    const data = await response.json()
    const price = Number(data?.[coinId]?.usd)
    return Number.isFinite(price) && price > 0 ? price : null
  } catch { return null }
}

const isMint = (id: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id)
const priceCache: Record<string, { price: number; at: number }> = {}
// Real-time mark price: fresh scan/discovery price → DexScreener (mint) →
// Binance (symbol) → CoinGecko (id). Cached 15s per coin to stay gentle.
async function markPrice(pos: PaperPosition, signals: Signal[]): Promise<number> {
  const byId = signals.find(x => x.coinId === pos.coinId)?.currentPrice
  if (finite(byId)) return byId as number
  const bySym = signals.find(x => x.coinSymbol.toUpperCase() === pos.coinSymbol.toUpperCase())?.currentPrice
  if (finite(bySym)) return bySym as number
  const cached = priceCache[pos.coinId]
  if (cached && Date.now() - cached.at < 15_000) return cached.price
  let price: number | null = null
  if (isMint(pos.coinId)) price = await dexPrice(pos.coinId, pos.pairAddress)
  else price = await livePrice(pos.coinId) ?? await geckoPrice(pos.coinId)
  if (price) priceCache[pos.coinId] = { price, at: Date.now() }
  return price ?? pos.currentPrice
}

function tripBreaker(s: EngineState, reason: string) {
  if (s.circuitBreaker) return
  s.circuitBreaker = true; s.running = false
  activity(s, `cb-${Date.now()}`, 'VETO', `CIRCUIT BREAKER · ${reason} · paper trading dihentikan otomatis · tekan RESET untuk lanjut`, 'bad')
  // Notifikasi Telegram (topik WALLET): event penghentian otomatis berdampak margin.
  notifyTelegram('wallet', `🛑 <b>CIRCUIT BREAKER</b>\n${reason}\nPaper trading dihentikan otomatis · equity $${equity(s).toFixed(2)} · saldo $${s.balance.toFixed(2)}\nTekan RESET di dashboard untuk lanjut.`)
}

function close(s: EngineState, pos: PaperPosition, reason: string) {
  const realised = pos.pnlUsd; const margin = marginOf(pos); const leverage = leverageOf(pos)
  // Rugi tidak boleh melebihi margin yang dikunci (isolated margin): sisanya
  // tetap aman di saldo bersama.
  const booked = Math.max(realised, -margin)
  s.balance += booked; s.dailyPnl += booked
  // pnlPct = ROE (return on margin). Untuk 1× identik dengan return spot; untuk
  // brutal futures inilah hasil nyata atas modal yang dikunci.
  const pnlPct = margin > 0 ? booked / margin * 100 : 0
  s.recentTrades.unshift({ coinId: pos.coinId, coinSymbol: pos.coinSymbol, side: pos.side, entryPrice: pos.entryPrice, exitPrice: pos.currentPrice, pnlUsd: booked, pnlPct, reason, openedAt: pos.openedAt, closedAt: new Date().toISOString(), sizeUsd: pos.sizeUsd, source: pos.source, leverage, marginUsd: margin })
  s.recentTrades = s.recentTrades.slice(0, 50); delete s.positions[pos.coinId]
  s.consecutiveLoss = booked < 0 ? s.consecutiveLoss + 1 : 0
  // Buku per sumber — rincian saja, uangnya tetap masuk ke SATU balance.
  const key = sourceKey(pos.source)
  const acc = s.sourcePnl[key] ??= { realized: 0, trades: 0, wins: 0, losses: 0 }
  acc.realized += booked; acc.trades += 1; if (booked >= 0) acc.wins += 1; else acc.losses += 1
  activity(s, `exit-${pos.coinId}-${Date.now()}`, 'EXIT', `${pos.coinSymbol.toUpperCase()} ${pos.side} ${leverage}× closed · ${reason} · entry ${pos.entryPrice} → exit ${pos.currentPrice} · margin $${margin.toFixed(2)} · ${usd(booked)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% ROE) · SALDO $${s.balance.toFixed(2)} · equity $${equity(s).toFixed(2)}`, booked >= 0 ? 'good' : 'bad')
  // ── Notifikasi Telegram (topik TRADE): posisi paper sudah CLOSE. ──
  // Dedup per (coin, openedAt) — satu posisi hanya dilaporkan sekali walau
  // close() terpanggil ganda (mis. tick overlap / hot reload).
  const heldMin = Math.max(0, (Date.now() - new Date(pos.openedAt).getTime()) / 60_000)
  const durasi = heldMin >= 60 ? `${Math.floor(heldMin / 60)}j ${Math.round(heldMin % 60)}m` : `${heldMin.toFixed(0)}m`
  notifyTelegram('trade', [
    `${booked >= 0 ? '✅' : '❌'} <b>PAPER EXIT · ${pos.coinSymbol.toUpperCase()} ${pos.side} ${leverage}× · ${reason}</b>`,
    `Entry <code>${pos.entryPrice}</code> → Exit <code>${pos.currentPrice}</code> · Durasi ${durasi}`,
    `PnL: <b>${usd(booked)}</b> (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% ROE) · Margin $${margin.toFixed(2)}`,
    `Saldo $${s.balance.toFixed(2)} · Equity $${equity(s).toFixed(2)}`,
    `${sourceName(key)}: ${acc.wins}W/${acc.losses}L · realized ${usd(acc.realized)}`,
  ].join('\n'), `tg-exit-${pos.coinId}-${pos.openedAt}`)
  // Likuidasi = margin hangus → laporkan juga ke topik WALLET.
  if (reason.startsWith('Likuidasi')) notifyTelegram('wallet', `🛑 <b>LIKUIDASI · ${pos.coinSymbol.toUpperCase()} ${pos.side} ${leverage}×</b>\nHarga ${pos.currentPrice} menembus level likuidasi · margin $${margin.toFixed(2)} hangus (isolated — saldo bersama aman)\nSaldo sekarang $${s.balance.toFixed(2)}`, `tg-liq-${pos.coinId}-${pos.openedAt}`)
  if (s.consecutiveLoss >= CONFIG.maxConsecutiveLoss) tripBreaker(s, `${s.consecutiveLoss} kerugian beruntun (maks ${CONFIG.maxConsecutiveLoss})`)
}

function scoreOf(signal: Signal, label: string) { return signal.subScores?.find(item => item.label.toLowerCase().includes(label.toLowerCase()))?.score ?? 50 }

// ─── FIVE-AGENT CONSENSUS (scores derived from REAL engine output) ───────────
function evaluateAgents(signal: Signal): AgentDecision[] {
  const ageMin = (Date.now() - new Date(signal.timestamp).getTime()) / 60_000
  const stopDistance = finite(signal.currentPrice) && finite(signal.stopLoss) ? Math.abs(signal.currentPrice - signal.stopLoss) / signal.currentPrice * 100 : 100
  const scannerScore = Math.min(100, Math.round(signal.confidence * .65 + Math.min(20, (signal.sniperScore ?? 0) / 5) + (ageMin <= 10 ? 15 : 0)))
  const directional = signal.signal === 'LONG' ? signal.bullish : signal.bearish
  const narrativeScore = Math.round(directional * .65 + (signal.htfAligned ? 20 : 0) + (['bull', 'bear'].includes((signal.marketRegime || '').toLowerCase()) ? 10 : 0))
  const walletScore = Math.round((signal.whaleScore ?? scoreOf(signal, 'Whale')) * .7 + ((signal.whaleBias || '').toLowerCase().includes(signal.signal === 'LONG' ? 'accumulation' : 'distribution') ? 30 : 0))
  const structureBase = Math.round((scoreOf(signal, 'Market Structure') + scoreOf(signal, 'Liquidity') + scoreOf(signal, 'Order Flow') + scoreOf(signal, 'Bid/Ask')) / 4)
  // MILESTONE 2 · REFERENCE MERGE: structureQuality (kebersihan swing HH/HL/LH/LL
  // + BOS − CHoCH, 0-100) dari analyzeMarketStructure referensi. Struktur yang
  // berantakan (swing sedikit / baru CHoCH) menurunkan skor STRUCTURE walau
  // sub-skor lain bagus. Blend 70% sub-skor + 30% quality — hanya bila tersedia
  // (sinyal DEX/brutal lama tidak punya field ini → perilaku lama dipertahankan).
  const structureScore = signal.structureQuality !== undefined
    ? Math.round(structureBase * .7 + signal.structureQuality * .3)
    : structureBase
  const riskVeto = ageMin > maxAgeFor(signal) || signal.rr < CONFIG.minRR || (signal.expectedValue !== undefined && signal.expectedValue <= 0) || stopDistance > CONFIG.maxStopDistancePct || !finite(signal.stopLoss) || !finite(signal.tp1)
  // MILESTONE 2 · REFERENCE MERGE: pita noise Monte Carlo 7h (p10–p90, 500 path
  // — parameter referensi). SL LONG di atas p10 berarti >10% path acak menyentuh
  // SL dalam horizon 7 jam → stop-out oleh noise, bukan invalidasi setup. Sama
  // untuk SHORT vs p90. Penalti lunak −8 pada riskScore (bukan veto) — setup
  // tetap boleh jalan bila faktor lain kuat, tapi tercatat di reason agen RISK.
  const slInNoiseBand = signal.mcP10 !== undefined && signal.mcP90 !== undefined && finite(signal.mcP10) && finite(signal.mcP90)
    ? (signal.signal === 'LONG' ? signal.stopLoss > signal.mcP10 : signal.signal === 'SHORT' ? signal.stopLoss < signal.mcP90 : false)
    : false
  const riskScore = Math.max(0, Math.min(100, Math.round(100 - (riskVeto ? 65 : 0) - Math.max(0, stopDistance - 8) * 3 - Math.max(0, 60 - signal.confidence) - (slInNoiseBand ? 8 : 0))))
  return [
    { agent: 'SCANNER', score: scannerScore, approved: scannerScore >= 48, reason: `fresh ${ageMin.toFixed(0)}m · confidence ${signal.confidence}% · sniper ${signal.sniperScore ?? 0}/100` },
    { agent: 'NARRATIVE', score: narrativeScore, approved: narrativeScore >= 48, reason: `${signal.marketRegime || 'unknown'} regime · ${signal.signal} ${directional}% · HTF ${signal.htfAligned ? 'aligned ✅' : 'unconfirmed'}` },
    { agent: 'WALLET', score: walletScore, approved: walletScore >= 45, reason: `${signal.whaleBias || 'no wallet bias'} · OBV/flow score ${signal.whaleScore ?? scoreOf(signal, 'Whale')}` },
    { agent: 'STRUCTURE', score: structureScore, approved: structureScore >= 48, reason: `MS ${scoreOf(signal, 'Market Structure')} · LIQ ${scoreOf(signal, 'Liquidity')} · OF ${scoreOf(signal, 'Order Flow')} · B/A ${scoreOf(signal, 'Bid/Ask')}${signal.structureQuality !== undefined ? ` · SQ ${signal.structureQuality}` : ''}${signal.swingTrend ? ` · swing ${signal.swingTrend}` : ''}` },
    { agent: 'RISK', score: riskScore, approved: !riskVeto && riskScore >= 45, veto: riskVeto, reason: riskVeto ? `VETO: stale ${ageMin.toFixed(0)}m / R:R 1:${signal.rr} / EV ${signal.expectedValue ?? 'n/a'} / stop ${stopDistance.toFixed(1)}%` : `PAPER_TEST · R:R 1:${signal.rr} · EV ${signal.expectedValue ?? 'n/a'} · stop ${stopDistance.toFixed(1)}%${slInNoiseBand ? ' · ⚠ SL di dalam pita noise MC 7h (p10–p90) → rawan stop-out oleh noise' : ''}` },
  ]
}

// ─── FULL CHECK PIPELINE (every rejection is logged with its exact reason) ──
function valid(signal: Signal, s: EngineState) {
  const decisions = evaluateAgents(signal); s.agentDecisions[signal.coinId] = decisions
  const signalKey = `${signal.coinId}-${signal.signal}-${signal.timestamp}`
  const sourceLabel = signal.source === 'paper-test-dex' ? 'DEX FALLBACK (DexScreener live)' : 'LIVE ENGINE (Binance · 13 quant engines)'
  activity(s, `scan-${signalKey}`, 'SCAN', `${sym(signal)} ${signal.signal} discovered via ${sourceLabel} · conf ${signal.confidence}% · bullish ${signal.bullish}%/bearish ${signal.bearish}% · R:R 1:${signal.rr} · sniper ${signal.sniperScore ?? 0} · regime ${signal.marketRegime || 'unknown'}`)
  decisions.forEach(decision => activity(s, `agent-${signalKey}-${decision.agent}`, decision.veto ? 'VETO' : 'AGENT', `${decision.agent} · ${sym(signal)} · ${decision.approved ? 'PASS' : decision.veto ? 'VETO' : 'CHECK'} (${decision.score}) · ${decision.reason}`, decision.veto ? 'bad' : decision.approved ? 'good' : 'warn'))

  const reject = (reason: string) => { activity(s, `gate-${signalKey}`, 'VETO', `GATE · ${sym(signal)} · DITOLAK · ${reason}`, 'bad'); verdict(s, signal, false, reason); return false }
  if (signal.signal === 'NEUTRAL') return reject('arah sinyal NEUTRAL')
  if (!finite(signal.currentPrice) || !finite(signal.stopLoss) || !finite(signal.tp1)) return reject('price/SL/TP tidak valid')
  const ageMin = (Date.now() - new Date(signal.timestamp).getTime()) / 60_000
  const maxAge = maxAgeFor(signal)
  if (ageMin > maxAge) return reject(`sinyal basi ${ageMin.toFixed(0)}m > maks ${maxAge}m${signal.source === 'brutal-futures' ? ' (brutal futures)' : ' (non-brutal · structure 1h)'}`)
  if (signal.confidence < CONFIG.minConfidence) return reject(`confidence ${signal.confidence}% < min ${CONFIG.minConfidence}%`)
  if (signal.rr < CONFIG.minRR) return reject(`R:R 1:${signal.rr} < min 1:${CONFIG.minRR}`)
  if (signal.expectedValue !== undefined && signal.expectedValue < 0) return reject(`Expected Value negatif (${signal.expectedValue})`)
  const directional = signal.signal === 'LONG' ? signal.bullish : signal.bearish
  const minDirectional = signal.signal === 'LONG' ? CONFIG.minBullish : CONFIG.minBearish
  if (directional < minDirectional) return reject(`probabilitas arah ${directional}% < min ${minDirectional}%`)
  if (Object.values(s.positions).some(p => p.coinId === signal.coinId || p.coinSymbol.toUpperCase() === sym(signal))) return reject(`posisi ${sym(signal)} masih terbuka`)
  if (Object.keys(s.positions).length >= CONFIG.maxPositions) return reject(`slot posisi penuh (${Object.keys(s.positions).length}/${CONFIG.maxPositions})`)
  const failed = decisions.filter(decision => !decision.approved)
  if (failed.length || decisions.some(decision => decision.veto)) return reject(`konsensus agen gagal · ${failed.map(decision => `${decision.agent}(${decision.score})`).join(', ')}`)
  activity(s, `pass-${signalKey}`, 'AGENT', `GATE · ${sym(signal)} · SEMUA FILTER LOLOS · 5/5 agen konsensus · R:R 1:${signal.rr} · Kelly ${((signal.kellyFraction ?? 0) * 100).toFixed(2)}% · siap eksekusi paper`, 'good')
  verdict(s, signal, true, `LOLOS · 5/5 agen · R:R 1:${signal.rr} · Kelly ${((signal.kellyFraction ?? 0) * 100).toFixed(2)}%`)
  return true
}

// Buku vonis gerbang per coin. Ditulis ulang SETIAP tick untuk setiap sinyal,
// jadi begitu satu posisi ditutup / slot kosong lagi, vonis lama otomatis
// tergantikan dan coin itu boleh dipertimbangkan ulang. Ukuran dibatasi supaya
// tidak tumbuh tanpa batas saat universe berganti-ganti.
function verdict(s: EngineState, signal: Signal, pass: boolean, reason: string) {
  s.gateVerdicts[signal.coinId] = { pass, reason, at: new Date().toISOString(), signal: signal.signal, confidence: signal.confidence }
  const keys = Object.keys(s.gateVerdicts)
  if (keys.length > 150) {
    keys.sort((a, b) => +new Date(s.gateVerdicts[a].at) - +new Date(s.gateVerdicts[b].at))
      .slice(0, keys.length - 150)
      .forEach(k => delete s.gateVerdicts[k])
  }
}

// ─── MILESTONE 1 · FRESHNESS & RE-VALIDASI HARGA SEBELUM ENTRY ─────────────────────
// Harga live terbaru untuk re-validasi entry — pola markPrice() TANPA lookup ke
// daftar sinyal (harga sinyal justru yang sedang diuji kesegarannya, jadi
// memakainya akan circular): cache 15s → DexScreener (mint) → Binance fapi/spot
// (symbol) → CoinGecko (id).
async function freshPrice(signal: Signal): Promise<number | null> {
  const cached = priceCache[signal.coinId]
  if (cached && Date.now() - cached.at < 15_000) return cached.price
  const price = isMint(signal.coinId)
    ? await dexPrice(signal.coinId, signal.pairAddress)
    : await livePrice(signal.coinId) ?? await geckoPrice(signal.coinId)
  if (price) priceCache[signal.coinId] = { price, at: Date.now() }
  return price
}

async function open(s: EngineState, signal: Signal) {
  const long = signal.signal === 'LONG'
  const ageMin = (Date.now() - new Date(signal.timestamp).getTime()) / 60_000
  const vetoEntry = (reason: string) => activity(s, `entry-fail-${signal.coinId}-${signal.timestamp}`, 'VETO', `ENTRY · ${sym(signal)} dibatalkan · ${reason}`, 'bad')
  const signed = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
  // ── RE-VALIDASI HARGA: entry paper tidak lagi memakai harga scan basi. ──
  // Slippage diukur terhadap signal.currentPrice; adverse = gerakan MELAWAN arah
  // posisi (LONG: harga naik → mengejar pump; SHORT: harga turun → mengejar dump).
  // Posisi paper dicatat pada harga LIVE supaya statistik winrate/expectancy
  // mencerminkan fill realistis. Semua ambang deterministic dari kode (bukan LLM)
  // dan setiap penolakan ter-log ke activities dengan alasan yang jelas.
  const fresh = await freshPrice(signal)
  let entry = signal.currentPrice
  let slipPct = 0
  let revalidated = false
  if (finite(fresh)) {
    entry = fresh as number
    revalidated = true
    slipPct = (entry - signal.currentPrice) / signal.currentPrice * 100
    const adverse = long ? slipPct : -slipPct
    if (adverse > CONFIG.maxAdverseSlippagePct) { vetoEntry(`SLIPPAGE ADVERSE ${signed(adverse)} > toleransi ${CONFIG.maxAdverseSlippagePct}% · harga live ${entry} vs harga scan ${signal.currentPrice} (umur sinyal ${ageMin.toFixed(0)}m) · harga sudah lari — entry sekarang mengejar & merusak R:R`); return }
    if (adverse < -CONFIG.maxFavorableSlippagePct) { vetoEntry(`SLIPPAGE FAVORABLE ${signed(slipPct)} melewati toleransi ${CONFIG.maxFavorableSlippagePct}% · harga live ${entry} vs harga scan ${signal.currentPrice} · gerakan sudah terjadi tanpa kita — ${long ? 'turun sedalam ini membatalkan tesis LONG' : 'naik setinggi ini membatalkan tesis SHORT'} (structure 1h basi)`); return }
    if (long ? entry <= signal.stopLoss : entry >= signal.stopLoss) { vetoEntry(`harga live ${entry} SUDAH MENEMBUS SL ${signal.stopLoss} sebelum entry (slippage ${signed(slipPct)}) · setup batal — jangan masuk trade yang sudah kalah`); return }
    if (long ? entry >= signal.tp1 : entry <= signal.tp1) { vetoEntry(`harga live ${entry} SUDAH MENEMBUS TP1 ${signal.tp1} sebelum entry (slippage ${signed(slipPct)}) · gerakan sudah selesai — tidak ada edge tersisa`); return }
    // R:R efektif pada harga live, formula identik dengan engine (|TP1 − entry| /
    // |entry − SL|). Slippage adverse menyempitkan TP sekaligus melebarkan SL;
    // kalau hasilnya di bawah minRR, trade tidak lagi memenuhi standar engine sendiri.
    const rrFresh = Math.abs(signal.tp1 - entry) / Math.abs(entry - signal.stopLoss)
    if (rrFresh < CONFIG.minRR) { vetoEntry(`R:R efektif di harga live 1:${rrFresh.toFixed(2)} < min 1:${CONFIG.minRR} · entry ${entry} vs scan ${signal.currentPrice} (slippage ${signed(slipPct)}) · R:R saat scan 1:${signal.rr}`); return }
  } else if (ageMin > CONFIG.slippageFallbackAgeMin) {
    vetoEntry(`RE-VALIDASI HARGA GAGAL (Binance/DexScreener/CoinGecko tidak tersedia) & sinyal sudah ${ageMin.toFixed(0)}m > ${CONFIG.slippageFallbackAgeMin}m · slippage tidak terukur — entry dibatalkan demi menghindari fill harga basi`); return
  } else {
    activity(s, `entry-slipwarn-${signal.coinId}-${signal.timestamp}`, 'AGENT', `ENTRY · ${sym(signal)} · re-validasi harga gagal (fetch live tidak tersedia) · sinyal masih muda ${ageMin.toFixed(1)}m ≤ ${CONFIG.slippageFallbackAgeMin}m → lanjut pakai harga scan ${signal.currentPrice} · WARN: slippage tidak terukur`, 'warn')
  }
  const stopDistance = Math.abs(entry - signal.stopLoss) / entry
  if (!stopDistance || stopDistance > .2) { vetoEntry(`stop distance ${(stopDistance * 100).toFixed(1)}% di luar batas sizing 20%`); return }
  // Leverage hanya datang dari sinyal brutal futures; sumber lain 1× (spot-like).
  const leverage = Math.max(1, Math.min(CONFIG.maxLeverage, Math.round(signal.leverage ?? 1)))
  const riskPct = Math.min(CONFIG.maxRiskPct, Math.max(.25, (signal.kellyFraction ?? CONFIG.riskPct / 100) * 100))
  const riskUsd = equity(s) * riskPct / 100
  // SATU SALDO: notional dibatasi (a) risiko, (b) margin bebas × leverage,
  // (c) plafon notional terhadap equity. Margin bebas = balance − margin terpakai,
  // jadi dua posisi tidak bisa sama-sama mengklaim seluruh saldo.
  const free = freeMargin(s)
  if (free < .1) { vetoEntry(`margin bebas $${free.toFixed(2)} tidak cukup · saldo $${s.balance.toFixed(2)} · margin terpakai $${usedMargin(s).toFixed(2)} oleh ${Object.keys(s.positions).length} posisi terbuka`); return }
  const notional = Math.min(riskUsd / stopDistance, free * leverage, equity(s) * CONFIG.maxNotionalX)
  const marginUsd = notional / leverage
  if (notional < .1 || marginUsd < .05) { vetoEntry(`notional $${notional.toFixed(3)} / margin $${marginUsd.toFixed(3)} terlalu kecil (min $0.10)`); return }
  // Harga likuidasi (isolated margin, maintenance ≈ 0.5%). Leverage 1× → null
  // karena secara praktis tidak mungkin terlikuidasi.
  const liquidationPrice = leverage > 1 ? (long ? entry * (1 - .995 / leverage) : entry * (1 + .995 / leverage)) : null
  s.positions[signal.coinId] = { coinId: signal.coinId, coinSymbol: signal.coinSymbol, side: signal.signal, entryPrice: entry, currentPrice: entry, pnlUsd: 0, sizeUsd: notional, stopLoss: signal.stopLoss, tp1: signal.tp1, tp2: signal.tp2 || signal.tp1, trailActive: false, tp1Hit: false, tp2Hit: false, openedAt: new Date().toISOString(), quantity: notional / entry, pairAddress: signal.pairAddress, source: signal.source, leverage, marginUsd, notionalUsd: notional, liquidationPrice }
  activity(s, `entry-${signal.coinId}-${signal.timestamp}`, 'ENTRY', `EKSEKUSI · ${sym(signal)} ${signal.signal} ${leverage}× paper entry @ ${entry}${revalidated ? ` · harga TEREVALIDASI live (umur sinyal ${ageMin.toFixed(1)}m · slippage ${signed(slipPct)} vs harga scan ${signal.currentPrice})` : ` · WARN: re-validasi gagal, pakai harga scan (umur sinyal ${ageMin.toFixed(1)}m)`} · notional $${notional.toFixed(2)} = margin $${marginUsd.toFixed(2)} dari saldo $${s.balance.toFixed(2)} (risk ${riskPct.toFixed(2)}% = $${riskUsd.toFixed(2)}) · SL ${signal.stopLoss} (${(stopDistance * 100).toFixed(1)}%) · TP1 ${signal.tp1} · R:R 1:${signal.rr} · EV ${signal.expectedValue ?? 'n/a'} · likuidasi ≈ ${liquidationPrice ? liquidationPrice.toPrecision(6) : 'n/a (1×)'} · margin bebas sisa $${freeMargin(s).toFixed(2)} · 5/5 konsensus`, 'good')
  // ── Notifikasi Telegram (topik TRADE): sinyal DIEKSEKUSI masuk posisi. ──
  // Dedup per (coin, timestamp sinyal) — satu sinyal hanya dilaporkan sekali.
  notifyTelegram('trade', [
    `🟢 <b>PAPER ENTRY · ${sym(signal)} ${signal.signal} ${leverage}×</b> · ${sourceName(sourceKey(signal.source))} · 5/5 konsensus`,
    `Entry <code>${entry}</code>${revalidated ? ` (live · slip ${signed(slipPct)} · umur sinyal ${ageMin.toFixed(0)}m)` : ` (harga scan · WARN re-validasi gagal · umur ${ageMin.toFixed(0)}m)`}`,
    `SL <code>${signal.stopLoss}</code> (${(stopDistance * 100).toFixed(1)}%) · TP1 <code>${signal.tp1}</code> · TP2 <code>${signal.tp2 || signal.tp1}</code> · R:R 1:${signal.rr}`,
    `Conf ${signal.confidence}% · EV ${signal.expectedValue ?? 'n/a'} · Kelly ${((signal.kellyFraction ?? 0) * 100).toFixed(2)}%`,
    `Margin $${marginUsd.toFixed(2)} · Notional $${notional.toFixed(2)} · Likuidasi ≈ ${liquidationPrice ? liquidationPrice.toPrecision(6) : 'n/a (1×)'}`,
    `Saldo $${s.balance.toFixed(2)} · Equity $${equity(s).toFixed(2)} · Slot ${Object.keys(s.positions).length}/${CONFIG.maxPositions}`,
  ].join('\n'), `tg-entry-${signal.coinId}-${signal.timestamp}`)
}

// ─── DEX FALLBACK DISCOVERY (live DexScreener — last resort, clearly labelled) ─
async function paperTestDiscovery(): Promise<Signal[]> {
  if (Date.now() - discoveryCache.updatedAt < 30_000) return discoveryCache.signals
  discoveryCache.updatedAt = Date.now()
  try {
    const response = await fetch('https://api.dexscreener.com/latest/dex/search?q=solana', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000), cache: 'no-store' })
    const data = await response.json()
    const pairs = (data?.pairs || [])
      .filter((item: any) => item.chainId === 'solana' && Number(item.priceUsd) > 0 && Number(item.liquidity?.usd) >= 10_000 && Number(item.volume?.h24) > 0)
      .sort((a: any, b: any) => Number(b.volume?.h1 || 0) - Number(a.volume?.h1 || 0))
      .slice(0, 3)
    discoveryCache.signals = pairs.map((pair: any): Signal => {
      const price = Number(pair.priceUsd), buys = Number(pair.txns?.h1?.buys || 0), sells = Number(pair.txns?.h1?.sells || 0), change = Number(pair.priceChange?.h1 || 0)
      const long = buys >= sells
      const directional = long ? buys / Math.max(buys + sells, 1) * 100 : sells / Math.max(buys + sells, 1) * 100
      const confidence = Math.min(78, Math.max(45, Math.round(directional * .7 + Math.min(18, Math.abs(change) * 2))))
      // Whale pressure proxy derived from the pair's own real txn flow (no external service)
      const flowImbalance = (buys - sells) / Math.max(buys + sells, 1)
      const whaleScore = Math.max(5, Math.min(95, Math.round(50 + flowImbalance * 45)))
      const whaleBias = whaleScore >= 65 ? 'accumulation' : whaleScore <= 35 ? 'distribution' : 'neutral'
      return {
        coinId: pair.baseToken.address, coinSymbol: pair.baseToken.symbol, signal: long ? 'LONG' : 'SHORT', pairAddress: pair.pairAddress,
        confidence, bullish: long ? directional : 100 - directional, bearish: long ? 100 - directional : directional,
        rr: 1.2, expectedValue: .01, currentPrice: price, entryLow: price * .995, entryHigh: price * 1.005,
        stopLoss: price * (long ? .97 : 1.03), tp1: price * (long ? 1.036 : .964), tp2: price * (long ? 1.05 : .95),
        timestamp: new Date(Math.floor(Date.now() / 30_000) * 30_000).toISOString(),
        marketRegime: change >= 0 ? 'bull' : 'bear', htfAligned: Math.abs(change) > .2,
        whaleScore, whaleBias, sniperScore: Math.min(80, Math.round(Math.abs(change) * 5 + directional * .5)),
        subScores: [
          { label: 'Market Structure', score: confidence, weight: .25 },
          { label: 'Liquidity', score: Math.min(90, Math.round(Math.log10(Number(pair.liquidity?.usd || 1)) * 20)), weight: .25 },
          { label: 'Order Flow', score: Math.round(directional), weight: .25 },
          { label: 'Bid/Ask', score: Math.round(directional), weight: .25 },
        ],
        source: 'paper-test-dex',
      }
    })
    return discoveryCache.signals
  } catch { return discoveryCache.signals }
}

// ─── ENGINE SCAN LOG SYNC (surfaces the real scanner's cycle into activities) ─
function syncEngineLog(s: EngineState, live: { signals: LiveSignal[]; report: ScanReport | null; scanning: boolean }) {
  if (live.report) {
    s.scanReport = live.report
    if (live.report.scannedAt !== s.lastReportAt) {
      s.lastReportAt = live.report.scannedAt
      activity(s, `engine-${live.report.scannedAt}`, 'SCAN', `LIVE ENGINE · scan selesai · ${live.report.universe} pair Binance (vol ≥ $2M · |Δ24h| ≥ 1.5%) · regime ${live.report.regime.toUpperCase()} (${live.report.regimeScore}) · ${live.report.analyzed} dianalisis 13 engines · ${live.report.signals} sinyal lolos · ${(live.report.durationMs / 1000).toFixed(1)}s`, 'good')
    }
  } else if (live.scanning) {
    activity(s, 'engine-boot', 'SCAN', 'LIVE ENGINE · scan real-time pertama sedang berjalan · Binance ticker + klines 1h/4h · 13 quant engines + Bayesian + Kelly + HTF + regime gate', 'warn')
  }
}

// ─── BRUTAL FUTURES MODE ──────────────────────────────────────────────────────
// Sumber sinyal ke-3: perpetual USDT-M Binance dianalisis lib/brutalEngine.ts
// (teknikal 15m/1h + funding, ΔOI, top-trader long/short, taker buy/sell).
// Hanya setup berstatus EXECUTE — atau pending order yang trigger-nya baru
// tersentuh — yang diteruskan ke gerbang 5-agen. Status "⏳ Tunggu di $X ·
// Belum ada konfirmasi breakout" dan "⚪ NETRAL" TIDAK PERNAH dieksekusi;
// mereka dipantau sebagai pending order sampai harganya kena atau kedaluwarsa.
const clampNum = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function whaleFromFutures(sig: BrutalSignal, long: boolean) {
  const lsr = sig.topLsr ?? 1
  const oiBoost = sig.oiBias === 'new long' ? 22 : sig.oiBias === 'new short' ? -22 : sig.oiBias === 'short covering' ? 8 : sig.oiBias === 'long liquidation' ? -8 : 0
  const score = Math.round(clampNum(50 + (lsr - 1) * (long ? 14 : -14) + (long ? oiBoost : -oiBoost), 5, 95))
  return { score, bias: score >= 65 ? 'accumulation' : score <= 35 ? 'distribution' : 'neutral' }
}

function brutalToSignal(sig: BrutalSignal, regime: string): Signal {
  const long = sig.side === 'LONG'
  const dirProb = clampNum(50 + sig.score * 3.4, 6, 94)
  const pWin = dirProb / 100
  const rr = sig.rr > 0 ? sig.rr : 2
  const riskPct = sig.entry > 0 ? Math.abs(sig.entry - sig.stopLoss) / sig.entry * 100 : 0
  const rewardPct = sig.entry > 0 ? Math.abs(sig.tp1 - sig.entry) / sig.entry * 100 : 0
  const whale = whaleFromFutures(sig, long)
  const trigger = sig.triggerPrice ?? sig.entry
  return {
    timestamp: sig.scannedAt || new Date().toISOString(),
    coinId: sig.coinId, coinSymbol: sig.coinSymbol,
    signal: sig.side === 'NEUTRAL' ? 'NEUTRAL' : long ? 'LONG' : 'SHORT',
    confidence: sig.confidence,
    bullish: long ? dirProb : 100 - dirProb, bearish: long ? 100 - dirProb : dirProb,
    rr, expectedValue: Number((pWin * rewardPct - (1 - pWin) * riskPct).toFixed(3)),
    kellyFraction: clampNum(pWin - (1 - pWin) / rr, .0025, .0125),
    currentPrice: sig.price, entryLow: Math.min(sig.entry, trigger), entryHigh: Math.max(sig.entry, trigger),
    stopLoss: sig.stopLoss, tp1: sig.tp1, tp2: sig.tp2,
    marketRegime: regime, htfAligned: sig.htfAligned,
    whaleScore: whale.score, whaleBias: whale.bias,
    sniperScore: Math.min(100, sig.factors.length * 11 + Math.abs(sig.score) * 4),
    volatilityScore: Math.round(clampNum(100 - sig.atrPct * 8, 5, 98)),
    subScores: [
      // MILESTONE 2: CHoCH (break lawan tren swing) dapat setengah bobot BOS
      // continuation (+6 vs +12) — konsisten dengan downgrade ±1 vs ±2 di
      // brutalEngine faktor 5 dan perlakuan CHoCH referensi di calcDirectionalProb.
      { label: 'Market Structure', score: Math.round(clampNum(50 + Math.abs(sig.score) * 5 + (sig.structure.startsWith('BOS') ? 12 : sig.structure.startsWith('CHoCH') ? 6 : 0), 5, 98)), weight: .25 },
      { label: 'Liquidity', score: Math.round(clampNum(Math.log10(Math.max(sig.volume24h, 1)) * 11, 20, 96)), weight: .25 },
      { label: 'Order Flow', score: Math.round(clampNum(50 + ((sig.takerRatio ?? 1) - 1) * 90, 5, 96)), weight: .25 },
      { label: 'Bid/Ask', score: Math.round(clampNum(50 + (sig.oiChangePct ?? 0) * 6, 5, 96)), weight: .25 },
      { label: 'Whale', score: whale.score, weight: .25 },
    ],
    swingTrend: sig.swingTrend,
    source: 'brutal-futures',
    // Leverage diteruskan ke paper trader supaya margin & PnL futures benar.
    leverage: Math.max(1, Math.min(CONFIG.maxLeverage, Math.round(sig.leverage || 1))),
  }
}

async function syncBrutal(s: EngineState): Promise<Signal[]> {
  try {
    const brutal = await tickBrutal()
    s.brutalSignals = brutal.signals.slice(0, 30)
    s.pendingOrders = brutal.pending
    s.brutalStats = brutal.stats
    s.brutalRegime = brutal.regime
    s.brutalScannedAt = brutal.scannedAt
    s.brutalSource = brutal.signals.length
      ? `BRUTAL FUTURES · ${brutal.universeSize} perp Binance · ${brutal.stats.execute} layak eksekusi · ${brutal.stats.waiting} tunggu trigger · ${brutal.stats.pending} pending order`
      : brutal.scanning ? 'BRUTAL FUTURES · scanning…' : 'BRUTAL FUTURES · menunggu scan pertama'
    if (brutal.scannedAt && brutal.scannedAt !== s.lastBrutalAt) {
      s.lastBrutalAt = brutal.scannedAt
      activity(s, `brutal-${brutal.scannedAt}`, 'SCAN', `BRUTAL FUTURES · scan ${brutal.universeSize} perpetual Binance (klines 15m+1h · funding · ΔOI · top-trader L/S · taker flow) · regime ${brutal.regime.toUpperCase()} · ${brutal.stats.long} LONG / ${brutal.stats.short} SHORT / ${brutal.stats.neutral} NETRAL · ${brutal.stats.execute} layak eksekusi · ${brutal.stats.waiting} belum ada konfirmasi breakout`, 'good')
    }
    brutal.triggered.forEach(p => activity(s, `brutal-trigger-${p.id}-${p.triggeredAt}`, 'ENTRY', `PENDING ORDER · ${p.coinSymbol} ${p.side} · trigger ${p.triggerPrice} TERSANTUH (harga live ${p.lastPrice}) · status naik jadi EXECUTE · masuk gerbang 5-agen`, 'good'))
    // ── BRUTAL FUTURES → Telegram (fire-and-forget, dedup + cooldown persisten
    // di .data/brutal-telegram-sent.json). Hanya sinyal EXECUTE (termasuk pending
    // order yang trigger-nya baru tersentuh) yang dikirim; WAIT/WEAK/NEUTRAL
    // tidak. Kombinasi symbol+side yang sama tidak dikirim ulang selama jendela
    // cooldown (default 4 jam) walau muncul di setiap scan. No-op tanpa
    // TELEGRAM_BOT_TOKEN atau bila BRUTAL_TELEGRAM_ALERTS=false.
    void dispatchBrutalAlerts(brutal.executable, brutal.regime)
    return brutal.executable.map(sig => brutalToSignal(sig, brutal.regime))
  } catch (error: any) {
    s.brutalSource = `BRUTAL FUTURES · error ${String(error?.message || error).slice(0, 70)}`
    return []
  }
}

// ─── BACKGROUND HEARTBEAT ─────────────────────────────────────────────────────
// The engine must keep working while the user browses other menus (or even with
// the dashboard closed): one timer per Node process ticks the full pipeline —
// live scan sync, discovery fallback, real-time mark price, trailing/SL/TP and
// paper entries. Started at server boot (instrumentation.ts) and re-armed by the
// API route as a fallback. Entries stay gated by `running` (START PAPER).
const HEARTBEAT_MS = 15_000
const hbKey = '__crypycryptPaperTraderHeartbeat__' as const
const hbStore = globalThis as typeof globalThis & { [hbKey]?: ReturnType<typeof setInterval> }

export function startPaperTraderHeartbeat() {
  if (hbStore[hbKey]) return false
  hbStore[hbKey] = setInterval(() => { tickPaperTrader().catch(() => null) }, HEARTBEAT_MS)
  hbStore[hbKey]?.unref?.()
  activity(state(), 'heartbeat-boot', 'AGENT', `ENGINE · background heartbeat AKTIF · tick tiap ${HEARTBEAT_MS / 1000}s · harga, SL/TP & entry paper tetap berjalan walau dashboard ditutup / pindah menu`, 'good')
  return true
}

export const heartbeatAlive = () => !!hbStore[hbKey]

// ─── MAIN TICK ────────────────────────────────────────────────────────────────
export async function tickPaperTrader() {
  const s = state()

  // SOURCE 1 (PRIMARY): real in-app signal engine — never blocks the tick;
  // a stale cache triggers a background rescan and returns the last results.
  const live = peekLiveSignals()
  syncEngineLog(s, live)
  let signals: Signal[] = live.signals
  s.signalSource = live.signals.length
    ? `LIVE ENGINE · ${live.signals.length} sinyal real`
    : live.scanning ? 'LIVE ENGINE · scanning…' : 'LIVE ENGINE · 0 sinyal lolos gate'

  // SOURCE 2 (BRUTAL FUTURES): perpetual Binance — arah LONG/SHORT plus gerbang
  // "boleh dieksekusi atau tunggu". Selalu jalan (dipantau walau bot PAUSE),
  // eksekusi entry-nya tetap dikunci `running`.
  if (s.brutalMode) {
    const brutalSignals = await syncBrutal(s)
    if (brutalSignals.length) {
      const taken = new Set(signals.map(item => item.coinSymbol.toUpperCase()))
      const fresh = brutalSignals.filter(item => !taken.has(item.coinSymbol.toUpperCase()))
      signals = [...signals, ...fresh]
      if (!live.signals.length) s.signalSource = `BRUTAL FUTURES · ${fresh.length} setup layak eksekusi`
    }
  } else {
    s.brutalSource = 'BRUTAL FUTURES · OFF'
  }

  // SOURCE 3 (FALLBACK): live DexScreener discovery so the five-agent pipeline
  // stays observable during quiet markets. Clearly labelled in every log.
  if (!signals.length) {
    const dexSignals = await paperTestDiscovery()
    if (dexSignals.length) {
      signals = dexSignals
      s.signalSource = `DEX FALLBACK · ${dexSignals.length} pair live DexScreener`
      activity(s, `dex-fallback-${Math.floor(Date.now() / 30_000)}`, 'SCAN', `LIVE ENGINE 0 sinyal → fallback DexScreener live · ${dexSignals.length} pair Solana teratas sedang dinilai 5 agen`, 'warn')
    }
  }

  // Merge duplicate-symbol positions (same coin opened via two sources):
  // keep the newest, close the older one so OPEN POSITIONS never shows twins.
  const perSymbol = new Map<string, PaperPosition[]>()
  Object.values(s.positions).forEach(p => perSymbol.set(p.coinSymbol.toUpperCase(), [...(perSymbol.get(p.coinSymbol.toUpperCase()) || []), p]))
  perSymbol.forEach(list => { if (list.length > 1) { list.sort((a, b) => +new Date(b.openedAt) - +new Date(a.openedAt)); list.slice(1).forEach(p => close(s, p, 'Duplikat simbol · posisi tertua ditutup otomatis')) } })

  // Mark open positions with real-time prices (signal → DexScreener → Binance → CoinGecko).
  for (const pos of Object.values(s.positions)) {
    pos.currentPrice = await markPrice(pos, signals)
    pos.pnlUsd = pnl(pos, pos.currentPrice)
    // LIKUIDASI — hanya posisi ber-leverage (brutal futures). Kerugian dibatasi
    // sebesar margin yang dikunci, jadi sisa saldo bersama tidak ikut habis.
    const liq = pos.liquidationPrice
    if (liq && (pos.side === 'LONG' ? pos.currentPrice <= liq : pos.currentPrice >= liq)) {
      const margin = marginOf(pos)
      pos.pnlUsd = -margin
      activity(s, `liq-${pos.coinId}-${pos.openedAt}`, 'VETO', `LIKUIDASI · ${pos.coinSymbol.toUpperCase()} ${pos.side} ${leverageOf(pos)}× · harga ${pos.currentPrice} menembus level likuidasi ≈ ${liq} · margin $${margin.toFixed(2)} hangus · saldo setelahnya $${(s.balance - margin).toFixed(2)}`, 'bad')
      close(s, pos, `Likuidasi ${leverageOf(pos)}×`)
      continue
    }
    const movePct = (pos.currentPrice - pos.entryPrice) / pos.entryPrice * (pos.side === 'LONG' ? 100 : -100)
    if (movePct >= CONFIG.trailActivatePct && !pos.trailActive) {
      pos.trailActive = true
      activity(s, `trail-${pos.coinId}-${pos.openedAt}`, 'AGENT', `${pos.coinSymbol.toUpperCase()} · trailing stop AKTIF @ ${movePct >= 0 ? '+' : ''}${movePct.toFixed(2)}% · stop digeser ke ${pos.stopLoss}`, 'good')
    }
    if (pos.trailActive) pos.stopLoss = pos.side === 'LONG' ? Math.max(pos.stopLoss, pos.currentPrice * (1 - CONFIG.trailDistancePct / 100)) : Math.min(pos.stopLoss, pos.currentPrice * (1 + CONFIG.trailDistancePct / 100))
    const stop = pos.side === 'LONG' ? pos.currentPrice <= pos.stopLoss : pos.currentPrice >= pos.stopLoss
    const target = pos.side === 'LONG' ? pos.currentPrice >= pos.tp1 : pos.currentPrice <= pos.tp1
    if (stop) close(s, pos, pos.trailActive ? 'Trailing stop' : 'Stop loss'); else if (target) close(s, pos, 'Take profit')
  }

  // Circuit breakers: daily loss + drawdown + saldo habis.
  const currentEquity = equity(s); s.peakEquity = Math.max(s.peakEquity, currentEquity)
  const drawdown = s.peakEquity > 0 ? (s.peakEquity - currentEquity) / s.peakEquity * 100 : 0
  if (s.dailyPnl <= -s.capital * CONFIG.maxDailyLossPct / 100) tripBreaker(s, `daily loss ${usd(s.dailyPnl)} menembus batas -${CONFIG.maxDailyLossPct}%`)
  else if (drawdown >= CONFIG.maxDrawdownPct) tripBreaker(s, `drawdown ${drawdown.toFixed(1)}% menembus batas ${CONFIG.maxDrawdownPct}%`)
  else if (currentEquity <= s.capital * CONFIG.blownEquityPct / 100) tripBreaker(s, `saldo habis · equity $${currentEquity.toFixed(2)} ≤ ${CONFIG.blownEquityPct}% dari modal $${s.capital.toFixed(2)}`)

  // Always evaluate every fresh signal so the dashboard can show the five-agent
  // consensus while paused. Opening a paper position remains gated by `running`.
  for (const signal of signals) {
    const id = `${signal.coinId}-${signal.signal}-${signal.timestamp}`
    const eligible = valid(signal, s)
    if (s.running && !s.circuitBreaker && !s.processed.has(id)) {
      s.processed.add(id)
      if (eligible) await open(s, signal)
    }
  }
  s.lastTick = Date.now(); return snapshot()
}

export async function command(action: string) {
  const s = state()
  if (action === 'start' && !s.circuitBreaker) {
    s.running = true; s.started = true
    activity(s, `cmd-start-${Date.now()}`, 'AGENT', `ENGINE · paper trading DIMULAI · SALDO $${s.balance.toFixed(2)} (modal $${s.capital.toFixed(2)} · hasil trading ${usd(s.balance - s.capital)}) · margin bebas $${freeMargin(s).toFixed(2)} · maks ${CONFIG.maxPositions} posisi · risk ${CONFIG.riskPct}%/trade · sumber: ${s.signalSource}${s.brutalMode ? ' + BRUTAL FUTURES (satu saldo)' : ''}`, 'good')
  }
  if (action === 'stop') { s.running = false; activity(s, `cmd-stop-${Date.now()}`, 'AGENT', `ENGINE · paper trading DIJEDA · posisi terbuka tetap dipantau & bisa ditutup SL/TP/likuidasi · saldo $${s.balance.toFixed(2)}`, 'warn') }
  if (action === 'close-all') Object.values(s.positions).forEach(p => close(s, p, 'Manual close'))
  if (action === 'reset') { s.circuitBreaker = false; s.consecutiveLoss = 0; s.processed.clear(); s.gateVerdicts = {}; activity(s, `cmd-reset-${Date.now()}`, 'AGENT', `ENGINE · circuit breaker direset · antrean sinyal disegarkan · SALDO TETAP $${s.balance.toFixed(2)} (hasil trading tidak dihapus) · siap dimulai lagi`, 'good') }
  if (action === 'brutal-on') { s.brutalMode = true; activity(s, `cmd-brutal-on-${Date.now()}`, 'AGENT', 'BRUTAL MODE · AKTIF · perpetual Binance futures ikut discan (LONG/SHORT + gerbang eksekusi + pending order)', 'good') }
  if (action === 'brutal-off') { s.brutalMode = false; s.brutalSource = 'BRUTAL FUTURES · OFF'; activity(s, `cmd-brutal-off-${Date.now()}`, 'AGENT', 'BRUTAL MODE · NONAKTIF · hanya live signal engine + DEX fallback', 'warn') }
  return tickPaperTrader()
}

export function snapshot() {
  const s = state(); const w = wallet(s); const totalEquity = w.equity; const trades = s.recentTrades
  const wins = trades.filter(t => t.pnlUsd > 0).length; const losses = trades.filter(t => t.pnlUsd < 0).length
  return {
    ok: true, source: 'paper' as const, running: s.running, dryRun: true, circuitBreaker: s.circuitBreaker,
    heartbeat: heartbeatAlive(), lastTick: s.lastTick,
    totalEquity, peakEquity: s.peakEquity, dailyPnl: s.dailyPnl, totalPnl: totalEquity - s.capital,
    drawdownPct: s.peakEquity > 0 ? (s.peakEquity - totalEquity) / s.peakEquity * 100 : 0,
    consecutiveLoss: s.consecutiveLoss, marketRegime: s.scanReport?.regime || 'signal-follow',
    signalSource: s.signalSource, scanReport: s.scanReport,
    // ── SATU SALDO ───────────────────────────────────────────────────────────
    // `balance` = kas (modal + seluruh realized PnL, normal MAUPUN brutal
    // futures). `wallet` merinci margin terpakai/bebas + kontribusi per sumber.
    balance: s.balance, capital: s.capital, wallet: w,
    brutalMode: s.brutalMode, brutalSignals: s.brutalSignals, pendingOrders: s.pendingOrders,
    brutalStats: s.brutalStats, brutalRegime: s.brutalRegime, brutalScannedAt: s.brutalScannedAt, brutalSource: s.brutalSource,
    positions: Object.values(s.positions), recentTrades: trades, activities: s.activities, agentDecisions: s.agentDecisions,
    // Vonis gerbang per coin → dashboard pakai ini untuk menyembunyikan coin yang
    // sudah jadi posisi / sudah ditolak, lalu memajukan antrian ke coin berikutnya.
    gateVerdicts: s.gateVerdicts,
    stats: {
      totalTrades: trades.length, wins, losses, totalPnlUsd: totalEquity - s.capital,
      realizedPnlUsd: w.realizedPnl, unrealizedPnlUsd: w.unrealizedPnl,
      bestTrade: Math.max(0, ...trades.map(t => t.pnlUsd)), worstTrade: Math.min(0, ...trades.map(t => t.pnlUsd)),
    },
    config: { riskPct: CONFIG.riskPct, maxPositions: CONFIG.maxPositions, effectiveMaxPos: CONFIG.maxPositions, maxDailyLoss: CONFIG.maxDailyLossPct, maxLeverage: CONFIG.maxLeverage, maxNotionalX: CONFIG.maxNotionalX },
  }
}
