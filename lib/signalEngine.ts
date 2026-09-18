// ══════════════════════════════════════════════════════════════════════════
//  LIVE SIGNAL ENGINE — real, self-contained port of crypto-scanner's
//  signal-bot.js (13 quant engines) + sniper-scanner.js confluence logic.
//
//  Data source: Binance public REST (ticker/24hr + klines). No external
//  files, no localhost proxy — everything runs inside this Next.js app.
//
//  Flow (mirrors reference signal-bot.js):
//    1. Fetch top USDT pairs by quote volume (universe filter)
//    2. Detect global market regime from the universe (bull/bear/ranging)
//    3. Per coin: fetch 1h klines (LTF) + 4h klines (HTF confirmation)
//    4. Run engines: Market Structure · BOS/CHoCH · Liquidity · Supply/Demand
//       · Volume Profile · Order Flow (CVD) · Bid/Ask · Whale proxy (OBV)
//       · Volatility · Monte Carlo GBM · RSI+MACD+EMA · RSI Divergence
//       · Sniper Confluence (sweep/volume/candle/BOS/FVG/RSI)
//    5. Bayesian posterior → bullish/bearish/confidence
//    6. HTF alignment + regime + technical penalties, sniper boost
//    7. Trade levels (entry/SL/TP1-3/R:R) + Kelly fraction + EV
//    8. Quality gates → emit Signal objects compatible with paperTrader
// ══════════════════════════════════════════════════════════════════════════

import { fetchJsonResilient } from './binanceDns'

export type LiveSignal = {
  timestamp: string
  coinId: string
  coinSymbol: string
  coinName: string
  signal: 'LONG' | 'SHORT' | 'NEUTRAL'
  signalReason: string
  bullish: number
  bearish: number
  confidence: number
  confidenceRaw: number
  bayesianPLong: number
  bayesianPShort: number
  evidenceCount: number
  weightsMode: string
  kellyFraction: number
  expectedValue: number
  htfTrend: string
  htfAligned: boolean
  mtfReason: string
  technicalPenalty: number
  marketRegime: string
  regimeScore: number
  currentPrice: number
  priceChange24h: number
  volume24h: number
  volatilityScore: number
  entryLow: number
  entryHigh: number
  stopLoss: number
  stopDistancePct: number
  tp1: number
  tp2: number
  tp3: number
  rr: number
  trend: string
  chartPattern: string
  patternBias: string
  bos: string
  whaleBias: string
  whaleScore: number
  volumeRatio: number
  qualityReason: string
  volPhase: string
  mcProbUp: number
  // ── MILESTONE 2 · REFERENCE MERGE (signal-bot.js): konteks struktur & likuiditas ──
  // Semua deterministic dari klines; dipakai konsensus 5-agen paper trader.
  structureQuality: number          // 0-100 kebersihan swing (jumlah swing + BOS − CHoCH)
  patternConfidence: number         // confidence detektor chart pattern
  sweepProbability: number          // probabilitas liquidity sweep
  buySideLiq: number | null         // pool stop terdekat DI ATAS harga (equal highs / swing high)
  sellSideLiq: number | null        // pool stop terdekat DI BAWAH harga (equal lows / swing low)
  delta24h: number                  // delta CVD 24 candle 1h terakhir
  imbalance24h: number              // imbalance buy/sell 24h ternormalisasi -1..1
  mcP10: number                     // Monte Carlo 7h percentile 10% (batas bawah noise)
  mcP90: number                     // Monte Carlo 7h percentile 90% (batas atas noise)
  volumeNodes: { hvn: number[]; lvn: number[] }  // node HVN acceptance / LVN rejection
  subScores: Array<{ label: string; score: number; weight: number }>
  rsi: number
  macdCrossover: string
  techScore: number
  techBias: string
  techConfirmed: boolean
  techReason: string
  rsiDivergence: string
  sniperScore: number
  sniperSignal: string
  sniperSignals: Record<string, { active: boolean; score: number; label: string }>
  source: 'live-signal-engine'
}

export type ScanReport = {
  scannedAt: string
  universe: number
  analyzed: number
  signals: number
  regime: string
  regimeScore: number
  durationMs: number
  lines: string[]
}

// ─── CONFIG (mirrors reference signal-bot.js CONFIG, adapted for Binance) ───
const CONFIG = {
  MIN_CONFIDENCE: 40,
  MIN_BULLISH: 50,
  MIN_BEARISH: 50,
  MAX_STOP_DISTANCE_PCT: 20,
  TOP_N_COINS: 60,
  MIN_QUOTE_VOLUME: 2_000_000,
  MIN_VOLATILITY_PCT: 1.5,
  MIN_SNIPER_SCORE: 40,
  SNIPER_BOOST: 8,
  LTF_INTERVAL: '1h',
  HTF_INTERVAL: '4h',
  LTF_LIMIT: 120,
  HTF_LIMIT: 120,
  BATCH_SIZE: 12,
  BATCH_DELAY_MS: 150,
  MAX_SIGNALS: 24,
  CACHE_TTL_MS: 4 * 60 * 1000,
}

// Adaptive weights are not persisted in this app — use the reference DEFAULT_WEIGHTS.
const WEIGHTS: Record<string, number> = {
  'Market Structure': 0.25,
  'BOS / CHoCH': 0.12,
  'Volume Profile': 0.15,
  'Order Flow (CVD)': 0.15,
  'Bid/Ask Imbalance': 0.08,
  'Whale Activity': 0.10,
  'Volatility Phase': 0.05,
  'Monte Carlo GBM': 0.07,
  'Momentum 24h': 0.03,
}

const KELLY_FRACTION = 0.25
const MAX_KELLY_BET = 0.04

