// ══════════════════════════════════════════════════════════════════════════════
// Crypto Scanner Analysis Engine
// Ported from the /Documents/crypto-scanner reference implementation and made
// fully data-driven (no hardcoded coin data). All computations are derived from
// real CoinGecko market data (current price, % changes, volume, market cap and
// the 7-day hourly sparkline).
// ══════════════════════════════════════════════════════════════════════════════

export interface MoonPhaseInfo {
  phaseIndex: number
  phase: number
  illumination: number
  name: string
  icon: string
  bias: string
  biasColor: string
  cryptoImpact: string
  aiWeight: number
  strategy: string
  detail: string
}

export interface FibLevel {
  ratio: number
  level: number
}

export interface FibonacciInsight {
  high: number
  low: number
  trend: 'up' | 'down'
  retracements: FibLevel[]
  extensions: FibLevel[]
  accuracy: string
  note: string
  trendStrength: number
  volumeRatio: number
}

export interface FuturesAnalysis {
  direction: 'long' | 'short' | 'long_weak' | 'short_weak' | 'neutral'
  dirLabel: string
  dirColor: string
  dirEmoji: string
  score: number
  leverage: number
  entry: number
  tp1: number
  tp2: number
  sl: number
  liqEstimate: number
  riskPct: number
  rewardPct: number
  rrRatio: number
  rsi: number
  atrPct: number
  volatilityLevel: string
  confidence: string
  factors: string[]
  support: number
  resistance: number
  isNeutral: boolean
}

export interface IndicatorCheck {
  id: string
  ok: boolean
  label: string
  note: string
}

export interface IndicatorGuide {
  price: number
  ma20: number | null
  ema20: number | null
  ema50: number | null
  macd: number | null
  signal: number | null
  histogram: number | null
  checks: IndicatorCheck[]
  bullCount: number
  totalCount: number
  overallOk: boolean
  overallLabel: string
}

export interface AIFactor {
  label: string
  value: number
  max: number
  desc: string
}

export interface CoinAnalysis {
  id: string
  symbol: string
  name: string
  image: string | null
  current_price: number
  price_change_percentage_24h: number
  total_volume: number
  market_cap: number
  market_cap_rank: number
  sparkline: number[]
  aiScore: number
  rsi: number
  futuresDir: string
  leverage: number
  factors: AIFactor[]
  moon: MoonPhaseInfo
  futures: FuturesAnalysis
  fibonacci: FibonacciInsight | null
  indicators: IndicatorGuide
}

