// ══════════════════════════════════════════════════════════════════════════
//  BRUTAL FUTURES ENGINE — Binance USDT-M perpetual scanner.
//
//  Tujuan: untuk tiap coin tentukan arah FUTURES (LONG / SHORT / NETRAL) dan
//  — yang paling penting — apakah setup itu BOLEH DIEKSEKUSI sekarang atau
//  harus menunggu, persis seperti badge di menu Crypto Scanner → SIGNAL pada
//  referensi /Documents/crypto-scanner:
//      ⚡ Eksekusi LONG @ $102.40        → breakout + volume + OI konfirmasi
//      ⏳ Tunggu di $95.99               → "Belum ada konfirmasi breakout"
//      ⏳ Tunggu pullback · ideal ≈ $X   → harga sudah terlalu extended
//      ◦ Sinyal lemah                    → skor tipis, pantau saja
//      ⚪ NETRAL — Hindari                → tidak dieksekusi
//
//  Data 100% live dari Binance Futures (fapi), tanpa mock:
//    • /fapi/v1/ticker/24hr            → universe + volume + Δ24h
//    • /fapi/v1/klines 15m & 1h        → RSI, EMA20/50, MACD, ATR, swing S/R,
//                                        BOS/CHoCH, volume confirmation, HTF
//    • /fapi/v1/premiumIndex           → funding rate (crowding / squeeze risk)
//    • /futures/data/openInterestHist  → ΔOI vs Δharga (new long / new short /
//                                        short covering / long liquidation)
//    • /futures/data/topLongShortPositionRatio → posisi top trader (smart money)
//    • /futures/data/takerlongshortRatio       → agresivitas taker buy/sell
//
//  Sinyal yang belum boleh dieksekusi disimpan sebagai PENDING ORDER dengan
//  trigger price; setiap tick harga dicek (satu request batch untuk semua
//  simbol) dan saat trigger tersentuh statusnya jadi TRIGGERED sehingga paper
//  trader bisa mengeksekusinya lewat gerbang 5-agen yang sudah ada.
// ══════════════════════════════════════════════════════════════════════════

import { fetchJsonResilient } from './binanceDns'

export type BrutalStatus = 'EXECUTE' | 'WAIT_BREAKOUT' | 'WAIT_PULLBACK' | 'WEAK' | 'NEUTRAL'

export type BrutalSignal = {
  symbol: string; coinSymbol: string; coinId: string
  side: 'LONG' | 'SHORT' | 'NEUTRAL'
  price: number; score: number; confidence: number; leverage: number
  entry: number; triggerPrice: number | null; stopLoss: number; tp1: number; tp2: number; rr: number
  status: BrutalStatus; statusLabel: string; statusHint: string; executable: boolean
  fundingPct: number | null; oiChangePct: number | null; oiBias: string
  topLsr: number | null; takerRatio: number | null
  rsi: number; atrPct: number; htfAligned: boolean; structure: string; swingTrend: string
  support: number; resistance: number; factors: string[]
  volume24h: number; change24h: number; scannedAt: string
}

export type PendingOrder = {
  id: string; symbol: string; coinSymbol: string; side: 'LONG' | 'SHORT'
  triggerPrice: number; stopLoss: number; tp1: number; tp2: number; rr: number
  status: 'PENDING' | 'TRIGGERED' | 'EXPIRED'; createdAt: string; expiresAt: string
  reason: string; lastPrice: number; distancePct: number; triggeredAt?: string
}

const FAPI = 'https://fapi.binance.com'
const CONFIG = {
  universe: 22, deepScan: 12, concurrency: 6, ttlMs: 90_000,
  minQuoteVolume: 5_000_000, klineLimit: 100, htfLimit: 60,
  executeScore: 5, weakScore: 3, pendingTtlMin: 240, maxPending: 8,
}
const globalKey = '__crypycryptBrutalEngine__' as const
type Cache = { signals: BrutalSignal[]; pending: PendingOrder[]; regime: string; scannedAt: string; scanning: Promise<void> | null; universeSize: number; lastError: string }
const store = globalThis as typeof globalThis & { [globalKey]?: Cache }
function cache(): Cache {
  return store[globalKey] ??= { signals: [], pending: [], regime: 'range', scannedAt: '', scanning: null, universeSize: 0, lastError: '' }
}