// ─── UTILITIES ───────────────────────────────────────────────────────────────
const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
const stdDev = (arr: number[]) => { const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length) }
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
function randn() {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type Candle = { open: number; high: number; low: number; close: number; volume: number; time: number }

// Binance REST lewat fetchJsonResilient: kalau DNS lokal/ISP memblokir
// *.binance.com, resolver DoH + koneksi TLS ke IP (SNI) mengambil alih otomatis.
async function fetchJson(url: string, timeoutMs = 12_000): Promise<any> {
  return fetchJsonResilient(url, timeoutMs)
}

function parseKlines(raw: any[]): Candle[] {
  if (!Array.isArray(raw)) return []
  return raw.map(k => ({
    time: Number(k[0]),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  })).filter(c => Number.isFinite(c.close) && c.close > 0)
}

// ─── UNIVERSE (top USDT pairs by quote volume — like reference fetchTopCoins) ─
type UniverseCoin = { symbol: string; price: number; change24h: number; quoteVolume: number }

async function fetchUniverse(): Promise<UniverseCoin[]> {
  const data = await fetchJson('https://api.binance.com/api/v3/ticker/24hr', 15_000)
  if (!Array.isArray(data)) throw new Error('Invalid Binance ticker response')
  return data
    .filter((t: any) =>
      t.symbol.endsWith('USDT') &&
      !t.symbol.includes('UP') && !t.symbol.includes('DOWN') &&
      !t.symbol.includes('BULL') && !t.symbol.includes('BEAR') &&
      parseFloat(t.quoteVolume) >= CONFIG.MIN_QUOTE_VOLUME &&
      Math.abs(parseFloat(t.priceChangePercent)) >= CONFIG.MIN_VOLATILITY_PCT &&
      parseFloat(t.lastPrice) > 0)
    .sort((a: any, b: any) => Math.abs(parseFloat(b.priceChangePercent)) - Math.abs(parseFloat(a.priceChangePercent)))
    .slice(0, CONFIG.TOP_N_COINS)
    .map((t: any) => ({
      symbol: t.symbol.replace('USDT', ''),
      price: parseFloat(t.lastPrice),
      change24h: parseFloat(t.priceChangePercent),
      quoteVolume: parseFloat(t.quoteVolume),
    }))
}

// ─── MARKET REGIME (port of detectMarketRegime) ──────────────────────────────
type Regime = { regime: string; score: number }
function detectRegime(universe: UniverseCoin[]): Regime {
  const sample = universe.slice(0, 20)
  let bullCount = 0, bearCount = 0
  for (const c of sample) {
    if (c.change24h > 2) bullCount++
    if (c.change24h < -2) bearCount++
  }
  const avgChange = sample.length ? sample.reduce((s, c) => s + c.change24h, 0) / sample.length : 0
  const score = clamp(Math.round(50 + avgChange * 3 + (bullCount - bearCount) * 1.5), 0, 100)
  const regime = score >= 62 ? 'bull' : score <= 38 ? 'bear' : 'ranging'
  return { regime, score }
}

// ─── QUANT ENGINES (identical math to reference signal-bot.js) ───────────────
function detectSwings(prices: number[], strength = 5) {
  const highs: { idx: number; price: number }[] = [], lows: { idx: number; price: number }[] = []
  for (let i = strength; i < prices.length - strength; i++) {
    const slice = prices.slice(i - strength, i + strength + 1)
    const center = prices[i]
    if (center === Math.max(...slice)) highs.push({ idx: i, price: center })
    if (center === Math.min(...slice)) lows.push({ idx: i, price: center })
  }
  return { highs, lows }
}

function analyzeMarketStructure(prices: number[]) {
  if (!prices || prices.length < 15) return { trend: 'insufficient_data', bos: 'none', choch: false, lastHighs: [] as number[], lastLows: [] as number[], structureQuality: 0, currentPrice: prices?.at(-1) || 0, lastSwingHigh: 0, lastSwingLow: Infinity }
  const { highs, lows } = detectSwings(prices, 5)
  const last3H = highs.slice(-3).map(h => h.price)
  const last3L = lows.slice(-3).map(l => l.price)
  const pattern: string[] = []
  for (let i = 1; i < last3H.length; i++) pattern.push(last3H[i] > last3H[i - 1] ? 'HH' : 'LH')
  for (let i = 1; i < last3L.length; i++) pattern.push(last3L[i] > last3L[i - 1] ? 'HL' : 'LL')
  const hhC = pattern.filter(p => p === 'HH').length, hlC = pattern.filter(p => p === 'HL').length
  const lhC = pattern.filter(p => p === 'LH').length, llC = pattern.filter(p => p === 'LL').length
  let trend: string
  if (hhC >= 1 && hlC >= 1) trend = 'uptrend'
  else if (lhC >= 1 && llC >= 1) trend = 'downtrend'
  else if (hhC >= 1 && llC >= 1) trend = 'reversal_top'
  else if (lhC >= 1 && hlC >= 1) trend = 'reversal_bottom'
  else trend = 'consolidation'
  const currentPrice = prices.at(-1)!
  const lastSwingHigh = last3H.at(-1) || 0
  const lastSwingLow = last3L.at(-1) || Infinity
  const prevHigh = last3H.at(-2) || 0, prevLow = last3L.at(-2) || Infinity
  const bos = currentPrice > lastSwingHigh ? 'bullish_bos' : currentPrice < lastSwingLow ? 'bearish_bos' : 'none'
  const choch = (trend === 'uptrend' && currentPrice < prevLow) || (trend === 'downtrend' && currentPrice > prevHigh)
  const structureQuality = clamp(Math.round((highs.length + lows.length) * 3 + (bos !== 'none' ? 20 : 0) + (choch ? -15 : 10)), 0, 100)
  return { trend, bos, choch, lastHighs: last3H, lastLows: last3L, structureQuality, currentPrice, lastSwingHigh, lastSwingLow }
}

function detectStructurePattern(structure: ReturnType<typeof analyzeMarketStructure>) {
  const highs = structure.lastHighs || []
  const lows = structure.lastLows || []
  if (highs.length < 3 || lows.length < 3) return { name: 'Struktur belum cukup', bias: 'neutral', confidence: 0 }
  const [h1, h2, h3] = highs
  const [l1, l2, l3] = lows
  const near = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b) <= 0.015
  if (near(h2, h3) && l2 > l1 && l3 > l2) return { name: 'Ascending triangle', bias: 'bullish', confidence: 72 }
  if (near(l2, l3) && h2 < h1 && h3 < h2) return { name: 'Descending triangle', bias: 'bearish', confidence: 72 }
  if (h2 > h1 && h3 > h2 && l2 > l1 && l3 > l2) return { name: 'Higher high / higher low', bias: 'bullish', confidence: 68 }
  if (h2 < h1 && h3 < h2 && l2 < l1 && l3 < l2) return { name: 'Lower high / lower low', bias: 'bearish', confidence: 68 }
  return { name: 'Konsolidasi / pola netral', bias: 'neutral', confidence: 45 }
}

function analyzeLiquidity(prices: number[], structure: ReturnType<typeof analyzeMarketStructure>) {
  if (!prices || prices.length < 10) return { equalHighs: false, equalLows: false, sweepProbability: 0, liquidityScore: 50, buySideLiq: null as number | null, sellSideLiq: null as number | null }
  const { highs, lows } = detectSwings(prices, 3)
  const highPrices = highs.map(h => h.price), lowPrices = lows.map(l => l.price)
  const tol = 0.003
  const equalHighs = highPrices.some((h, i) => highPrices.slice(i + 1).some(h2 => Math.abs(h - h2) / h < tol))
  const equalLows = lowPrices.some((l, i) => lowPrices.slice(i + 1).some(l2 => Math.abs(l - l2) / l < tol))
  let sweepProbability = 30
  if (equalHighs) sweepProbability += 25
  if (equalLows) sweepProbability += 25
  if (structure.bos !== 'none') sweepProbability += 15
  sweepProbability = clamp(sweepProbability, 0, 95)
  const liquidityScore = clamp(Math.round(50 + (structure.trend === 'uptrend' ? 15 : structure.trend === 'downtrend' ? -15 : 0) + (equalLows ? 10 : 0) - (equalHighs ? 10 : 0)), 5, 95)
  // ── MILESTONE 2 · REFERENCE MERGE: level harga buySideLiq / sellSideLiq ────────
  // Equal highs = pool stop-loss short tepat di atas harga (buy-side liquidity);
  // equal lows = pool stop long di bawah (sell-side). Harga cenderung tertarik ke
  // pool terdekat sebelum reversal. Deterministik: cluster terdekat di atas/bawah
  // harga sekarang (toleransi 0.3% sama seperti deteksi equal highs/lows di atas),
  // fallback swing high/low terdekat; null bila tidak ada pool tersisa (sudah disapu).
  const cur = prices.at(-1)!
  const clusters = (levels: number[], pick: (a: number, b: number) => number) => {
    const out: number[] = []
    for (let i = 0; i < levels.length; i++)
      for (let j = i + 1; j < levels.length; j++)
        if (Math.abs(levels[i] - levels[j]) / levels[i] < tol) out.push(pick(levels[i], levels[j]))
    return out
  }
  const buyPools = clusters(highPrices, Math.max).filter(l => l > cur * 1.001).sort((a, b) => a - b)
  const sellPools = clusters(lowPrices, Math.min).filter(l => l < cur * 0.999).sort((a, b) => b - a)
  const aboveCur = highPrices.filter(h => h > cur * 1.001)
  const belowCur = lowPrices.filter(l => l < cur * 0.999)
  const buySideLiq = buyPools[0] ?? (aboveCur.length ? Math.min(...aboveCur) : null)
  const sellSideLiq = sellPools[0] ?? (belowCur.length ? Math.max(...belowCur) : null)
  return { equalHighs, equalLows, sweepProbability, liquidityScore, buySideLiq, sellSideLiq }
}

function analyzeSupplyDemand(prices: number[], volumes: number[]) {
  if (!prices || prices.length < 10) return { nearestSupply: null as null | { top: number; bottom: number }, nearestDemand: null as null | { top: number; bottom: number } }
  const n = Math.min(prices.length, volumes.length)
  const avgVol = mean(volumes.slice(-n))
  const supplyZones: { top: number; bottom: number; strength: number }[] = []
  const demandZones: { top: number; bottom: number; strength: number }[] = []
  for (let i = 2; i < n - 1; i++) {
    const p = prices[prices.length - n + i], pPrev = prices[prices.length - n + i - 1]
    const v = volumes[volumes.length - n + i] || 0
    const pctChange = (p - pPrev) / pPrev
    if (Math.abs(pctChange) < 0.015 || v < avgVol * 1.2) continue
    const strength = clamp(Math.round((Math.abs(pctChange) * 500 + (v / avgVol - 1) * 30)), 20, 100)
    const zone = { top: Math.max(p, pPrev) * 1.001, bottom: Math.min(p, pPrev) * 0.999, strength }
    if (pctChange < -0.015) supplyZones.push(zone)
    else demandZones.push(zone)
  }
  supplyZones.sort((a, b) => b.strength - a.strength)
  demandZones.sort((a, b) => b.strength - a.strength)
  const cur = prices.at(-1)!
  const nearestSupply = supplyZones.filter(z => z.bottom > cur).sort((a, b) => a.bottom - b.bottom)[0] || null
  const nearestDemand = demandZones.filter(z => z.top < cur).sort((a, b) => b.top - a.top)[0] || null
  return { nearestSupply, nearestDemand }
}