// ── Moon phase reference data (astronomically derived, not coin-specific) ────
export const MOON_PHASES: Array<Omit<MoonPhaseInfo, 'phaseIndex' | 'phase' | 'illumination'>> = [
  { name: 'New Moon', icon: '🌑', bias: 'Cautious', biasColor: '#94a3b8', cryptoImpact: 'Sideways — volume cenderung tipis, tunggu konfirmasi arah', aiWeight: -5, strategy: 'Hindari entry besar. Tunggu breakout setelah fase ini.', detail: 'Bulan tidak terlihat. Energi rendah. Pasar crypto historis cenderung konsolidasi atau awal siklus baru.' },
  { name: 'Waxing Crescent', icon: '🌒', bias: 'Building', biasColor: '#fbbf24', cryptoImpact: 'Momentum mulai terbentuk — accumulate secara bertahap', aiWeight: +3, strategy: 'Mulai akumulasi dengan posisi kecil, tambah saat konfirmasi.', detail: 'Bulan mulai terlihat. Momentum pasar perlahan terbentuk. Altcoin sering mulai bergerak di fase ini.' },
  { name: 'First Quarter', icon: '🌓', bias: 'Trend Shift', biasColor: '#a78bfa', cryptoImpact: 'Potensi breakout atau reversal — perhatikan volume', aiWeight: +2, strategy: 'Entry jika ada breakout dengan volume. Pasang SL ketat.', detail: 'Setengah bulan terlihat. Sering terjadi perubahan arah trend. Volatilitas biasanya meningkat.' },
  { name: 'Waxing Gibbous', icon: '🌔', bias: 'Risk-On', biasColor: '#4ade80', cryptoImpact: 'Trend naik menguat — momentum continuation', aiWeight: +5, strategy: 'Hold posisi, trail stop. Momentum sering kuat di fase ini.', detail: 'Bulan hampir penuh. Fase yang historis paling bullish untuk crypto. Volume naik, sentiment positif.' },
  { name: 'Full Moon', icon: '🌕', bias: 'Exhaustion', biasColor: '#f87171', cryptoImpact: 'Potensi puncak lokal — waspada reversal & volatilitas tinggi', aiWeight: -8, strategy: 'Ambil sebagian profit. Waspada fake breakout. Volatilitas tinggi.', detail: 'Bulan penuh. Historis sering terjadi spike volatilitas tinggi lalu reversal. Hati-hati FOMO.' },
  { name: 'Waning Gibbous', icon: '🌖', bias: 'Cooling', biasColor: '#fbbf24', cryptoImpact: 'Momentum melemah — ambil profit bertahap', aiWeight: -3, strategy: 'Kurangi posisi secara bertahap, pindah ke stablecoin sebagian.', detail: 'Bulan mulai menyusut. Momentum biasanya melambat. Distribusi oleh smart money sering dimulai.' },
  { name: 'Last Quarter', icon: '🌗', bias: 'Rebalance', biasColor: '#94a3b8', cryptoImpact: 'Mean reversion — hindari chase, tunggu setup baru', aiWeight: -2, strategy: 'Rebalance portofolio. Hindari entry baru tanpa konfirmasi kuat.', detail: 'Setengah bulan gelap. Pasar sering sideways atau koreksi ringan. Baik untuk evaluasi posisi.' },
  { name: 'Waning Crescent', icon: '🌘', bias: 'Reset', biasColor: '#60a5fa', cryptoImpact: 'Volume rendah, fokus high-conviction setup saja', aiWeight: 0, strategy: 'Patience. Simpan modal untuk New Moon berikutnya.', detail: 'Hampir New Moon. Volume tipis, volatilitas rendah. Waktu terbaik untuk research, bukan trading.' },
]

const TWO_PI = Math.PI * 2
const SYNODIC_MONTH = 29.530588853

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getMoonPhaseInfo(date: Date = new Date()): MoonPhaseInfo {
  const knownNewMoon = new Date('2024-01-11T11:57:00Z')
  const diffDays = (date.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24)
  const phase = ((diffDays % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH
  const phaseIndex = clamp(Math.floor((phase / SYNODIC_MONTH) * 8), 0, 7)
  const base = MOON_PHASES[phaseIndex]
  return {
    ...base,
    phaseIndex,
    phase,
    illumination: clamp((1 - Math.cos((TWO_PI * phase) / SYNODIC_MONTH)) / 2, 0, 1),
  }
}

export interface MoonPhaseDate {
  icon: string
  name: string
  start: Date
  end: Date
  daysUntil: number
}

export function getMoonPhaseDates(date: Date = new Date()): MoonPhaseDate[] {
  const KNOWN_NEW_MOON = new Date('2025-01-29T12:36:00Z')
  const MS_PER_DAY = 86400000
  const PHASE_OFFSETS = [0, 1.85, 7.38, 11.07, 14.77, 18.45, 22.15, 25.84]
  const now = date
  const daysSince = (now.getTime() - KNOWN_NEW_MOON.getTime()) / MS_PER_DAY
  const cyclesElapsed = Math.floor(daysSince / SYNODIC_MONTH)
  const newMoonRecent = new Date(KNOWN_NEW_MOON.getTime() + cyclesElapsed * SYNODIC_MONTH * MS_PER_DAY)

  return PHASE_OFFSETS.map((offset, i) => {
    const nextOffset = i < 7 ? PHASE_OFFSETS[i + 1] : SYNODIC_MONTH
    let start = new Date(newMoonRecent.getTime() + offset * MS_PER_DAY)
    let end = new Date(newMoonRecent.getTime() + nextOffset * MS_PER_DAY - MS_PER_DAY)
    let daysUntil = Math.ceil((start.getTime() - now.getTime()) / MS_PER_DAY)

    // If this phase already passed in the current cycle, roll to next cycle
    if (daysUntil < -Math.ceil(nextOffset - offset) + 1) {
      start = new Date(newMoonRecent.getTime() + (offset + SYNODIC_MONTH) * MS_PER_DAY)
      end = new Date(newMoonRecent.getTime() + (nextOffset + SYNODIC_MONTH) * MS_PER_DAY - MS_PER_DAY)
      daysUntil = Math.ceil((start.getTime() - now.getTime()) / MS_PER_DAY)
    }

    return { icon: MOON_PHASES[i].icon, name: MOON_PHASES[i].name, start, end, daysUntil }
  })
}

// ── Technical indicator helpers ─────────────────────────────────────────────
export function calcSMA(data: number[], period: number): (number | null)[] {
  if (!data || data.length === 0) return []
  const sma: (number | null)[] = new Array(data.length).fill(null)
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i]
    if (i >= period) sum -= data[i - period]
    if (i >= period - 1) sma[i] = sum / period
  }
  return sma
}