// ─── helpers ────────────────────────────────────────────────────────────────
// Semua request fapi lewat fetchJsonResilient: kalau DNS lokal/ISP memblokir
// *.binance.com, resolver DoH + koneksi TLS ke IP (SNI) mengambil alih otomatis.
// Data tetap 100% dari Binance — tidak ada mock.
async function fetchJson(url: string, timeoutMs = 10_000): Promise<any> {
  return fetchJsonResilient(url, timeoutMs)
}
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const i = cursor++; try { out[i] = await fn(items[i], i) } catch { out[i] = undefined as unknown as R } }
  })
  await Promise.all(workers); return out
}
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const fmtPrice = (n: number) => !Number.isFinite(n) || n <= 0 ? '—' : n >= 1000 ? `$${n.toFixed(2)}` : n >= 1 ? `$${n.toFixed(4)}` : n >= 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(8)}`

type Kline = { t: number; o: number; h: number; l: number; c: number; v: number; qv: number }
function parseKlines(raw: any[]): Kline[] {
  return (raw || []).map(k => ({ t: num(k[0]), o: num(k[1]), h: num(k[2]), l: num(k[3]), c: num(k[4]), v: num(k[5]), qv: num(k[7]) })).filter(k => k.c > 0)
}
function calcRSI(closes: number[], period = 14): number {
  if (closes.length <= period) return 50
  let gain = 0, loss = 0
  for (let i = closes.length - period; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) gain += d; else loss -= d }
  if (loss === 0) return 100
  const rs = (gain / period) / (loss / period)
  return 100 - 100 / (1 + rs)
}
function calcEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const k = 2 / (period + 1); let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k)
  return ema
}
function calcATR(klines: Kline[], period = 14): number {
  if (klines.length < period + 1) return 0
  const trs: number[] = []
  for (let i = 1; i < klines.length; i++) {
    const k = klines[i], p = klines[i - 1]
    trs.push(Math.max(k.h - k.l, Math.abs(k.h - p.c), Math.abs(k.l - p.c)))
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period
}
function calcMacd(closes: number[]) {
  const e12 = calcEMA(closes, 12), e26 = calcEMA(closes, 26)
  if (e12 === null || e26 === null) return { macd: 0, signal: 0, hist: 0 }
  const macdSeries: number[] = []
  const k12 = 2 / 13, k26 = 2 / 27
  let a = closes.slice(0, 12).reduce((x, y) => x + y, 0) / 12, b = closes.slice(0, 26).reduce((x, y) => x + y, 0) / 26
  for (let i = 26; i < closes.length; i++) { a = closes[i] * k12 + a * (1 - k12); b = closes[i] * k26 + b * (1 - k26); macdSeries.push(a - b) }
  const macd = macdSeries[macdSeries.length - 1] ?? e12 - e26
  const sig = macdSeries.length >= 9 ? calcEMA(macdSeries, 9) ?? 0 : 0
  return { macd, signal: sig, hist: macd - sig }
}
// ── MILESTONE 2 · REFERENCE MERGE: klasifikasi swing HH/HL/LH/LL ─────────────
// Port analyzeMarketStructure dari signal-bot.js (detectSwings strength 5 pada
// closes 15m): 3 swing high/low terakhir diklasifikasi HH/HL/LH/LL → tren
// struktur. Dipakai faktor 5 untuk membedakan BOS continuation (bobot penuh)
// dari CHoCH lawan-trend (bobot setengah — fakeout lebih sering, referensi juga
// memberi skor CHoCH lebih lemah dari BOS penuh di calcDirectionalProb).
function swingTrend(closes: number[]) {
  const strength = 5
  const highs: number[] = [], lows: number[] = []
  for (let i = strength; i < closes.length - strength; i++) {
    const slice = closes.slice(i - strength, i + strength + 1)
    if (closes[i] === Math.max(...slice)) highs.push(closes[i])
    if (closes[i] === Math.min(...slice)) lows.push(closes[i])
  }
  const last3H = highs.slice(-3), last3L = lows.slice(-3)
  let hh = 0, hl = 0, lh = 0, ll = 0
  for (let i = 1; i < last3H.length; i++) { if (last3H[i] > last3H[i - 1]) hh++; else lh++ }
  for (let i = 1; i < last3L.length; i++) { if (last3L[i] > last3L[i - 1]) hl++; else ll++ }
  let trend: string
  if (hh >= 1 && hl >= 1) trend = 'uptrend'
  else if (lh >= 1 && ll >= 1) trend = 'downtrend'
  else if (hh >= 1 && ll >= 1) trend = 'reversal_top'
  else if (lh >= 1 && hl >= 1) trend = 'reversal_bottom'
  else trend = 'consolidation'
  return trend
}

// swing high/low terdekat di atas/bawah harga (sama seperti referensi)
function swingLevels(klines: Kline[], price: number, lookback = 30) {
  const recent = klines.slice(-lookback)
  const highs: number[] = [], lows: number[] = []
  for (let i = 1; i < recent.length - 1; i++) {
    if (recent[i].h >= recent[i - 1].h && recent[i].h >= recent[i + 1].h) highs.push(recent[i].h)
    if (recent[i].l <= recent[i - 1].l && recent[i].l <= recent[i + 1].l) lows.push(recent[i].l)
  }
  const resist = highs.filter(h => h > price).sort((a, b) => a - b)[0] ?? Math.max(...recent.map(r => r.h))
  const support = lows.filter(l => l < price).sort((a, b) => b - a)[0] ?? Math.min(...recent.map(r => r.l))
  // level breakout: swing high/low dari 20 bar SEBELUM bar terakhir
  const prior = klines.slice(-21, -1)
  const breakHigh = prior.length ? Math.max(...prior.map(r => r.h)) : resist
  const breakLow = prior.length ? Math.min(...prior.map(r => r.l)) : support
  return { resist, support, breakHigh, breakLow }
}

// ─── per-coin analysis ──────────────────────────────────────────────────────
type TickerRow = { symbol: string; lastPrice: number; priceChangePercent: number; quoteVolume: number }

async function analyzeCoin(row: TickerRow, deep: boolean, regime: string): Promise<BrutalSignal | null> {
  const symbol = row.symbol
  const coinSymbol = symbol.replace(/USDT$/, '')
  const [raw15, raw1h] = await Promise.all([
    fetchJson(`${FAPI}/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=${CONFIG.klineLimit}`),
    fetchJson(`${FAPI}/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=${CONFIG.htfLimit}`),
  ])
  const k15 = parseKlines(raw15), k1h = parseKlines(raw1h)
  if (k15.length < 40) return null
  const closes = k15.map(k => k.c)
  const price = closes[closes.length - 1] || row.lastPrice
  if (!(price > 0)) return null

  const rsi = calcRSI(closes, 14)
  const ema20 = calcEMA(closes, 20) ?? price
  const ema50 = calcEMA(closes, 50) ?? price
  const macd = calcMacd(closes)
  const atr = calcATR(k15, 14) || price * 0.01
  const atrPct = (atr / price) * 100
  const lv = swingLevels(k15, price, 30)
  const last = k15[k15.length - 1], prev = k15[k15.length - 2]
  const avgVol = k15.slice(-21, -1).reduce((a, b) => a + b.v, 0) / Math.max(1, Math.min(20, k15.length - 1))
  const volSpike = avgVol > 0 ? last.v / avgVol : 1
  const ch4h = k15.length >= 17 ? ((price - k15[k15.length - 17].c) / k15[k15.length - 17].c) * 100 : row.priceChangePercent / 6
  const ch1h = k15.length >= 5 ? ((price - k15[k15.length - 5].c) / k15[k15.length - 5].c) * 100 : 0

  // HTF (1h): trend filter — hanya setup searah HTF yang boleh dieksekusi
  const hEma20 = calcEMA(k1h.map(k => k.c), 20) ?? price
  const hEma50 = calcEMA(k1h.map(k => k.c), 50) ?? price
  const htfBull = hEma20 > hEma50 && price > hEma20
  const htfBear = hEma20 < hEma50 && price < hEma20

  let score = 0
  const factors: string[] = []

  // 1 · momentum
  if (ch4h > 4) { score += 2; factors.push(`Δ4h +${ch4h.toFixed(1)}% ↑↑`) }
  else if (ch4h > 1) { score += 1; factors.push(`Δ4h +${ch4h.toFixed(1)}% ↑`) }
  else if (ch4h < -4) { score -= 2; factors.push(`Δ4h ${ch4h.toFixed(1)}% ↓↓`) }
  else if (ch4h < -1) { score -= 1; factors.push(`Δ4h ${ch4h.toFixed(1)}% ↓`) }
  // 2 · RSI
  if (rsi < 30) { score += 2; factors.push(`RSI ${rsi.toFixed(0)} oversold`) }
  else if (rsi < 45) { score += 1; factors.push(`RSI ${rsi.toFixed(0)} lemah`) }
  else if (rsi > 75) { score -= 2; factors.push(`RSI ${rsi.toFixed(0)} overbought`) }
  else if (rsi > 60) { score -= 1; factors.push(`RSI ${rsi.toFixed(0)} tinggi`) }
  // 3 · EMA stack
  if (ema20 > ema50 && price > ema20) { score += 2; factors.push('EMA20>EMA50 · harga di atas EMA20') }
  else if (ema20 > ema50) { score += 1; factors.push('EMA20>EMA50 bullish') }
  else if (ema20 < ema50 && price < ema20) { score -= 2; factors.push('EMA20<EMA50 · harga di bawah EMA20') }
  else if (ema20 < ema50) { score -= 1; factors.push('EMA20<EMA50 bearish') }
  // 4 · MACD
  if (macd.hist > 0 && macd.macd > macd.signal) { score += 1; factors.push('MACD bullish cross') }
  else if (macd.hist < 0 && macd.macd < macd.signal) { score -= 1; factors.push('MACD bearish cross') }
  // 5 · struktur BOS / CHoCH + posisi terhadap S/R
  // MILESTONE 2: arah break dikonteks tren swing (swingTrend). BOS searah tren
  // = continuation → ±2 penuh. BOS melawan tren = CHoCH → ±1 saja; reversal
  // butuh konfirmasi volume/flow, dan gerbang EXECUTE tetap menuntut
  // breakoutConfirmed && htfAligned sehingga CHoCH tanpa HTF tidak lolos.
  const swTrend = swingTrend(closes)
  const bosUp = last.c > lv.breakHigh
  const bosDown = last.c < lv.breakLow
  const chochUp = bosUp && (swTrend === 'downtrend' || swTrend === 'reversal_top')
  const chochDown = bosDown && (swTrend === 'uptrend' || swTrend === 'reversal_bottom')
  let structure = 'range'
  if (bosUp) {
    if (chochUp) { score += 1; structure = 'CHoCH ↑'; factors.push(`CHoCH ↑ lawan ${swTrend} · tembus ${fmtPrice(lv.breakHigh)} (reversal, butuh konfirmasi)`) }
    else { score += 2; structure = 'BOS ↑'; factors.push(`BOS ↑ searah ${swTrend} · tembus ${fmtPrice(lv.breakHigh)}`) }
  } else if (bosDown) {
    if (chochDown) { score -= 1; structure = 'CHoCH ↓'; factors.push(`CHoCH ↓ lawan ${swTrend} · jebol ${fmtPrice(lv.breakLow)} (reversal, butuh konfirmasi)`) }
    else { score -= 2; structure = 'BOS ↓'; factors.push(`BOS ↓ searah ${swTrend} · jebol ${fmtPrice(lv.breakLow)}`) }
  }
  else if (price > lv.resist * 0.995) { score += 1; structure = 'uji resistensi'; factors.push('mepet resistensi') }
  else if (price < lv.support * 1.005) { score -= 1; structure = 'uji support'; factors.push('mepet support') }
  // 6 · volume confirmation
  if (volSpike > 1.25 && last.c > last.o) { score += 1; factors.push(`volume spike ${volSpike.toFixed(1)}× + candle hijau`) }
  else if (volSpike > 1.25 && last.c < last.o) { score -= 1; factors.push(`volume spike ${volSpike.toFixed(1)}× + candle merah`) }
  // 7 · HTF alignment
  if (htfBull) { score += 1; factors.push('HTF 1h bullish') } else if (htfBear) { score -= 1; factors.push('HTF 1h bearish') }

  // ─── FUTURES DATA (funding · OI · top trader · taker) ─────────────────────
  let fundingPct: number | null = null, oiChangePct: number | null = null
  let topLsr: number | null = null, takerRatio: number | null = null, oiBias = 'flat'
  if (deep) {
    const [prem, oiHist, lsr, taker] = await Promise.all([
      fetchJson(`${FAPI}/fapi/v1/premiumIndex?symbol=${symbol}`).catch(() => null),
      fetchJson(`${FAPI}/futures/data/openInterestHist?symbol=${symbol}&period=15m&limit=6`).catch(() => null),
      fetchJson(`${FAPI}/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=15m&limit=1`).catch(() => null),
      fetchJson(`${FAPI}/futures/data/takerlongshortRatio?symbol=${symbol}&period=15m&limit=3`).catch(() => null),
    ])
    if (prem) fundingPct = num(prem.lastFundingRate) * 100
    if (Array.isArray(oiHist) && oiHist.length >= 2) {
      const first = num(oiHist[0].sumOpenInterestValue) || num(oiHist[0].sumOpenInterest)
      const lastOi = num(oiHist[oiHist.length - 1].sumOpenInterestValue) || num(oiHist[oiHist.length - 1].sumOpenInterest)
      if (first > 0) oiChangePct = ((lastOi - first) / first) * 100
    }
    if (Array.isArray(lsr) && lsr.length) topLsr = num(lsr[0].longShortRatio)
    if (Array.isArray(taker) && taker.length) {
      const ratios = taker.map((t: any) => num(t.buySellRatio)).filter((n: number) => n > 0)
      takerRatio = ratios.length ? ratios.reduce((a: number, b: number) => a + b, 0) / ratios.length : null
    }

    // Funding: positif tinggi = long crowded (rawan long squeeze) → bias kontra
    if (fundingPct !== null) {
      const bias = clamp(-(fundingPct / 0.02), -2, 2) // ±0.02% ≈ jenuh
      score += bias
      if (Math.abs(bias) >= 0.5) factors.push(`funding ${fundingPct >= 0 ? '+' : ''}${fundingPct.toFixed(4)}% · ${bias < 0 ? 'long crowded ⚠' : 'short crowded ⚠'}`)
    }
    // ΔOI vs Δharga: uang baru masuk searah atau justru covering/liquidation
    if (oiChangePct !== null && Math.abs(oiChangePct) > 0.15) {
      const up = ch1h >= 0
      if (oiChangePct > 0 && up) { score += 2; oiBias = 'new long'; factors.push(`OI +${oiChangePct.toFixed(2)}% & harga naik → uang baru LONG`) }
      else if (oiChangePct > 0 && !up) { score -= 2; oiBias = 'new short'; factors.push(`OI +${oiChangePct.toFixed(2)}% & harga turun → uang baru SHORT`) }
      else if (oiChangePct < 0 && up) { score -= 1; oiBias = 'short covering'; factors.push(`OI ${oiChangePct.toFixed(2)}% & harga naik → short covering (lemah)`) }
      else { score += 1; oiBias = 'long liquidation'; factors.push(`OI ${oiChangePct.toFixed(2)}% & harga turun → long liquidation (lemah)`) }
    }
    // Top trader position ratio — smart money positioning
    if (topLsr !== null && topLsr > 0) {
      if (topLsr >= 2.2) { score += 1; factors.push(`top trader L/S ${topLsr.toFixed(2)} · dominan LONG`) }
      else if (topLsr <= 0.55) { score -= 1; factors.push(`top trader L/S ${topLsr.toFixed(2)} · dominan SHORT`) }
    }
    // Taker buy/sell — agresivitas order flow sesaat
    if (takerRatio !== null && takerRatio > 0) {
      if (takerRatio >= 1.15) { score += 1; factors.push(`taker B/S ${takerRatio.toFixed(2)} · buyer agresif`) }
      else if (takerRatio <= 0.87) { score -= 1; factors.push(`taker B/S ${takerRatio.toFixed(2)} · seller agresif`) }
    }
  }

  score = Math.round(clamp(score, -12, 12))
  const side: BrutalSignal['side'] = score >= CONFIG.weakScore ? 'LONG' : score <= -CONFIG.weakScore ? 'SHORT' : 'NEUTRAL'
  const absScore = Math.abs(score)
  const confidence = Math.round(clamp(42 + absScore * 4.2, 0, 96))
  const dirProb = clamp(50 + score * 3.4, 6, 94)

  // leverage dari volatilitas (ATR%) — sama seperti referensi
  let leverage = atrPct > 6 ? 2 : atrPct > 4 ? 3 : atrPct > 2.5 ? 5 : atrPct > 1.5 ? 7 : 10
  if (side === 'NEUTRAL') leverage = 1
  if (absScore < CONFIG.executeScore) leverage = Math.min(leverage, 3)

  // ─── level entry / SL / TP (ATR + swing) ─────────────────────────────────
  let entry = price, sl = 0, tp1 = 0, tp2 = 0, triggerPrice: number | null = null
  if (side === 'LONG') {
    const slAtr = price - atr * 1.5, slSwing = lv.support < price ? lv.support * 0.995 : slAtr
    sl = Math.max(slAtr, slSwing); if (sl >= entry) sl = entry - atr * 1.5
    const risk = entry - sl; tp1 = entry + risk * 2; tp2 = entry + risk * 3.2
  } else if (side === 'SHORT') {
    const slAtr = price + atr * 1.5, slSwing = lv.resist > price ? lv.resist * 1.005 : slAtr
    sl = Math.min(slAtr, slSwing); if (sl <= entry) sl = entry + atr * 1.5
    const risk = sl - entry; tp1 = Math.max(entry - risk * 2, 0); tp2 = Math.max(entry - risk * 3.2, 0)
  } else { sl = price; tp1 = price; tp2 = price }
  const riskAbs = Math.abs(entry - sl)
  const rr = riskAbs > 0 ? Math.abs(tp1 - entry) / riskAbs : 0

  // ─── GERBANG EKSEKUSI ────────────────────────────────────────────────────
  // Konfirmasi breakout: candle terakhir menembus level + volume mendukung,
  // atau order-flow futures (taker & OI) searah dan 2 candle terakhir searah.
  const twoBars = side === 'LONG' ? (last.c > last.o && prev.c > prev.o) : side === 'SHORT' ? (last.c < last.o && prev.c < prev.o) : false
  const flowConfirm = side === 'LONG'
    ? (takerRatio ?? 1) > 1.05 && (oiChangePct ?? 0) > 0
    : side === 'SHORT' ? (takerRatio ?? 1) < 0.95 && (oiChangePct ?? 0) > 0 : false
  const breakoutConfirmed = side === 'LONG'
    ? (bosUp && volSpike > 1.1) || (flowConfirm && twoBars && last.c > ema20)
    : side === 'SHORT' ? (bosDown && volSpike > 1.1) || (flowConfirm && twoBars && last.c < ema20) : false
  // Extended: harga sudah lari jauh dari EMA20 / mepet level lawan arah
  const distEmaPct = ((price - ema20) / ema20) * 100
  const extended = side === 'LONG'
    ? distEmaPct > Math.max(1.6, atrPct * 0.8) || price >= lv.resist * 0.995
    : side === 'SHORT' ? distEmaPct < -Math.max(1.6, atrPct * 0.8) || price <= lv.support * 1.005 : false
  const htfAligned = side === 'LONG' ? htfBull : side === 'SHORT' ? htfBear : false

  let status: BrutalStatus, statusLabel: string, statusHint: string
  if (side === 'NEUTRAL') {
    status = 'NEUTRAL'; statusLabel = '⚪ NETRAL — Hindari'; statusHint = 'Skor futures tidak cukup kuat, jangan masuk posisi'
  } else if (absScore < CONFIG.executeScore) {
    status = 'WEAK'; statusLabel = `◦ Sinyal lemah (${score > 0 ? 'LONG' : 'SHORT'} ${score})`; statusHint = `Butuh skor ≥${CONFIG.executeScore} · pantau saja, tidak dieksekusi`
  } else if (breakoutConfirmed && htfAligned) {
    status = 'EXECUTE'; statusLabel = `⚡ Eksekusi ${side} @ ${fmtPrice(price)}`
    statusHint = `Breakout ${structure} terkonfirmasi · volume ${volSpike.toFixed(1)}× · HTF 1h searah${deep ? ' · funding/OI/flow mendukung' : ''}`
  } else if (breakoutConfirmed && !htfAligned) {
    status = 'WEAK'; statusLabel = `◦ Breakout tanpa HTF (${side})`; statusHint = 'HTF 1h berlawanan arah — tunggu alignment, tidak dieksekusi'
  } else if (extended) {
    triggerPrice = side === 'LONG' ? Math.max(ema20, lv.support) : Math.min(ema20, lv.resist)
    status = 'WAIT_PULLBACK'; statusLabel = `⏳ Tunggu pullback ${side}`; statusHint = `Entry ideal ≈ ${fmtPrice(triggerPrice)} · harga sudah extended ${distEmaPct >= 0 ? '+' : ''}${distEmaPct.toFixed(2)}% dari EMA20`
  } else {
    triggerPrice = side === 'LONG' ? lv.breakHigh * 1.0015 : lv.breakLow * 0.9985
    status = 'WAIT_BREAKOUT'; statusLabel = `⏳ Tunggu di ${fmtPrice(triggerPrice)}`; statusHint = 'Belum ada konfirmasi breakout'
  }

  return {
    symbol, coinSymbol, coinId: coinSymbol.toLowerCase(), side, price, score, confidence, leverage,
    entry, triggerPrice, stopLoss: sl, tp1, tp2, rr: Number(rr.toFixed(2)),
    status, statusLabel, statusHint, executable: status === 'EXECUTE',
    fundingPct: fundingPct === null ? null : Number(fundingPct.toFixed(4)),
    oiChangePct: oiChangePct === null ? null : Number(oiChangePct.toFixed(2)), oiBias,
    topLsr: topLsr === null ? null : Number(topLsr.toFixed(2)),
    takerRatio: takerRatio === null ? null : Number(takerRatio.toFixed(2)),
    rsi: Math.round(rsi), atrPct: Number(atrPct.toFixed(2)), htfAligned, structure, swingTrend: swTrend,
    support: lv.support, resistance: lv.resist, factors,
    volume24h: row.quoteVolume, change24h: Number(row.priceChangePercent.toFixed(2)),
    scannedAt: new Date().toISOString(),
  }
}

// ─── full scan ──────────────────────────────────────────────────────────────
export async function runBrutalScan(): Promise<BrutalSignal[]> {
  const tickers: any[] = await fetchJson(`${FAPI}/fapi/v1/ticker/24hr`, 15_000)
  const rows: TickerRow[] = tickers
    .filter((t: any) => typeof t?.symbol === 'string' && /USDT$/.test(t.symbol) && !t.symbol.includes('_') && num(t.quoteVolume) >= CONFIG.minQuoteVolume && num(t.lastPrice) > 0)
    .map((t: any) => ({ symbol: t.symbol, lastPrice: num(t.lastPrice), priceChangePercent: num(t.priceChangePercent), quoteVolume: num(t.quoteVolume) }))
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, CONFIG.universe)
  cache().universeSize = rows.length
  if (!rows.length) throw new Error('universe futures kosong')

  // regime pasar dari breadth universe (bukan hardcode)
  const positive = rows.filter(r => r.priceChangePercent > 0).length
  const btc = rows.find(r => r.symbol === 'BTCUSDT')
  const breadth = positive / rows.length
  const regime = btc && btc.priceChangePercent > 1.5 && breadth > 0.55 ? 'bull'
    : btc && btc.priceChangePercent < -1.5 && breadth < 0.45 ? 'bear' : 'range'
  cache().regime = regime

  const targets = rows.map((row, i) => ({ row, deep: i < CONFIG.deepScan }))
  const results = await mapLimit(targets, CONFIG.concurrency, async ({ row, deep }) => analyzeCoin(row, deep, regime).catch(() => null))
  const signals = results.filter((r): r is BrutalSignal => !!r)
  signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score) || b.volume24h - a.volume24h)
  cache().scannedAt = new Date().toISOString()
  return signals
}

// Non-blocking: cache basi memicu rescan di background, hasil terakhir langsung dikembalikan.
export function peekBrutal(): { signals: BrutalSignal[]; regime: string; scannedAt: string; scanning: boolean; universeSize: number } {
  const c = cache()
  const stale = !c.scannedAt || Date.now() - new Date(c.scannedAt).getTime() >= CONFIG.ttlMs
  if (stale && !c.scanning) {
    c.scanning = runBrutalScan()
      .then(signals => { c.signals = signals })
      .catch((e: any) => { c.lastError = String(e?.message || e) })
      .finally(() => { cache().scanning = null })
  }
  return { signals: c.signals, regime: c.regime, scannedAt: c.scannedAt, scanning: !!c.scanning, universeSize: c.universeSize }
}

// ─── PENDING ORDERS (sinyal "Tunggu di $X" yang dipantau sampai tersentuh) ──
async function batchPrices(symbols: string[]): Promise<Record<string, number>> {
  if (!symbols.length) return {}
  try {
    const all: any[] = await fetchJson(`${FAPI}/fapi/v1/ticker/price`, 10_000)
    const want = new Set(symbols)
    const out: Record<string, number> = {}
    all.forEach(t => { if (want.has(t.symbol)) out[t.symbol] = num(t.price) })
    return out
  } catch { return {} }
}

export type BrutalTick = {
  signals: BrutalSignal[]; pending: PendingOrder[]; regime: string; scannedAt: string
  scanning: boolean; universeSize: number
  executable: BrutalSignal[]; triggered: PendingOrder[]
  stats: { total: number; long: number; short: number; neutral: number; execute: number; waiting: number; pending: number; triggered: number }
}

export async function tickBrutal(): Promise<BrutalTick> {
  const c = cache()
  const peek = peekBrutal()
  const signals = peek.signals

  // 1) buang pending yang kedaluwarsa
  const now = Date.now()
  c.pending = c.pending.filter(p => p.status === 'TRIGGERED' ? now - new Date(p.triggeredAt || p.createdAt).getTime() < 10 * 60_000 : p.status === 'PENDING' && now < new Date(p.expiresAt).getTime())
  c.pending.forEach(p => { if (p.status === 'PENDING' && now >= new Date(p.expiresAt).getTime()) p.status = 'EXPIRED' })

  // 2) buat pending baru dari sinyal WAIT_* (belum ada trigger-nya di daftar)
  const bySymbol = new Map(c.pending.map(p => [p.symbol, p]))
  signals.forEach(sig => {
    if (!sig.triggerPrice || (sig.status !== 'WAIT_BREAKOUT' && sig.status !== 'WAIT_PULLBACK')) return
    const existing = bySymbol.get(sig.symbol)
    if (existing && existing.status === 'PENDING') {
      // segarkan trigger/SL/TP selama masih menunggu
      existing.triggerPrice = sig.triggerPrice; existing.stopLoss = sig.stopLoss
      existing.tp1 = sig.tp1; existing.tp2 = sig.tp2; existing.rr = sig.rr; existing.reason = sig.statusHint
      existing.lastPrice = sig.price; existing.distancePct = ((sig.triggerPrice - sig.price) / sig.price) * 100 * (sig.side === 'LONG' ? 1 : -1)
      return
    }
    if (existing) return // sudah TRIGGERED/EXPIRED → jangan spam order baru
    if (c.pending.filter(p => p.status === 'PENDING').length >= CONFIG.maxPending) return
    const order: PendingOrder = {
      id: `${sig.symbol}-${sig.side}`, symbol: sig.symbol, coinSymbol: sig.coinSymbol, side: sig.side as 'LONG' | 'SHORT',
      triggerPrice: sig.triggerPrice, stopLoss: sig.stopLoss, tp1: sig.tp1, tp2: sig.tp2, rr: sig.rr,
      status: 'PENDING', createdAt: new Date().toISOString(),
      expiresAt: new Date(now + CONFIG.pendingTtlMin * 60_000).toISOString(),
      reason: sig.status === 'WAIT_PULLBACK' ? `Tunggu pullback · ${sig.statusHint}` : `Tunggu di ${fmtPrice(sig.triggerPrice)} · belum ada konfirmasi breakout`,
      lastPrice: sig.price, distancePct: ((sig.triggerPrice - sig.price) / sig.price) * 100 * (sig.side === 'LONG' ? 1 : -1),
    }
    c.pending.unshift(order); bySymbol.set(sig.symbol, order)
  })

  // 3) cek trigger dengan satu request harga batch
  const waiting = c.pending.filter(p => p.status === 'PENDING')
  if (waiting.length) {
    const prices = await batchPrices(waiting.map(p => p.symbol))
    waiting.forEach(p => {
      const live = prices[p.symbol]
      if (!live) return
      p.lastPrice = live
      p.distancePct = ((p.triggerPrice - live) / live) * 100 * (p.side === 'LONG' ? 1 : -1)
      const hit = p.side === 'LONG' ? live >= p.triggerPrice : live <= p.triggerPrice
      if (hit) { p.status = 'TRIGGERED'; p.triggeredAt = new Date().toISOString() }
    })
  }

  const triggered = c.pending.filter(p => p.status === 'TRIGGERED')
  // sinyal siap eksekusi = status EXECUTE + pending yang baru tersentuh trigger
  const triggeredSymbols = new Set(triggered.map(p => p.symbol))
  const executable = signals.filter(s => s.executable || triggeredSymbols.has(s.symbol))
  executable.forEach(s => { if (triggeredSymbols.has(s.symbol) && !s.executable) { s.status = 'EXECUTE'; s.statusLabel = `⚡ Trigger tersentuh · Eksekusi ${s.side} @ ${fmtPrice(s.price)}`; s.statusHint = `Pending order ${fmtPrice(s.triggerPrice ?? s.price)} terkena · ${s.statusHint}`; s.executable = true } })

  return {
    signals, pending: c.pending, regime: peek.regime, scannedAt: peek.scannedAt, scanning: peek.scanning, universeSize: peek.universeSize,
    executable, triggered,
    stats: {
      total: signals.length,
      long: signals.filter(s => s.side === 'LONG').length,
      short: signals.filter(s => s.side === 'SHORT').length,
      neutral: signals.filter(s => s.side === 'NEUTRAL').length,
      execute: executable.length,
      waiting: signals.filter(s => s.status === 'WAIT_BREAKOUT' || s.status === 'WAIT_PULLBACK').length,
      pending: c.pending.filter(p => p.status === 'PENDING').length,
      triggered: triggered.length,
    },
  }
}

export function brutalPending() { return cache().pending }