function analyzeVolumeProfile(prices: number[], volumes: number[]) {
  const noNodes = { hvn: [] as number[], lvn: [] as number[] }
  if (!prices || !volumes || prices.length < 10) return { poc: null as number | null, vah: null as number | null, val: null as number | null, currentVsPoC: 'unknown', volumeNodes: noNodes }
  const n = Math.min(prices.length, volumes.length)
  const BINS = 24, pMin = Math.min(...prices.slice(-n)), pMax = Math.max(...prices.slice(-n))
  const step = (pMax - pMin) / BINS
  if (step === 0) return { poc: null, vah: null, val: null, currentVsPoC: 'unknown', volumeNodes: noNodes }
  const bins = Array.from({ length: BINS }, (_, i) => ({ priceMid: pMin + (i + 0.5) * step, volume: 0 }))
  for (let i = 0; i < n; i++) {
    const p = prices[prices.length - n + i], v = volumes[volumes.length - n + i] || 0
    bins[clamp(Math.floor((p - pMin) / step), 0, BINS - 1)].volume += v
  }
  const totalVol = bins.reduce((s, b) => s + b.volume, 0)
  const pocBin = bins.reduce((mx, b) => b.volume > mx.volume ? b : mx, bins[0])
  const sortedByVol = [...bins].sort((a, b) => b.volume - a.volume)
  let vaVol = 0; const vaBins: typeof bins = []
  for (const b of sortedByVol) { if (vaVol >= totalVol * 0.70) break; vaVol += b.volume; vaBins.push(b) }
  const vaP = vaBins.map(b => b.priceMid)
  const poc = pocBin.priceMid, vah = vaP.length ? Math.max(...vaP) : poc * 1.02, val = vaP.length ? Math.min(...vaP) : poc * 0.98
  const cur = prices.at(-1)!
  // ── MILESTONE 2 · REFERENCE MERGE: volume nodes HVN/LVN ─────────────────────
  // HVN (3 bin terpadat) = area acceptance, harga cenderung chop di sana;
  // LVN (3 bin tertipis) = area rejection/pergerakan cepat. Info untuk agen
  // STRUCTURE & UI — tidak dibobot ke dirProb (sama seperti referensi).
  const volumeNodes = {
    hvn: sortedByVol.slice(0, 3).map(b => +b.priceMid.toPrecision(10)),
    lvn: sortedByVol.slice(-3).map(b => +b.priceMid.toPrecision(10)),
  }
  return { poc, vah, val, currentVsPoC: cur > poc * 1.005 ? 'above' : cur < poc * 0.995 ? 'below' : 'at', volumeNodes }
}

function analyzeOrderFlow(prices: number[], volumes: number[]) {
  if (!prices || !volumes || prices.length < 5) return { cvdTrend: 'neutral', absorption: false, buyPressure: 50, imbalance: 0, institutionalBias: 'neutral', delta24h: 0, imbalance24h: 0 }
  const n = Math.min(prices.length, volumes.length)
  const deltas: number[] = []
  for (let i = 1; i < n; i++) {
    const pDiff = prices[prices.length - n + i] - prices[prices.length - n + i - 1]
    deltas.push(pDiff >= 0 ? (volumes[volumes.length - n + i] || 0) : -(volumes[volumes.length - n + i] || 0))
  }
  const cvd = deltas.slice(-10).reduce((s, d) => s + d, 0)
  const cvdTrend = cvd > 0 ? 'positive' : cvd < 0 ? 'negative' : 'neutral'
  const upVol = deltas.filter(d => d > 0).reduce((s, d) => s + d, 0)
  const totalV = deltas.reduce((s, d) => s + Math.abs(d), 0)
  const buyPressure = totalV > 0 ? Math.round((upVol / totalV) * 100) : 50
  const imbalance = totalV > 0 ? +((upVol - (totalV - upVol)) / totalV).toFixed(3) : 0
  const institutionalBias = imbalance > 0.2 ? 'buyer_dominance' : imbalance < -0.2 ? 'seller_dominance' : 'neutral'
  const rP = prices.slice(-6), rV = volumes.slice(-6)
  const aVol = mean(rV), pr = Math.abs(rP.at(-1)! - rP[0]) / rP[0]
  const absorption = rV.at(-1)! > aVol * 1.5 && pr < 0.005
  // ── MILESTONE 2 · REFERENCE MERGE: delta24h ─────────────────────────────────
  // CVD window penuh mencakup ±5 hari (120 × 1h); delta 24 candle terakhir lebih
  // responsif untuk timing. Diekspos sebagai info — referensi juga tidak mem-
  // bobotnya ke calcDirectionalProb, jadi math weighted-sum tetap identik.
  const d24 = deltas.slice(-24)
  const delta24h = d24.reduce((sum, d) => sum + d, 0)
  const tot24 = d24.reduce((sum, d) => sum + Math.abs(d), 0)
  const up24 = d24.filter(d => d > 0).reduce((sum, d) => sum + d, 0)
  const imbalance24h = tot24 > 0 ? +((up24 - (tot24 - up24)) / tot24).toFixed(3) : 0
  return { cvdTrend, absorption, buyPressure, imbalance, institutionalBias, delta24h, imbalance24h }
}

function analyzeWhaleActivity(prices: number[], volumes: number[], change24h: number, quoteVolume: number) {
  const n = Math.min(prices.length, volumes.length)
  if (n < 5) return { whaleBias: 'unknown', pressureScore: 50, volumeSpike: false, volRatio: 1 }
  const obv = [0]
  for (let i = 1; i < n; i++) {
    const pDiff = prices[prices.length - n + i] - prices[prices.length - n + i - 1]
    const v = volumes[volumes.length - n + i] || 0
    obv.push(obv.at(-1)! + (pDiff > 0 ? v : pDiff < 0 ? -v : 0))
  }
  const obvTrend = obv.at(-1)! - obv[Math.max(0, obv.length - 7)]!
  const avgVol20 = mean(volumes.slice(-20))
  const lastVol = volumes.at(-1) || 0
  const volRatio = avgVol20 > 0 ? lastVol / avgVol20 : 1
  const volumeSpike = volRatio > 1.8
  // Exchange-flow proxy: reference used volume/mcap; here we use 24h change + spike.
  let exchangeFlowProxy = 'neutral'
  if (volumeSpike && change24h > 1) exchangeFlowProxy = 'outflow_buying'
  else if (volumeSpike && change24h < -1) exchangeFlowProxy = 'inflow_selling'
  else if (change24h > 0.5) exchangeFlowProxy = 'mild_buying'
  else if (change24h < -0.5) exchangeFlowProxy = 'mild_selling'
  let pressureScore = 50
  pressureScore += obvTrend > 0 ? 15 : -15
  pressureScore += volumeSpike && change24h > 0 ? 15 : volumeSpike && change24h < 0 ? -15 : 0
  pressureScore += exchangeFlowProxy === 'outflow_buying' ? 15 : exchangeFlowProxy === 'inflow_selling' ? -15 : exchangeFlowProxy === 'mild_buying' ? 8 : exchangeFlowProxy === 'mild_selling' ? -8 : 0
  pressureScore = clamp(Math.round(pressureScore), 5, 95)
  const whaleBias = pressureScore >= 65 ? 'accumulation' : pressureScore <= 35 ? 'distribution' : 'neutral'
  return { whaleBias, pressureScore, volumeSpike, volRatio: +volRatio.toFixed(2) }
}

function analyzeVolatility(prices: number[]) {
  const n = prices.length
  if (n < 14) return { atrPct: 0, bollingerBw: 0, phase: 'unknown', percentile: 50 }
  const trueRanges: number[] = []
  for (let i = 1; i < n; i++) trueRanges.push(Math.abs(prices[i] - prices[i - 1]))
  const atr14 = mean(trueRanges.slice(-14))
  const atrPct = prices.at(-1)! > 0 ? (atr14 / prices.at(-1)!) * 100 : 0
  const window20 = prices.slice(-20)
  const rollingStd = stdDev(window20)
  const sma20 = mean(window20), std20 = stdDev(window20)
  const bbUpper = sma20 + 2 * std20, bbLower = sma20 - 2 * std20
  const bollingerBw = sma20 > 0 ? ((bbUpper - bbLower) / sma20) * 100 : 0
  const fullStd = stdDev(prices)
  const percentile = fullStd > 0 ? clamp(Math.round((rollingStd / fullStd) * 50 + 25), 0, 100) : 50
  const phase = bollingerBw < 4 ? 'contraction' : bollingerBw < 8 ? 'normal' : bollingerBw < 14 ? 'expansion' : 'high_expansion'
  return { atrPct: +atrPct.toFixed(2), bollingerBw: +bollingerBw.toFixed(2), phase, percentile }
}