export function calcEMA(data: number[], period: number): (number | null)[] {
  if (!data || data.length === 0) return []
  const ema: (number | null)[] = new Array(data.length).fill(null)
  const multiplier = 2 / (period + 1)
  let prev = data[0]
  ema[0] = prev
  for (let i = 1; i < data.length; i++) {
    prev = (data[i] - prev) * multiplier + prev
    ema[i] = prev
  }
  return ema
}

export function calcRSI(prices: number[], period = 14): number {
  if (!prices || prices.length < period + 1) return 50
  let gains = 0
  let losses = 0
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export function calcATR(prices: number[], period = 14): number {
  if (!prices || prices.length < period + 1) return 0
  const trs: number[] = []
  for (let i = 1; i < prices.length; i++) trs.push(Math.abs(prices[i] - prices[i - 1]))
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period
}

export function calcMACD(data: number[], shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
  if (!data || data.length === 0) return { macd: [], signal: [], histogram: [] }
  const emaShort = calcEMA(data, shortPeriod)
  const emaLong = calcEMA(data, longPeriod)
  const macd = data.map((_, i) => {
    if (emaShort[i] === null || emaLong[i] === null) return null as number | null
    return (emaShort[i] as number) - (emaLong[i] as number)
  })
  const signal = calcEMA(
    macd.map((v) => v ?? 0),
    signalPeriod
  )
  const histogram = macd.map((value, i) => (value === null ? null : value - (signal[i] ?? 0)))
  return { macd, signal, histogram }
}

export function calculateFibonacciLevels(prices: number[], lookback = 120): Omit<FibonacciInsight, 'accuracy' | 'note' | 'trendStrength' | 'volumeRatio'> | null {
  if (!prices || prices.length === 0) return null
  const slice = prices.slice(-lookback)
  const high = Math.max(...slice)
  const low = Math.min(...slice)
  const last = slice[slice.length - 1]
  const trend: 'up' | 'down' = last >= slice[0] ? 'up' : 'down'
  const range = high - low
  const retracementRatios = [0.236, 0.382, 0.5, 0.618, 0.786]
  const extensionRatios = [1.272, 1.618]

  const retracements = retracementRatios.map((ratio) => ({
    ratio,
    level: trend === 'up' ? high - range * ratio : low + range * ratio,
  }))
  const extensions = extensionRatios.map((ratio) => ({
    ratio,
    level: trend === 'up' ? low + range * ratio : high - range * ratio,
  }))

  return { high, low, trend, retracements, extensions }
}

export function buildFibonacciInsight(coin: any): FibonacciInsight | null {
  const prices: number[] = coin?.sparkline_in_7d?.price || coin?.sparkline || []
  const fib = calculateFibonacciLevels(prices, 120)
  if (!fib) return null

  const volumeRatio = coin.market_cap ? (coin.total_volume || 0) / coin.market_cap : 0
  const trendStrength = coin.price_change_percentage_7d_in_currency || 0

  let accuracy = 'Medium'
  let note = 'Gunakan sebagai area konfirmasi, bukan kepastian.'
  if (Math.abs(trendStrength) > 12 && volumeRatio > 0.18) {
    accuracy = 'High'
    note = 'Trend kuat + volume tinggi, level fib lebih relevan.'
  } else if (Math.abs(trendStrength) < 5 || volumeRatio < 0.08) {
    accuracy = 'Low'
    note = 'Trend lemah/volume rendah, hati-hati false signal.'
  }

  return { ...fib, accuracy, note, trendStrength, volumeRatio }
}

function getSparkline(coin: any): number[] {
  return coin?.sparkline_in_7d?.price || coin?.sparkline || []
}

// ── Futures analysis (full port) ────────────────────────────────────────────
export function getFuturesAnalysis(coin: any): FuturesAnalysis {
  const price = coin.current_price || 0
  const ch1h = coin.price_change_percentage_1h_in_currency || 0
  const ch24h = coin.price_change_percentage_24h || 0
  const ch7d = coin.price_change_percentage_7d_in_currency || 0
  const volRatio = coin.market_cap ? (coin.total_volume || 0) / coin.market_cap : 0

  const spark = getSparkline(coin)

  function estimateAtrFromPct(): number {
    const daily24h = (Math.abs(ch24h) / 100) * price
    const daily7d = (Math.abs(ch7d) / 7 / 100) * price
    const est = daily24h * 0.6 + daily7d * 0.4
    return Math.max(est, price * 0.01)
  }

  const rsi = calcRSI(spark, 14)
  const ema20Series = calcEMA(spark, 20)
  const ema50Series = calcEMA(spark, 50)
  const ema20 = ema20Series[ema20Series.length - 1] ?? price
  const ema50 = ema50Series[ema50Series.length - 1] ?? price
  const rawAtr = calcATR(spark, 14)
  const atr = rawAtr > 0 ? rawAtr : estimateAtrFromPct()
  const atrPct = price > 0 ? (atr / price) * 100 : 2

  function calcSwingLevels(prices: number[], lookback = 20): { resist: number | null; support: number | null } | null {
    if (!prices || prices.length < lookback) return null
    const recent = prices.slice(-lookback)
    const highs: number[] = []
    const lows: number[] = []
    for (let i = 1; i < recent.length - 1; i++) {
      if (recent[i] >= recent[i - 1] && recent[i] >= recent[i + 1]) highs.push(recent[i])
      if (recent[i] <= recent[i - 1] && recent[i] <= recent[i + 1]) lows.push(recent[i])
    }
    const aboveHighs = highs.filter((h) => h > price).sort((a, b) => a - b)
    const belowLows = lows.filter((l) => l < price).sort((a, b) => b - a)
    return { resist: aboveHighs[0] ?? null, support: belowLows[0] ?? null }
  }

  const swings = spark.length > 20 ? calcSwingLevels(spark, 30) : null
  const sorted = [...spark].sort((a, b) => a - b)
  const pct10 = spark.length > 10 ? sorted[Math.floor(sorted.length * 0.1)] : null
  const pct90 = spark.length > 10 ? sorted[Math.floor(sorted.length * 0.9)] : null

  const resist = swings?.resist && swings.resist > price
    ? swings.resist
    : pct90 && pct90 > price
      ? pct90
      : price * (1 + Math.max((Math.abs(ch7d) / 100) * 0.4, 0.03))

  const support = swings?.support && swings.support < price
    ? swings.support
    : pct10 && pct10 < price
      ? pct10
      : price * (1 - Math.max((Math.abs(ch7d) / 100) * 0.4, 0.03))

  const high7d = spark.length ? Math.max(...spark) : price * 1.1
  const low7d = spark.length ? Math.min(...spark) : price * 0.9
  const range7d = high7d - low7d || 1
  const posInRange = (price - low7d) / range7d

  let score = 0
  const factors: string[] = []

  if (ch24h > 5) { score += 2; factors.push(`24h +${ch24h.toFixed(1)}% ↑↑`) }
  else if (ch24h > 1) { score += 1; factors.push(`24h +${ch24h.toFixed(1)}% ↑`) }
  else if (ch24h < -5) { score -= 2; factors.push(`24h ${ch24h.toFixed(1)}% ↓↓`) }
  else if (ch24h < -1) { score -= 1; factors.push(`24h ${ch24h.toFixed(1)}% ↓`) }

  if (ch7d > 10) { score += 2; factors.push(`7d +${ch7d.toFixed(0)}% ↑↑`) }
  else if (ch7d > 0) { score += 1; factors.push(`7d +${ch7d.toFixed(0)}% ↑`) }
  else if (ch7d < -10) { score -= 2; factors.push(`7d ${ch7d.toFixed(0)}% ↓↓`) }
  else if (ch7d < 0) { score -= 1; factors.push(`7d ${ch7d.toFixed(0)}% ↓`) }

  if (rsi < 30) { score += 2; factors.push(`RSI ${rsi.toFixed(0)} oversold`) }
  else if (rsi < 45) { score += 1; factors.push(`RSI ${rsi.toFixed(0)} lemah`) }
  else if (rsi > 75) { score -= 2; factors.push(`RSI ${rsi.toFixed(0)} overbought`) }
  else if (rsi > 60) { score -= 1; factors.push(`RSI ${rsi.toFixed(0)} tinggi`) }

  if (ema20 > ema50) { score += 1; factors.push('EMA20 > EMA50 bullish') }
  else if (ema20 < ema50) { score -= 1; factors.push('EMA20 < EMA50 bearish') }

  const distToResist = ((resist - price) / price) * 100
  const distToSupport = ((price - support) / price) * 100
  if (distToSupport < 1 && distToSupport >= 0) {
    score += 1; factors.push('Harga dekat support')
  } else if (distToSupport < 0) {
    score -= 2; factors.push('Breakdown support ↓')
  }
  if (distToResist < 0) {
    score += 1; factors.push('Breakout resistance ↑')
  } else if (distToResist < 2) {
    score -= 1; factors.push('Harga dekat resistensi')
  }

  if (volRatio > 0.2 && ch24h > 0) { score += 1; factors.push('Volume spike + naik') }
  if (volRatio > 0.2 && ch24h < 0) { score -= 1; factors.push('Volume spike + turun') }

  const confirmedUp = ch1h > 0.5 && score > 0
  const confirmedDown = ch1h < -0.5 && score < 0

  let direction: FuturesAnalysis['direction']
  let dirLabel: string
  let dirColor: string
  let dirEmoji: string
  if (score >= 3) { direction = 'long'; dirLabel = 'LONG'; dirColor = '#22c55e'; dirEmoji = '🟢' }
  else if (score <= -3) { direction = 'short'; dirLabel = 'SHORT'; dirColor = '#ef4444'; dirEmoji = '🔴' }
  else if (score >= 1) { direction = 'long_weak'; dirLabel = 'LONG (Lemah)'; dirColor = '#86efac'; dirEmoji = '↗️' }
  else if (score <= -1) { direction = 'short_weak'; dirLabel = 'SHORT (Lemah)'; dirColor = '#fca5a5'; dirEmoji = '↘️' }
  else { direction = 'neutral'; dirLabel = 'NETRAL / Hindari'; dirColor = '#94a3b8'; dirEmoji = '⚪' }

  let leverage: number
  if (atrPct > 6) leverage = 2
  else if (atrPct > 4) leverage = 3
  else if (atrPct > 2.5) leverage = 5
  else if (atrPct > 1.5) leverage = 7
  else leverage = 10
  if (direction === 'neutral') leverage = 1
  if (direction.includes('weak')) leverage = Math.min(leverage, 3)

  const rr = 2.0
  let entry = price
  let tp1: number
  let tp2: number
  let sl: number
  let liqEstimate: number

  if (direction === 'long' || direction === 'long_weak') {
    entry = price
    const slByAtr = price - atr * 1.5
    const slBySupport = support < price ? support * 0.995 : slByAtr
    sl = Math.max(slByAtr, slBySupport)
    if (sl >= entry) sl = entry - atr * 1.5
    const risk = entry - sl
    tp1 = entry + risk * rr
    tp2 = entry + risk * rr * 1.8
    liqEstimate = entry * (1 - (1 / leverage) * 0.9)
  } else if (direction === 'short' || direction === 'short_weak') {
    entry = price
    const slByAtr = price + atr * 1.5
    const slByResist = resist > price ? resist * 1.005 : slByAtr
    sl = Math.min(slByAtr, slByResist)
    if (sl <= entry) sl = entry + atr * 1.5
    const risk = sl - entry
    tp1 = entry - risk * rr
    tp2 = entry - risk * rr * 1.8
    tp1 = Math.max(tp1, 0)
    tp2 = Math.max(tp2, 0)
    liqEstimate = entry * (1 + (1 / leverage) * 0.9)
  } else {
    entry = tp1 = tp2 = sl = liqEstimate = price
  }

  tp1 = Math.max(tp1 ?? 0, 0)
  tp2 = Math.max(tp2 ?? 0, 0)
  sl = Math.max(sl ?? 0, 0)

  const riskPct = entry > 0 ? (Math.abs(entry - sl) / entry) * 100 : 0
  const rewardPct = entry > 0 ? (Math.abs(tp1 - entry) / entry) * 100 : 0
  const rrRatio = riskPct > 0 ? rewardPct / riskPct : 0

  let volatilityLevel: string
  if (atrPct > 6) volatilityLevel = 'Sangat Tinggi 🔴'
  else if (atrPct > 3.5) volatilityLevel = 'Tinggi 🟠'
  else if (atrPct > 2) volatilityLevel = 'Sedang 🟡'
  else volatilityLevel = 'Rendah 🟢'

  const absScore = Math.abs(score)
  let confidence: string
  if (absScore >= 5 && (confirmedUp || confirmedDown)) confidence = 'Tinggi ✅'
  else if (absScore >= 3) confidence = 'Sedang 📊'
  else if (absScore >= 1) confidence = 'Lemah ⚠️'
  else confidence = 'Tidak ada ❌'

  return {
    direction, dirLabel, dirColor, dirEmoji, score, leverage,
    entry, tp1, tp2, sl, liqEstimate,
    riskPct, rewardPct, rrRatio,
    rsi, atrPct, volatilityLevel, confidence, factors,
    support, resistance: resist,
    isNeutral: direction === 'neutral',
  }
}

// ── Indicator guide ─────────────────────────────────────────────────────────
export function buildIndicatorGuide(coin: any): IndicatorGuide {
  const price = coin.current_price || 0
  const spark = getSparkline(coin)
  const sma20Series = calcSMA(spark, 20)
  const ema20Series = calcEMA(spark, 20)
  const ema50Series = calcEMA(spark, 50)
  const macdSeries = calcMACD(spark, 12, 26, 9)
  const lastIndex = spark.length - 1

  const ma20 = sma20Series[lastIndex] ?? null
  const ema20 = ema20Series[lastIndex] ?? null
  const ema50 = ema50Series[lastIndex] ?? null
  const macd = macdSeries.macd[lastIndex] ?? null
  const signal = macdSeries.signal[lastIndex] ?? null
  const hist = macdSeries.histogram[lastIndex] ?? null

  const checks: IndicatorCheck[] = []
  if (ma20 != null) {
    const ok = price > ma20
    checks.push({
      id: 'ma20',
      ok,
      label: `${ok ? '✅' : '❌'} Harga > MA20`,
      note: ok ? 'BULLISH — harga di atas rata-rata 20 hari' : 'BEARISH — harga di bawah rata-rata 20 hari',
    })
  }
  if (ema20 != null) {
    const ok = price > ema20
    checks.push({
      id: 'ema20',
      ok,
      label: `${ok ? '✅' : '❌'} Harga > EMA20`,
      note: ok ? 'BULLISH — EMA responsif, sinyal cepat' : 'BEARISH — momentum melemah',
    })
  }
  if (ema20 != null && ema50 != null) {
    const ok = ema20 > ema50
    checks.push({
      id: 'ema20v50',
      ok,
      label: `${ok ? '✅' : '❌'} EMA20 > EMA50`,
      note: ok ? 'Golden Cross area — trend naik jangka menengah' : 'Death Cross area — trend turun jangka menengah',
    })
  }
  if (macd != null && signal != null) {
    const ok = macd > signal
    checks.push({
      id: 'macd',
      ok,
      label: `${ok ? '✅' : '❌'} MACD > Signal`,
      note: ok ? 'BULLISH crossover — momentum naik' : 'BEARISH crossover — momentum turun',
    })
  }
  if (hist != null) {
    const ok = hist > 0
    checks.push({
      id: 'hist',
      ok,
      label: `${ok ? '✅' : '❌'} Histogram positif`,
      note: ok ? 'Bullish momentum menguat' : 'Bearish momentum menguat',
    })
  }

  const bullCount = checks.filter((c) => c.ok).length
  const totalCount = checks.length
  const overallOk = bullCount > totalCount / 2
  const overallLabel = bullCount === totalCount
    ? '🔥 Full Bullish'
    : bullCount > totalCount / 2
      ? `📈 Bullish (${bullCount}/${totalCount})`
      : bullCount === 0
        ? '💀 Full Bearish'
        : `📉 Bearish (${bullCount}/${totalCount})`

  return {
    price, ma20, ema20, ema50, macd, signal, histogram: hist,
    checks, bullCount, totalCount, overallOk, overallLabel,
  }
}

// ── AI score & ranking ──────────────────────────────────────────────────────
export function scoreCoin(coin: any, futures?: FuturesAnalysis, moon?: MoonPhaseInfo): CoinAnalysis {
  const ch24h = coin.price_change_percentage_24h || 0
  const ch7d = coin.price_change_percentage_7d_in_currency || 0
  const volRatio = coin.market_cap ? (coin.total_volume || 0) / coin.market_cap : 0
  const spark = getSparkline(coin)
  const rsi = calcRSI(spark, 14)
  const f = futures ?? getFuturesAnalysis(coin)
  const m = moon ?? getMoonPhaseInfo(new Date())

  const factors: AIFactor[] = []
  let score = 50

  let f1 = 0
  if (ch24h > 5) f1 = 12; else if (ch24h > 0) f1 = 5
  else if (ch24h < -5) f1 = -12; else if (ch24h < 0) f1 = -5
  score += f1
  factors.push({ label: 'Momentum 24h', value: f1, max: 12, desc: `${ch24h >= 0 ? '+' : ''}${ch24h.toFixed(1)}%` })

  let f2 = 0
  if (ch7d > 10) f2 = 10; else if (ch7d > 0) f2 = 4
  else if (ch7d < -10) f2 = -10; else if (ch7d < 0) f2 = -4
  score += f2
  factors.push({ label: 'Trend 7D', value: f2, max: 10, desc: `${ch7d >= 0 ? '+' : ''}${ch7d.toFixed(1)}%` })

  let f3 = 0
  if (volRatio > 0.3) f3 = 12; else if (volRatio > 0.1) f3 = 7
  else if (volRatio < 0.02) f3 = -5
  score += f3
  factors.push({ label: 'Likuiditas', value: f3, max: 12, desc: `Vol/MCap ${(volRatio * 100).toFixed(1)}%` })

  const rank = coin.market_cap_rank || 999
  let f4 = 0
  if (rank <= 10) f4 = 15; else if (rank <= 50) f4 = 8; else if (rank <= 100) f4 = 3
  score += f4
  factors.push({ label: 'Market Cap Rank', value: f4, max: 15, desc: `#${rank}` })

  let f5 = 0
  if (rsi < 30) f5 = 8; else if (rsi > 75) f5 = -8
  else if (rsi < 45) f5 = 3; else if (rsi > 60) f5 = -3
  score += f5
  factors.push({ label: 'RSI(14)', value: f5, max: 8, desc: `RSI ${rsi.toFixed(0)}` })

  let f6 = 0
  if (f.direction === 'long') f6 = 5
  else if (f.direction === 'short') f6 = -5
  else if (f.direction === 'long_weak') f6 = 2
  else if (f.direction === 'short_weak') f6 = -2
  score += f6
  factors.push({ label: 'Futures Signal', value: f6, max: 5, desc: `${f.dirEmoji} ${f.dirLabel}` })

  // 7th factor: Moon phase sentiment modifier (real, computed from current date)
  const f7 = m.aiWeight
  score += f7
  factors.push({ label: 'Moon Phase', value: f7, max: 8, desc: `${m.icon} ${m.name} (${m.bias})` })

  const aiScore = Math.min(100, Math.max(0, Math.round(score)))

  return {
    id: coin.id,
    symbol: (coin.symbol || '').toUpperCase(),
    name: coin.name || coin.symbol || '',
    image: coin.image || null,
    current_price: coin.current_price || 0,
    price_change_percentage_24h: ch24h,
    total_volume: coin.total_volume || 0,
    market_cap: coin.market_cap || 0,
    market_cap_rank: rank,
    sparkline: spark,
    aiScore,
    rsi: Math.round(rsi),
    futuresDir: `${f.dirEmoji} ${f.dirLabel}`,
    leverage: f.leverage,
    factors,
    moon: m,
    futures: f,
    fibonacci: buildFibonacciInsight(coin),
    indicators: buildIndicatorGuide(coin),
  }
}

export function scoreAllCoins(coins: any[]): CoinAnalysis[] {
  return coins.map((coin) => scoreCoin(coin)).sort((a, b) => b.aiScore - a.aiScore)
}

// ── Shared formatting helpers ───────────────────────────────────────────────
export function formatUsd(v: number): string {
  if (!v || isNaN(v)) return 'N/A'
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(2)}T`
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`
  return `$${v.toFixed(2)}`
}

export function formatPrice(v: number): string {
  if (!v && v !== 0) return 'N/A'
  if (v >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  if (v >= 1) return `$${v.toFixed(2)}`
  if (v >= 0.01) return `$${v.toFixed(4)}`
  return `$${v.toPrecision(3)}`
}

export function formatCompact(v: number): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (v >= 1000) return `$${(v / 1000).toFixed(2)}K`
  if (v >= 1) return `$${v.toFixed(3)}`
  if (v >= 0.01) return `$${v.toFixed(4)}`
  return `$${v.toFixed(6)}`
}

export function scoreColor(s: number): string {
  return s >= 80 ? '#4ade80' : s >= 65 ? '#fbbf24' : s >= 45 ? '#94a3b8' : '#f87171'
}
