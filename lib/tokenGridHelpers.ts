// ══════════════════════════════════════════════════════════════════════════
//  TOKEN SCANNER GRID — pure helper logic
//
//  Ported verbatim (formulas unchanged) from the user's legacy vanilla-JS
//  reference project (~/Documents/crypto-scanner, app.js + analysis-utils.js)
//  so the Home page's token grid matches its AGE / LIQUIDITY / FIB / SIGNAL
//  columns exactly. Only naming/typing was adapted for TS.
// ══════════════════════════════════════════════════════════════════════════

export interface SignalResult {
  type: 'buy' | 'sell' | 'wait' | 'danger' | 'hold'
  label: string
  hint: string
}

function fmtSignalPrice(n: number): string {
  if (!n) return '—'
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

// app.js:4084-4271 — getTradingSignal(coin)
export function getTradingSignal(coin: any): SignalResult {
  const price = coin.current_price || 0
  const ch24h = coin.price_change_percentage_24h || 0
  const ch7d = coin.price_change_percentage_7d_in_currency || 0
  const prices: number[] = coin.sparkline_in_7d?.price || []
  const volRatio = coin.market_cap ? coin.total_volume / coin.market_cap : 0

  let support: number | null = null
  let resistance: number | null = null
  if (prices.length >= 10) {
    const sorted = [...prices].sort((a, b) => a - b)
    support = sorted[Math.floor(sorted.length * 0.1)]
    resistance = sorted[Math.floor(sorted.length * 0.9)]
  }

  const low7d = prices.length ? Math.min(...prices) : price * 0.85
  const high7d = prices.length ? Math.max(...prices) : price * 1.15
  const range = high7d - low7d || 1
  const posInRange = (price - low7d) / range

  const nearSupport = posInRange < 0.2
  const nearResistance = posInRange > 0.8
  const midZone = posInRange >= 0.35 && posInRange <= 0.65

  const strongBull = ch24h > 5 && ch7d > 10 && volRatio > 0.1
  const mildBull = ch24h > 0 && ch7d > 0
  const strongBear = ch24h < -5 && ch7d < -10
  const highRisk = volRatio > 0.5 || Math.abs(ch24h) > 15

  const fmt = fmtSignalPrice

  if (highRisk && ch24h < -10) {
    return { type: 'danger', label: '⚠️ Risiko Tinggi', hint: 'Volatilitas ekstrem, hindari entry' }
  }
  if (strongBull && nearSupport) {
    const tp = fmt(support ? support * 1.15 : price * 1.12)
    const sl = fmt(support ? support * 0.96 : price * 0.95)
    return { type: 'buy', label: `🟢 Beli di ${fmt(price)}`, hint: `TP: ${tp} · SL: ${sl}` }
  }
  if (mildBull && nearSupport && !highRisk) {
    const tp = fmt(price * 1.08)
    return { type: 'buy', label: `🟢 Beli di ${fmt(price)}`, hint: `TP ${tp} · konfirmasi volume` }
  }
  if (nearResistance && mildBull) {
    const waitPrice = fmt(resistance ? resistance * 0.92 : price * 0.92)
    return { type: 'wait', label: '⏳ Tunggu pullback', hint: `Entry ideal ≈ ${waitPrice}` }
  }
  if (midZone && ch24h > 0 && ch24h < 3) {
    const entryIdeal = fmt(support ? support * 1.01 : price * 0.96)
    return { type: 'wait', label: `⏳ Tunggu di ${entryIdeal}`, hint: 'Belum ada konfirmasi breakout' }
  }
  if (nearResistance && (strongBear || ch24h < -3)) {
    const sl = fmt(resistance ? resistance * 1.03 : price * 1.03)
    return { type: 'sell', label: '🔴 Jual / Hindari', hint: `Resistensi kuat, SL ${sl}` }
  }
  if (strongBear) {
    const reboundZone = fmt(low7d * 1.05)
    return { type: 'sell', label: '🔴 Distribusi', hint: `Tunggu rebound ≈ ${reboundZone}` }
  }
  if (mildBull && midZone) {
    const tp = fmt(resistance || price * 1.08)
    return { type: 'hold', label: '🔵 Hold', hint: `Target ${tp}, tahan posisi` }
  }
  if (ch24h < -3) {
    const waitEntry = fmt(low7d * 1.02)
    return { type: 'wait', label: '⏳ Tunggu sinyal', hint: `Entry aman ≈ ${waitEntry}` }
  }
  return { type: 'hold', label: '🔵 Netral', hint: 'Pantau pergerakan volume' }
}

// app.js:2016-2028 — getAgeLabel(coin) — ATL date used as an age proxy (legacy heuristic)
export function getAgeLabel(coin: any): { text: string; cls: 'age-new' | 'age-mid' | 'age-old' } {
  if (coin.atl_date) {
    const ms = Date.now() - new Date(coin.atl_date).getTime()
    const days = Math.floor(ms / 86400000)
    if (days > 365 * 3) return { text: `${Math.floor(days / 365)}y`, cls: 'age-old' }
    if (days > 365) return { text: `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m`, cls: 'age-mid' }
    if (days > 30) return { text: `${Math.floor(days / 30)}mo`, cls: 'age-mid' }
    return { text: `${days}d`, cls: 'age-new' }
  }
  const rank = coin.market_cap_rank || 999
  if (rank <= 20) return { text: 'Established', cls: 'age-old' }
  return { text: '—', cls: 'age-mid' }
}

// app.js:4319-4325 — getLiquidityBadge(coin)
export function getLiquidityLabel(coin: any): string {
  const volumeRatio = coin.market_cap ? coin.total_volume / coin.market_cap : 0
  if (volumeRatio > 0.3) return '💧💧💧 High'
  if (volumeRatio > 0.1) return '💧💧 Medium'
  return '💧 Low'
}

// app.js:4273-4281 — getWhaleActivity(coin) (plain-text WHALE column, distinct from the
// Whale Accumulation Radar's own scoring engine in lib/whaleAlertEngine.ts)
export function getWhaleActivityLabel(coin: any): string {
  const volRatio = coin.market_cap ? coin.total_volume / coin.market_cap : 0
  if (volRatio > 0.3) return '🐋 High'
  if (volRatio > 0.1) return '🐋 Medium'
  return '🐋 Low'
}

export interface FibLevel {
  ratio: number
  level: number
}
export interface FibResult {
  high: number
  low: number
  trend: 'up' | 'down'
  retracements: FibLevel[]
  extensions: FibLevel[]
}

// analysis-utils.js:119-145 — calculateFibonacciLevels(prices, lookback)
export function calculateFibonacciLevels(prices: number[], lookback = 120): FibResult | null {
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

export interface FibBadge {
  text: string
  cls: 'above' | 'below'
  near: boolean
  title: string
}

// app.js:4327-4363 — getFibLevelBadge(coin)
export function getFibLevelBadge(coin: any): FibBadge | null {
  const prices: number[] = coin.sparkline_in_7d?.price
  if (!prices || prices.length < 5) return null
  const fib = calculateFibonacciLevels(prices, prices.length)
  if (!fib) return null

  const current = coin.current_price
  const allLevels = [
    ...fib.retracements.map((l) => ({ ...l, type: 'ret' as const })),
    ...fib.extensions.filter((l) => l.ratio === 1.272 || l.ratio === 1.618).map((l) => ({ ...l, type: 'ext' as const })),
  ]
  const nearest = allLevels.reduce((prev, cur) => (Math.abs(cur.level - current) < Math.abs(prev.level - current) ? cur : prev))

  const position: 'above' | 'below' = current >= nearest.level ? 'above' : 'below'
  const distPct = nearest.level > 0 ? (Math.abs(current - nearest.level) / nearest.level) * 100 : 0
  const arrow = position === 'above' ? '↑' : '↓'
  const pctLabel = `${(nearest.ratio * 100).toFixed(1)}%`
  const isNear = distPct < 1.5
  const extTag = nearest.type === 'ext' ? ' ext' : ''

  const fmt = (n: number) => (n >= 1 ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${n.toFixed(4)}`)
  const title = `Fibonacci ${nearest.type === 'ext' ? 'Extension' : 'Retracement'} ${pctLabel} @ ${fmt(nearest.level)} | Harga ${position === 'above' ? 'di atas' : 'di bawah'} level ini sebesar ${distPct.toFixed(1)}%${isNear ? ' — SANGAT DEKAT level Fib!' : ''}`

  return { text: `${arrow} ${pctLabel}${extTag}${isNear ? ' 🎯' : ''}`, cls: position, near: isNear, title }
}

export function formatLargeNumber(n: number): string {
  if (!n && n !== 0) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return n.toFixed(0)
}

export function formatPercentage(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}