// ── MILESTONE 2 · REFERENCE MERGE: 500 path (nilai referensi) + p10–p90 ──────
// Percentile membentuk "pita noise 7h": p10 = batas bawah 10% path terburuk,
// p90 = batas atas 10% path terbaik. Jadi konteks agen RISK: SL yang berada di
// dalam pita noise punya概率 stop-out tinggi dari pergerakan acak saja.
function monteCarloGBM(prices: number[], PATHS = 500, STEPS = 7) {
  if (prices.length < 10) { const lastP = prices.at(-1) || 0; return { probUp: 50, p10: lastP, p25: lastP, p50: lastP, p75: lastP, p90: lastP } }
  const logReturns: number[] = []
  for (let i = 1; i < prices.length; i++) if (prices[i - 1] > 0) logReturns.push(Math.log(prices[i] / prices[i - 1]))
  const mu = mean(logReturns), sigma = stdDev(logReturns), S0 = prices.at(-1)!
  const finalPrices: number[] = []
  for (let p = 0; p < PATHS; p++) {
    let S = S0
    for (let t = 0; t < STEPS; t++) S = S * Math.exp((mu - 0.5 * sigma * sigma) + sigma * randn())
    finalPrices.push(S)
  }
  finalPrices.sort((a, b) => a - b)
  const pct = (q: number) => finalPrices[Math.min(PATHS - 1, Math.floor(PATHS * q))]
  return {
    probUp: Math.round(finalPrices.filter(p => p > S0).length / PATHS * 100),
    p10: pct(0.10), p25: pct(0.25), p50: pct(0.50), p75: pct(0.75), p90: pct(0.90),
  }
}

// ─── TECHNICALS (RSI + MACD + EMA + divergence — engines #11 & #12) ─────────
function calcEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null
  const k = 2 / (period + 1)
  let ema = prices.slice(0, period).reduce((s, v) => s + v, 0) / period
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k)
  return ema
}

function calcRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50
  const changes: number[] = []
  for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i - 1])
  const recent = changes.slice(-period)
  const gains = recent.filter(c => c > 0).reduce((s, c) => s + c, 0) / period
  const losses = recent.filter(c => c < 0).reduce((s, c) => s + Math.abs(c), 0) / period
  if (losses === 0) return 100
  const rs = gains / losses
  return clamp(+(100 - 100 / (1 + rs)).toFixed(2), 0, 100)
}

function calcMACD(prices: number[], fast = 12, slow = 26, signal = 9) {
  if (prices.length < slow + signal) return { histogram: 0, crossover: 'none' }
  const macdHistory: number[] = []
  for (let i = slow; i <= prices.length; i++) {
    const slice = prices.slice(0, i)
    const ef = calcEMA(slice, fast)
    const es = calcEMA(slice, slow)
    if (ef != null && es != null) macdHistory.push(ef - es)
  }
  const macdLine = macdHistory.at(-1) || 0
  const signalLine = calcEMA(macdHistory, signal) || 0
  const histogram = macdLine - signalLine
  const prevHistogram = macdHistory.length >= 2 ? (macdHistory.at(-2)! - (calcEMA(macdHistory.slice(0, -1), signal) || 0)) : 0
  let crossover = 'none'
  if (prevHistogram <= 0 && histogram > 0) crossover = 'bullish'
  else if (prevHistogram >= 0 && histogram < 0) crossover = 'bearish'
  return { histogram: +histogram.toFixed(8), crossover }
}

function detectRSIDivergence(prices: number[], rsiPeriod = 14, lookback = 20): { type: string; strength: number } {
  if (prices.length < rsiPeriod + lookback + 5) return { type: 'none', strength: 0 }
  const rsiSeries: number[] = []
  for (let i = rsiPeriod; i < prices.length; i++) rsiSeries.push(calcRSI(prices.slice(i - rsiPeriod, i + 1), rsiPeriod))
  const priceWindow = prices.slice(-lookback)
  const rsiWindow = rsiSeries.slice(-lookback)
  const swingStr = 3
  const priceHighs: { idx: number; val: number }[] = [], priceLows: { idx: number; val: number }[] = []
  const rsiHighs: { idx: number; val: number }[] = [], rsiLows: { idx: number; val: number }[] = []
  for (let i = swingStr; i < priceWindow.length - swingStr; i++) {
    const pSlice = priceWindow.slice(i - swingStr, i + swingStr + 1)
    const rSlice = rsiWindow.slice(i - swingStr, i + swingStr + 1)
    if (priceWindow[i] === Math.max(...pSlice)) priceHighs.push({ idx: i, val: priceWindow[i] })
    if (priceWindow[i] === Math.min(...pSlice)) priceLows.push({ idx: i, val: priceWindow[i] })
    if (rsiWindow[i] === Math.max(...rSlice)) rsiHighs.push({ idx: i, val: rsiWindow[i] })
    if (rsiWindow[i] === Math.min(...rSlice)) rsiLows.push({ idx: i, val: rsiWindow[i] })
  }
  if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
    const pH1 = priceHighs.at(-2)!, pH2 = priceHighs.at(-1)!
    const rH1 = rsiHighs.at(-2)!, rH2 = rsiHighs.at(-1)!
    if (pH2.val > pH1.val && rH2.val < rH1.val && rH2.val > 60) return { type: 'bearish_regular', strength: Math.round((pH2.val - pH1.val) / pH1.val * 100) }
  }
  if (priceLows.length >= 2 && rsiLows.length >= 2) {
    const pL1 = priceLows.at(-2)!, pL2 = priceLows.at(-1)!
    const rL1 = rsiLows.at(-2)!, rL2 = rsiLows.at(-1)!
    if (pL2.val < pL1.val && rL2.val > rL1.val && rL2.val < 45) return { type: 'bullish_regular', strength: Math.round((pL1.val - pL2.val) / pL1.val * 100) }
  }
  if (priceLows.length >= 2 && rsiLows.length >= 2) {
    const pL1 = priceLows.at(-2)!, pL2 = priceLows.at(-1)!
    const rL1 = rsiLows.at(-2)!, rL2 = rsiLows.at(-1)!
    if (pL2.val > pL1.val && rL2.val < rL1.val) return { type: 'bullish_hidden', strength: Math.round((pL2.val - pL1.val) / pL1.val * 100) }
  }
  if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
    const pH1 = priceHighs.at(-2)!, pH2 = priceHighs.at(-1)!
    const rH1 = rsiHighs.at(-2)!, rH2 = rsiHighs.at(-1)!
    if (pH2.val < pH1.val && rH2.val > rH1.val) return { type: 'bearish_hidden', strength: Math.round((pH1.val - pH2.val) / pH1.val * 100) }
  }
  return { type: 'none', strength: 0 }
}

function analyzeTechnicals(prices: number[]) {
  if (!prices || prices.length < 30) return { rsi: 50, macd: { crossover: 'none', histogram: 0 }, techScore: 50, techBias: 'neutral', techConfirmed: false, techReason: 'Data tidak cukup', divType: 'none' }
  const rsi = calcRSI(prices, 14)
  const macd = calcMACD(prices)
  const ema9 = calcEMA(prices, 9)
  const ema21 = calcEMA(prices, 21)
  const ema50 = calcEMA(prices, Math.min(50, prices.length - 1))
  const cur = prices.at(-1)!
  const aboveEma9 = ema9 != null && cur > ema9
  const aboveEma21 = ema21 != null && cur > ema21
  const aboveEma50 = ema50 != null && cur > ema50
  const bullishEma = [aboveEma9, aboveEma21, aboveEma50].filter(Boolean).length
  const emaScore = Math.round(50 + (bullishEma - 1.5) * 20)
  let rsiScore = 50
  if (rsi < 30) rsiScore = 85
  else if (rsi < 40) rsiScore = 68
  else if (rsi > 70) rsiScore = 15
  else if (rsi > 60) rsiScore = 32
  let macdScore = 50
  if (macd.crossover === 'bullish') macdScore = 80
  else if (macd.crossover === 'bearish') macdScore = 20
  else if (macd.histogram > 0) macdScore = 62
  else if (macd.histogram < 0) macdScore = 38
  const divResult = detectRSIDivergence(prices)
  let divScore = 50
  if (divResult.type === 'bullish_regular') divScore = 82
  else if (divResult.type === 'bearish_regular') divScore = 18
  else if (divResult.type === 'bullish_hidden') divScore = 70
  else if (divResult.type === 'bearish_hidden') divScore = 30
  const techScore = clamp(Math.round(emaScore * 0.35 + rsiScore * 0.30 + macdScore * 0.25 + divScore * 0.10), 5, 95)
  const techBias = techScore >= 60 ? 'bullish' : techScore <= 40 ? 'bearish' : 'neutral'
  const bullSignals = [emaScore >= 60, rsiScore >= 60, macdScore >= 60].filter(Boolean).length
  const bearSignals = [emaScore <= 40, rsiScore <= 40, macdScore <= 40].filter(Boolean).length
  const techConfirmed = bullSignals >= 2 || bearSignals >= 2
  const reasons: string[] = []
  if (aboveEma9 && aboveEma21 && aboveEma50) reasons.push('EMA bullish stack')
  else if (!aboveEma9 && !aboveEma21 && !aboveEma50) reasons.push('EMA bearish stack')
  if (rsi < 35) reasons.push(`RSI oversold (${rsi})`)
  else if (rsi > 65) reasons.push(`RSI overbought (${rsi})`)
  if (macd.crossover !== 'none') reasons.push(`MACD ${macd.crossover} crossover`)
  if (divResult.type !== 'none') reasons.push(`RSI ${divResult.type.replace('_', ' ')}`)
  return { rsi, macd, techScore, techBias, techConfirmed, techReason: reasons.join(' | ') || 'No strong tech signal', divType: divResult.type }
}

// ─── BAYESIAN UPDATER (port of bayesianUpdate + buildBayesianEvidences) ──────
function bayesianUpdate(priorBullish: number, evidences: { pEgivenLong: number; pEgivenShort: number }[]) {
  let pLong = priorBullish / 100
  let pShort = 1 - pLong
  for (const { pEgivenLong, pEgivenShort } of evidences) {
    const pE = pEgivenLong * pLong + pEgivenShort * pShort
    if (pE <= 0) continue
    pLong = (pEgivenLong * pLong) / pE
    pShort = (pEgivenShort * pShort) / pE
    const total = pLong + pShort
    pLong /= total
    pShort /= total
  }
  return { pLong: clamp(pLong, 0.01, 0.99), pShort: clamp(pShort, 0.01, 0.99) }
}

// ─── SNIPER CONFLUENCE (engine #13 — real OHLCV, port of calcSniperConfluence) ─
function calcSniperConfluence(candles: Candle[]) {
  if (!candles || candles.length < 30) return { score: 0, signal: 'WAIT', sniperScore: 0, signals: {} as Record<string, { active: boolean; score: number; label: string }> }
  const opens = candles.map(c => c.open)
  const highs = candles.map(c => c.high)
  const lows = candles.map(c => c.low)
  const closes = candles.map(c => c.close)
  const volumes = candles.map(c => c.volume)
  const last = closes.length - 1

  // 1. Liquidity Sweep (+25)
  const recentLow = Math.min(...lows.slice(last - 20, last - 1))
  const sweepCandle = lows[last] < recentLow && closes[last] > recentLow
  const sweepScore = sweepCandle ? 25 : 0

  // 2. Volume Spike (+20)
  const avgVol = volumes.slice(last - 20, last).reduce((a, b) => a + b, 0) / 20
  const volRatio = volumes[last] / (avgVol || 1)
  const volScore = volRatio >= 2.5 ? 20 : volRatio >= 1.8 ? 12 : volRatio >= 1.3 ? 6 : 0

  // 3. Bullish Reversal Candle (+15)
  const body = Math.abs(closes[last] - opens[last])
  const lwick = Math.min(opens[last], closes[last]) - lows[last]
  const bullCandle = closes[last] > opens[last] && lwick >= 1.5 * body
  const engulf = closes[last] > opens[last - 1] && opens[last] < closes[last - 1]
  const candleScore = (bullCandle || engulf) ? 15 : 0

  // 4. BOS ke atas (+20)
  const prev5High = Math.max(...highs.slice(last - 6, last - 1))
  const bosUp = closes[last] > prev5High
  const bosScore = bosUp ? 20 : 0

  // 5. FVG/Demand area (+10)
  let fvgScore = 0
  for (let i = last - 5; i <= last - 1; i++) {
    if (i < 2) continue
    const fvgLow = highs[i - 2]
    const fvgHigh = lows[i]
    if (fvgHigh > fvgLow && closes[last] >= fvgLow && closes[last] <= fvgHigh + (fvgHigh - fvgLow) * 2) { fvgScore = 10; break }
  }

  // 6. RSI (+10)
  const rsiNow = calcRSI(closes, 14)
  const rsiPrev = calcRSI(closes.slice(0, last - 5), 14)
  const priceMakesLL = closes[last] < Math.min(...closes.slice(last - 10, last - 1))
  const rsiDiverg = priceMakesLL && rsiNow > rsiPrev + 3
  const rsiScore = (rsiNow < 35 ? 6 : 0) + (rsiDiverg ? 4 : 0)

  const totalScore = sweepScore + volScore + candleScore + bosScore + fvgScore + rsiScore
  let signal = 'WAIT'
  if (totalScore >= 80) signal = 'SNIPER'
  else if (totalScore >= 60) signal = 'WATCH'
  else if (totalScore >= 40) signal = 'SETUP'

  return {
    score: totalScore,
    signal,
    sniperScore: totalScore,
    signals: {
      sweep: { active: sweepScore > 0, score: sweepScore, label: 'Liquidity Sweep' },
      volume: { active: volScore > 0, score: volScore, label: `Volume Spike ${volRatio.toFixed(1)}x` },
      candle: { active: candleScore > 0, score: candleScore, label: bullCandle ? 'Hammer' : 'Bullish Engulfing' },
      bos: { active: bosScore > 0, score: bosScore, label: 'BOS ke Atas' },
      fvg: { active: fvgScore > 0, score: fvgScore, label: 'Di Area FVG/Demand' },
      rsi: { active: rsiScore > 0, score: rsiScore, label: `RSI ${rsiNow.toFixed(0)}${rsiDiverg ? ' + Divergence' : ''}` },
    } as Record<string, { active: boolean; score: number; label: string }>,
  }
}

// ─── DIRECTIONAL PROBABILITY (port of calcDirectionalProb) ───────────────────
function calcDirectionalProb(
  structure: ReturnType<typeof analyzeMarketStructure>,
  volumeProfile: ReturnType<typeof analyzeVolumeProfile>,
  orderFlow: ReturnType<typeof analyzeOrderFlow>,
  whale: ReturnType<typeof analyzeWhaleActivity>,
  volatility: ReturnType<typeof analyzeVolatility>,
  monteCarlo: ReturnType<typeof monteCarloGBM>,
  change24h: number,
  technicals: ReturnType<typeof analyzeTechnicals>,
) {
  const scores: { label: string; score: number; weight: number }[] = []
  const msScore = structure.trend === 'uptrend' ? 80 : structure.trend === 'reversal_bottom' ? 65 : structure.trend === 'consolidation' ? 50 : structure.trend === 'reversal_top' ? 35 : 20
  scores.push({ label: 'Market Structure', score: msScore, weight: WEIGHTS['Market Structure'] })
  let bosScore = structure.bos === 'bullish_bos' ? 82 : structure.bos === 'bearish_bos' ? 18 : 50
  if (structure.choch) bosScore = structure.trend === 'uptrend' ? 25 : 75
  scores.push({ label: 'BOS / CHoCH', score: bosScore, weight: WEIGHTS['BOS / CHoCH'] })
  const vpScore = volumeProfile.currentVsPoC === 'above' ? 70 : volumeProfile.currentVsPoC === 'at' ? 52 : 30
  scores.push({ label: 'Volume Profile', score: vpScore, weight: WEIGHTS['Volume Profile'] })
  const ofScore = orderFlow.cvdTrend === 'positive' ? 72 : orderFlow.cvdTrend === 'negative' ? 28 : 50
  const absAdj = orderFlow.absorption ? (orderFlow.cvdTrend === 'positive' ? 8 : -8) : 0
  scores.push({ label: 'Order Flow (CVD)', score: clamp(ofScore + absAdj, 5, 95), weight: WEIGHTS['Order Flow (CVD)'] })
  scores.push({ label: 'Bid/Ask Imbalance', score: clamp(Math.round(50 + orderFlow.imbalance * 100), 5, 95), weight: WEIGHTS['Bid/Ask Imbalance'] })
  scores.push({ label: 'Whale Activity', score: whale.pressureScore, weight: WEIGHTS['Whale Activity'] })
  const volScore = volatility.phase === 'contraction' ? 50 : volatility.phase === 'expansion' ? (structure.trend === 'uptrend' ? 68 : 32) : volatility.phase === 'high_expansion' ? 40 : 50
  scores.push({ label: 'Volatility Phase', score: volScore, weight: WEIGHTS['Volatility Phase'] })
  scores.push({ label: 'Monte Carlo GBM', score: monteCarlo.probUp ?? 50, weight: WEIGHTS['Monte Carlo GBM'] })
  scores.push({ label: 'Momentum 24h', score: clamp(Math.round(50 + change24h * 2), 5, 95), weight: WEIGHTS['Momentum 24h'] })
  scores.push({ label: 'RSI+MACD+EMA', score: technicals.techScore ?? 50, weight: 0.12 })

  const totalW = scores.reduce((s, m) => s + m.weight, 0)
  const rawBullish = scores.reduce((s, m) => s + m.score * (m.weight / totalW), 0)
  const weightedBullish = clamp(Math.round(rawBullish), 5, 95)

  // Bayesian evidences (port of buildBayesianEvidences)
  const evidences: { pEgivenLong: number; pEgivenShort: number }[] = []
  if (structure.bos === 'bullish_bos') evidences.push({ pEgivenLong: 0.82, pEgivenShort: 0.18 })
  else if (structure.bos === 'bearish_bos') evidences.push({ pEgivenLong: 0.18, pEgivenShort: 0.82 })
  if (orderFlow.cvdTrend === 'positive') evidences.push({ pEgivenLong: 0.75, pEgivenShort: 0.25 })
  else if (orderFlow.cvdTrend === 'negative') evidences.push({ pEgivenLong: 0.25, pEgivenShort: 0.75 })
  if (whale.whaleBias === 'accumulation') evidences.push({ pEgivenLong: 0.78, pEgivenShort: 0.22 })
  else if (whale.whaleBias === 'distribution') evidences.push({ pEgivenLong: 0.22, pEgivenShort: 0.78 })
  const mcP = (monteCarlo.probUp || 50) / 100
  evidences.push({ pEgivenLong: mcP, pEgivenShort: 1 - mcP })
  if (volatility.phase === 'expansion' || volatility.phase === 'high_expansion') {
    const aligned = structure.trend === 'uptrend' ? 0.70 : structure.trend === 'downtrend' ? 0.30 : 0.50
    evidences.push({ pEgivenLong: aligned, pEgivenShort: 1 - aligned })
  }
  if (Math.abs(change24h) > 3) {
    const pL = change24h > 0 ? 0.72 : 0.28
    evidences.push({ pEgivenLong: pL, pEgivenShort: 1 - pL })
  }

  const bayesian = bayesianUpdate(weightedBullish, evidences)
  const bullish = clamp(Math.round(bayesian.pLong * 100), 5, 95)
  const confidence = Math.round(Math.abs(bullish - 50) * 2)

  let techPenalty = 0
  if (technicals.techConfirmed) {
    if (bullish >= 60 && technicals.techBias === 'bearish') techPenalty = 15
    if (bullish <= 40 && technicals.techBias === 'bullish') techPenalty = 15
  }

  return {
    bullish, bearish: 100 - bullish,
    subScores: scores,
    confidence: Math.max(0, confidence - techPenalty),
    bayesianPLong: +bayesian.pLong.toFixed(4),
    bayesianPShort: +bayesian.pShort.toFixed(4),
    evidenceCount: evidences.length,
    techPenalty,
  }
}

// ─── TRADE LEVELS (port of calcTradeLevels, real OHLC-based) ─────────────────
function calcTradeLevels(prices: number[], structure: ReturnType<typeof analyzeMarketStructure>, volumeProfile: ReturnType<typeof analyzeVolumeProfile>, dirProb: { bullish: number; bearish: number; confidence: number }, supplyDemand: ReturnType<typeof analyzeSupplyDemand>, liquidity: ReturnType<typeof analyzeLiquidity>) {
  const currentPrice = prices.at(-1)!
  const isBullish = dirProb.bullish >= 55
  let entryLow: number, entryHigh: number
  if (isBullish && supplyDemand.nearestDemand) {
    entryLow = supplyDemand.nearestDemand.bottom; entryHigh = supplyDemand.nearestDemand.top
  } else if (!isBullish && supplyDemand.nearestSupply) {
    entryLow = supplyDemand.nearestSupply.bottom; entryHigh = supplyDemand.nearestSupply.top
  } else {
    entryLow = volumeProfile.val ? Math.min(currentPrice, volumeProfile.val) : currentPrice * 0.98
    entryHigh = volumeProfile.poc ? Math.min(currentPrice * 1.005, volumeProfile.poc) : currentPrice * 1.005
  }
  let stopLoss: number
  if (isBullish) stopLoss = Math.min(structure.lastSwingLow || currentPrice * 0.92, (volumeProfile.val || currentPrice * 0.95) * 0.985)
  else stopLoss = Math.max(structure.lastSwingHigh || currentPrice * 1.08, (volumeProfile.vah || currentPrice * 1.05) * 1.015)
  let tp1: number, tp2: number, tp3: number
  if (isBullish) {
    const r = currentPrice - stopLoss
    tp1 = currentPrice + r * 1.5; tp2 = currentPrice + r * 2.5
    tp3 = Math.max(structure.lastSwingHigh > currentPrice ? structure.lastSwingHigh * 1.01 : 0, currentPrice + r * 4.0)
  } else {
    const r = stopLoss - currentPrice
    tp1 = currentPrice - r * 1.5; tp2 = currentPrice - r * 2.5
    tp3 = Math.min(structure.lastSwingLow < currentPrice ? structure.lastSwingLow * 0.99 : Infinity, currentPrice - r * 4.0)
  }
  // ── MILESTONE 2 · REFERENCE MERGE: tp3 magnet likuiditas ─────────────────────
  // Pool equal-highs/lows adalah tempat stop-loss menumpuk dan harga cenderung
  // tertarik ke sana. HANYA tp3 (target akhir) yang disesuaikan — rr/Kelly/EV
  // semua berbasis tp1 dan SL tidak berubah, jadi math risiko tetap identik
  // dengan referensi. Guard > tp2 / < tp2 menjaga urutan tetap valid untuk
  // hasValidTradeLevels (tp2 < tp3 LONG / tp2 > tp3 SHORT).
  if (isBullish && liquidity.buySideLiq != null && liquidity.buySideLiq > tp2) tp3 = Math.max(tp3, liquidity.buySideLiq * 1.002)
  if (!isBullish && liquidity.sellSideLiq != null && liquidity.sellSideLiq < tp2) tp3 = Math.min(tp3, liquidity.sellSideLiq * 0.998)
  const slDist = Math.abs(currentPrice - stopLoss)
  const rr = slDist > 0 ? +((Math.abs(tp1 - currentPrice)) / slDist).toFixed(2) : 0
  let signal: 'LONG' | 'SHORT' | 'WAIT' = 'WAIT', signalReason = 'Probabilitas belum cukup kuat.'
  if (dirProb.bullish > CONFIG.MIN_BULLISH && dirProb.confidence > CONFIG.MIN_CONFIDENCE) { signal = 'LONG'; signalReason = `Bullish ${dirProb.bullish}% (conf ${dirProb.confidence}%)` }
  else if (dirProb.bearish > CONFIG.MIN_BEARISH && dirProb.confidence > CONFIG.MIN_CONFIDENCE) { signal = 'SHORT'; signalReason = `Bearish ${dirProb.bearish}% (conf ${dirProb.confidence}%)` }
  const fmt = (v: number) => v == null || !Number.isFinite(v) ? currentPrice : +v.toPrecision(10)
  return { signal, signalReason, bias: isBullish ? 'LONG' : 'SHORT', entryLow: fmt(entryLow), entryHigh: fmt(entryHigh), stopLoss: fmt(stopLoss), tp1: fmt(tp1), tp2: fmt(tp2), tp3: fmt(tp3), rr }
}

function hasValidTradeLevels(levels: ReturnType<typeof calcTradeLevels>, currentPrice: number) {
  const values = [levels.stopLoss, levels.tp1, levels.tp2, levels.tp3, currentPrice]
  if (values.some(v => !Number.isFinite(v) || v <= 0)) return false
  return levels.signal === 'LONG'
    ? levels.stopLoss < currentPrice && currentPrice < levels.tp1 && levels.tp1 < levels.tp2 && levels.tp2 < levels.tp3
    : levels.stopLoss > currentPrice && currentPrice > levels.tp1 && levels.tp1 > levels.tp2 && levels.tp2 > levels.tp3
}

// ─── QUALITY GATE (port of localQualityGate) ─────────────────────────────────
function localQualityGate(signal: string, structure: ReturnType<typeof analyzeMarketStructure>, whale: ReturnType<typeof analyzeWhaleActivity>, volumes: number[], chartPattern: ReturnType<typeof detectStructurePattern>, sniperConfluence: ReturnType<typeof calcSniperConfluence>) {
  const lastVolume = volumes.at(-1) || 0
  const avgVolume = mean(volumes.slice(-21, -1))
  const volumeRatio = avgVolume > 0 ? lastVolume / avgVolume : 0
  const expectedBos = signal === 'LONG' ? 'bullish_bos' : 'bearish_bos'
  const expectedWhale = signal === 'LONG' ? 'accumulation' : 'distribution'
  const sniperBypass = sniperConfluence && sniperConfluence.sniperScore >= 60

  if (!sniperBypass && chartPattern.bias !== 'neutral' && chartPattern.bias !== (signal === 'LONG' ? 'bullish' : 'bearish')) return { pass: false, reason: `pola ${chartPattern.name} berlawanan`, volumeRatio }
  if (!sniperBypass && structure.bos !== expectedBos) return { pass: false, reason: `belum ada ${expectedBos}`, volumeRatio }
  if (volumeRatio < 1.2) return { pass: false, reason: `volume lemah (${volumeRatio.toFixed(2)}x, min 1.20x)`, volumeRatio }
  if (!sniperBypass && whale.whaleBias !== expectedWhale) return { pass: false, reason: `volume/OBV tidak mendukung (${whale.whaleBias})`, volumeRatio }
  const reason = sniperBypass
    ? `${chartPattern.name} + volume ${volumeRatio.toFixed(2)}x + Sniper ${sniperConfluence.signal}`
    : `${chartPattern.name} + BOS + volume ${volumeRatio.toFixed(2)}x + ${expectedWhale}`
  return { pass: true, reason, volumeRatio }
}

// ─── KELLY + EV (port of calcKelly / calcExpectedValue) ──────────────────────
function calcKelly(pWin: number, payoffRatio: number) {
  if (pWin <= 0 || pWin >= 1 || payoffRatio <= 0) return 0
  const q = 1 - pWin
  const fullKelly = (payoffRatio * pWin - q) / payoffRatio
  if (fullKelly <= 0) return 0
  return clamp(fullKelly * KELLY_FRACTION, 0, MAX_KELLY_BET)
}
function calcExpectedValue(pWin: number, payoffRatio: number, costPct = 0.001) {
  return +(pWin * payoffRatio - (1 - pWin) - costPct).toFixed(4)
}

// ─── HTF CONFIRMATION (port of getHTFConfirmation, uses real 4h klines) ──────
function getHTFConfirmation(htfPrices: number[], ltfSignal: string) {
  if (!htfPrices || htfPrices.length < 20) return { aligned: false, htfTrend: 'unknown', penalty: -8, reason: 'Data HTF tidak cukup' }
  const htfStructure = analyzeMarketStructure(htfPrices)
  const htfTrend = htfStructure.trend
  const isLong = ltfSignal === 'LONG'
  const bullish = ['uptrend', 'reversal_bottom']
  const bearish = ['downtrend', 'reversal_top']
  let aligned = true, penalty = 0, reason = ''
  if (isLong && bearish.includes(htfTrend)) { aligned = false; penalty = htfTrend === 'reversal_top' ? -14 : -10; reason = `HTF ${htfTrend} (kontra LONG)` }
  else if (!isLong && bullish.includes(htfTrend)) { aligned = false; penalty = htfTrend === 'reversal_bottom' ? -14 : -10; reason = `HTF ${htfTrend} (kontra SHORT)` }
  else if (isLong && bullish.includes(htfTrend)) { penalty = 5; reason = `HTF ${htfTrend} ✅ aligned` }
  else if (!isLong && bearish.includes(htfTrend)) { penalty = 5; reason = `HTF ${htfTrend} ✅ aligned` }
  else { reason = `HTF ${htfTrend} netral` }
  return { aligned, htfTrend, penalty, reason }
}

// ─── PER-COIN SCAN (port of scanCoin, with structured skip reasons) ──────────
type ScanOutcome = { signal: LiveSignal | null; skipReason: string | null }

async function fetchKlines(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`
  return parseKlines(await fetchJson(url))
}

async function scanCoin(coin: UniverseCoin, regime: Regime): Promise<ScanOutcome> {
  try {
    const [ltfCandles, htfCandles] = await Promise.all([
      fetchKlines(coin.symbol, CONFIG.LTF_INTERVAL, CONFIG.LTF_LIMIT),
      fetchKlines(coin.symbol, CONFIG.HTF_INTERVAL, CONFIG.HTF_LIMIT),
    ])
    if (ltfCandles.length < 40) return { signal: null, skipReason: `data candle tidak cukup (${ltfCandles.length})` }

    const prices = ltfCandles.map(c => c.close)
    const volumes = ltfCandles.map(c => c.volume)
    const htfPrices = htfCandles.map(c => c.close)

    const structure = analyzeMarketStructure(prices)
    const chartPattern = detectStructurePattern(structure)
    const liquidity = analyzeLiquidity(prices, structure)
    const supplyDemand = analyzeSupplyDemand(prices, volumes)
    const volumeProfile = analyzeVolumeProfile(prices, volumes)
    const orderFlow = analyzeOrderFlow(prices, volumes)
    const whale = analyzeWhaleActivity(prices, volumes, coin.change24h, coin.quoteVolume)
    const volatility = analyzeVolatility(prices)
    const monteCarlo = monteCarloGBM(prices)
    const technicals = analyzeTechnicals(prices)
    const sniperConfluence = calcSniperConfluence(ltfCandles)
    const dirProb = calcDirectionalProb(structure, volumeProfile, orderFlow, whale, volatility, monteCarlo, coin.change24h, technicals)
    // Expose the real liquidity score as a zero-weight sub-score so downstream
    // consumers (paper trader STRUCTURE agent) can read it without altering
    // the reference weighted-sum math.
    dirProb.subScores.push({ label: 'Liquidity', score: liquidity.liquidityScore, weight: 0 })
    const tradeLevels = calcTradeLevels(prices, structure, volumeProfile, dirProb, supplyDemand, liquidity)

    if (tradeLevels.signal === 'WAIT') return { signal: null, skipReason: `WAIT · bullish ${dirProb.bullish}% conf ${dirProb.confidence}%` }

    const currentPrice = prices.at(-1)!
    if (!hasValidTradeLevels(tradeLevels, currentPrice)) return { signal: null, skipReason: 'urutan SL/TP tidak valid' }

    const stopDistancePct = Math.abs(currentPrice - tradeLevels.stopLoss) / currentPrice * 100
    if (stopDistancePct > CONFIG.MAX_STOP_DISTANCE_PCT) return { signal: null, skipReason: `SL terlalu jauh (${stopDistancePct.toFixed(1)}%)` }

    const quality = localQualityGate(tradeLevels.signal, structure, whale, volumes, chartPattern, sniperConfluence)
    if (!quality.pass) return { signal: null, skipReason: quality.reason }

    // HTF confirmation (real 4h klines)
    const mtf = getHTFConfirmation(htfPrices, tradeLevels.signal)
    let adjustedConfidence = clamp(dirProb.confidence + mtf.penalty, 0, 100)

    // Technical penalty
    const expectedTechBias = tradeLevels.signal === 'LONG' ? 'bullish' : 'bearish'
    let technicalPenalty = 0
    if (!technicals.techConfirmed) technicalPenalty = -1
    else if (technicals.techBias !== expectedTechBias) technicalPenalty = -5
    adjustedConfidence = clamp(adjustedConfidence + technicalPenalty, 0, 100)

    // Regime adjustment
    let regimeAdjust = 0
    if (regime.regime !== 'unknown') {
      if (regime.regime === 'bear' && tradeLevels.signal === 'LONG') regimeAdjust = -3
      if (regime.regime === 'bull' && tradeLevels.signal === 'SHORT') regimeAdjust = -3
      if (regime.regime === 'bear' && tradeLevels.signal === 'SHORT') regimeAdjust = +3
      if (regime.regime === 'bull' && tradeLevels.signal === 'LONG') regimeAdjust = +3
      adjustedConfidence = clamp(adjustedConfidence + regimeAdjust, 0, 100)
    }

    // Sniper confluence boost
    let sniperBoost = 0
    if (sniperConfluence.sniperScore >= CONFIG.MIN_SNIPER_SCORE) sniperBoost = CONFIG.SNIPER_BOOST
    adjustedConfidence = clamp(adjustedConfidence + sniperBoost, 0, 100)

    if (adjustedConfidence < CONFIG.MIN_CONFIDENCE) return { signal: null, skipReason: `confidence ${dirProb.confidence}% → ${adjustedConfidence}% setelah HTF/tech/regime/sniper (${mtf.reason})` }

    // Kelly + EV gate
    const pWin = tradeLevels.signal === 'LONG' ? dirProb.bayesianPLong : dirProb.bayesianPShort
    const payoff = tradeLevels.rr || 1.5
    const kellyFrac = calcKelly(pWin, payoff)
    const ev = calcExpectedValue(pWin, payoff)
    if (kellyFrac < 0.003 || ev < -0.5) return { signal: null, skipReason: `Kelly=${(kellyFrac * 100).toFixed(2)}% EV=${ev}` }

    const signal: LiveSignal = {
      timestamp: new Date().toISOString(),
      coinId: coin.symbol.toLowerCase(),
      coinSymbol: coin.symbol.toLowerCase(),
      coinName: `${coin.symbol}/USDT`,
      signal: tradeLevels.signal,
      signalReason: tradeLevels.signalReason,
      bullish: dirProb.bullish,
      bearish: dirProb.bearish,
      confidence: adjustedConfidence,
      confidenceRaw: dirProb.confidence,
      bayesianPLong: dirProb.bayesianPLong,
      bayesianPShort: dirProb.bayesianPShort,
      evidenceCount: dirProb.evidenceCount,
      weightsMode: 'DEFAULT',
      kellyFraction: +kellyFrac.toFixed(4),
      expectedValue: ev,
      htfTrend: mtf.htfTrend,
      htfAligned: mtf.aligned,
      mtfReason: mtf.reason,
      technicalPenalty,
      marketRegime: regime.regime,
      regimeScore: regime.score,
      currentPrice,
      priceChange24h: coin.change24h,
      volume24h: coin.quoteVolume,
      volatilityScore: Math.round(Math.abs(coin.change24h) * 10) / 10,
      entryLow: tradeLevels.entryLow,
      entryHigh: tradeLevels.entryHigh,
      stopLoss: tradeLevels.stopLoss,
      stopDistancePct: +stopDistancePct.toFixed(2),
      tp1: tradeLevels.tp1,
      tp2: tradeLevels.tp2,
      tp3: tradeLevels.tp3,
      rr: tradeLevels.rr,
      trend: structure.trend,
      chartPattern: chartPattern.name,
      patternBias: chartPattern.bias,
      bos: structure.bos,
      whaleBias: whale.whaleBias,
      whaleScore: whale.pressureScore,
      volumeRatio: +quality.volumeRatio.toFixed(2),
      qualityReason: quality.reason,
      volPhase: volatility.phase,
      mcProbUp: monteCarlo.probUp,
      // ── MILESTONE 2 · REFERENCE MERGE: konteks struktur & likuiditas ──
      structureQuality: structure.structureQuality,
      patternConfidence: chartPattern.confidence,
      sweepProbability: liquidity.sweepProbability,
      buySideLiq: liquidity.buySideLiq,
      sellSideLiq: liquidity.sellSideLiq,
      delta24h: Math.round(orderFlow.delta24h),
      imbalance24h: orderFlow.imbalance24h,
      mcP10: monteCarlo.p10,
      mcP90: monteCarlo.p90,
      volumeNodes: volumeProfile.volumeNodes,
      subScores: dirProb.subScores,
      rsi: technicals.rsi,
      macdCrossover: technicals.macd.crossover,
      techScore: technicals.techScore,
      techBias: technicals.techBias,
      techConfirmed: technicals.techConfirmed,
      techReason: technicals.techReason,
      rsiDivergence: technicals.divType,
      sniperScore: sniperConfluence.sniperScore,
      sniperSignal: sniperConfluence.signal,
      sniperSignals: sniperConfluence.signals,
      source: 'live-signal-engine',
    }
    return { signal, skipReason: null }
  } catch (err: any) {
    return { signal: null, skipReason: `fetch error: ${err?.message || err}` }
  }
}

// ─── SCAN CACHE (server-side singleton, survives across requests) ────────────
type Cache = { signals: LiveSignal[]; report: ScanReport | null; updatedAt: number; scanning: Promise<ScanReport> | null }
const cacheKey = '__crypycryptSignalEngine__' as const
const cacheStore = globalThis as typeof globalThis & { [cacheKey]?: Cache }
function cache(): Cache { return cacheStore[cacheKey] ??= { signals: [], report: null, updatedAt: 0, scanning: null } }

// ─── MAIN SCAN (port of runScan) ─────────────────────────────────────────────
export async function runLiveScan(): Promise<ScanReport> {
  const c = cache()
  const startedAt = Date.now()
  const lines: string[] = []
  const log = (msg: string) => { lines.push(`[${new Date().toLocaleTimeString('en-GB', { hour12: false })}] ${msg}`) }

  let universe: UniverseCoin[]
  try {
    universe = await fetchUniverse()
    log(`UNIVERSE · Binance 24h ticker → ${universe.length} pairs lolos filter (vol ≥ $${(CONFIG.MIN_QUOTE_VOLUME / 1e6).toFixed(0)}M, |Δ24h| ≥ ${CONFIG.MIN_VOLATILITY_PCT}%)`)
  } catch (err: any) {
    log(`UNIVERSE · GAGAL fetch ticker Binance: ${err?.message || err}`)
    const report: ScanReport = { scannedAt: new Date(startedAt).toISOString(), universe: 0, analyzed: 0, signals: 0, regime: 'unknown', regimeScore: 50, durationMs: Date.now() - startedAt, lines }
    c.report = report; c.updatedAt = startedAt
    return report
  }

  const regime = detectRegime(universe)
  log(`REGIME · market ${regime.regime.toUpperCase()} (score=${regime.score}) dari top-20 movers`)

  const signals: LiveSignal[] = []
  let analyzed = 0
  for (let i = 0; i < universe.length; i += CONFIG.BATCH_SIZE) {
    const batch = universe.slice(i, i + CONFIG.BATCH_SIZE)
    const results = await Promise.allSettled(batch.map(coin => scanCoin(coin, regime)))
    results.forEach((res, idx) => {
      const coin = batch[idx]
      analyzed++
      if (res.status === 'fulfilled') {
        const outcome = res.value
        if (outcome.signal) {
          signals.push(outcome.signal)
          log(`✅ ${coin.symbol.padEnd(8)} ${outcome.signal.signal} · conf ${outcome.signal.confidence}% · bullish ${outcome.signal.bullish}% · R:R 1:${outcome.signal.rr} · sniper ${outcome.signal.sniperScore} · HTF ${outcome.signal.htfTrend} · Kelly ${(outcome.signal.kellyFraction * 100).toFixed(2)}% · EV ${outcome.signal.expectedValue}`)
        } else {
          log(`·· ${coin.symbol.padEnd(8)} SKIP · ${outcome.skipReason}`)
        }
      } else {
        log(`·· ${coin.symbol.padEnd(8)} ERROR · ${(res.reason as any)?.message || res.reason}`)
      }
    })
    if (i + CONFIG.BATCH_SIZE < universe.length) await sleep(CONFIG.BATCH_DELAY_MS)
  }

  signals.sort((a, b) => b.confidence - a.confidence)
  const trimmed = signals.slice(0, CONFIG.MAX_SIGNALS)
  log(`SELESAI · ${analyzed} coin dianalisis → ${trimmed.length} sinyal lolos semua gate (13 engines + Bayesian + Kelly + HTF + regime + sniper)`)

  const report: ScanReport = {
    scannedAt: new Date(startedAt).toISOString(),
    universe: universe.length,
    analyzed,
    signals: trimmed.length,
    regime: regime.regime,
    regimeScore: regime.score,
    durationMs: Date.now() - startedAt,
    lines,
  }
  c.signals = trimmed
  c.report = report
  c.updatedAt = Date.now()
  return report
}

// ─── PUBLIC ACCESSORS ────────────────────────────────────────────────────────
// Non-blocking peek: returns whatever is cached and kicks off a background
// refresh when stale. Used by the paper-trader tick so polling never blocks.
export function peekLiveSignals(): { signals: LiveSignal[]; report: ScanReport | null; scanning: boolean } {
  const c = cache()
  const stale = Date.now() - c.updatedAt >= CONFIG.CACHE_TTL_MS
  if (stale && !c.scanning) {
    c.scanning = runLiveScan().finally(() => { cache().scanning = null })
  }
  return { signals: c.signals, report: c.report, scanning: !!c.scanning }
}

export async function getLiveSignals(force = false): Promise<LiveSignal[]> {
  const c = cache()
  const fresh = Date.now() - c.updatedAt < CONFIG.CACHE_TTL_MS
  if (!force && fresh && c.signals.length >= 0 && c.report) return c.signals
  if (c.scanning) { await c.scanning.catch(() => null); return cache().signals }
  c.scanning = runLiveScan().finally(() => { cache().scanning = null })
  await c.scanning.catch(() => null)
  return cache().signals
}

export async function getLiveScanReport(force = false): Promise<{ signals: LiveSignal[]; report: ScanReport | null }> {
  await getLiveSignals(force)
  const c = cache()
  return { signals: c.signals, report: c.report }
}
