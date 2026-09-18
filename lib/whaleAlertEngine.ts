// ══════════════════════════════════════════════════════════════════════════
//  WHALE ACCUMULATION RADAR — scoring engine
//
//  Ported verbatim (score weights, thresholds and reasoning strings unchanged)
//  from the user's legacy vanilla-JS reference project
//  (~/Documents/crypto-scanner/app.js:1358-1548, buildWhaleAlerts()) so the
//  Home page's "Whale Accumulation Radar" card grid matches it exactly:
//  BUY/SELL/WATCH action classification, a Score X/60 bar, and the same
//  reasoning tag strings ("Akumulasi: Vol X% + price naik stabil",
//  "Breakout fresh", "Vol/MCap ekstrem", "Far from ATH", "Small cap", etc).
// ══════════════════════════════════════════════════════════════════════════

export interface WhaleAlert {
  coinId: string
  name: string
  symbol: string
  image?: string
  price: number
  ch24h: number
  ch1h: number
  ch7d: number
  volRatio: number
  buyScore: number
  sellScore: number
  totalScore: number
  action: 'BUY' | 'SELL' | 'WATCH'
  reasons: string[]
  intradaySpike: boolean
  mcap: number
}

export function buildWhaleAlerts(coins: any[]): WhaleAlert[] {
  const scored: WhaleAlert[] = coins
    .filter((c) => c.current_price > 0 && c.total_volume > 0)
    .map((coin) => {
      const ch24h = coin.price_change_percentage_24h || 0
      const ch1h = coin.price_change_percentage_1h_in_currency || 0
      const ch7d = coin.price_change_percentage_7d_in_currency || 0
      const volRatio = coin.market_cap > 0 ? coin.total_volume / coin.market_cap : 0
      const price = coin.current_price || 0
      const ath = coin.ath || price
      const mcap = coin.market_cap || 0
      const athDist = ath > 0 ? ((price - ath) / ath) * 100 : 0
      const low24h = coin.low_24h || price
      const high24h = coin.high_24h || price
      const rangePos = high24h - low24h > 0 ? (price - low24h) / (high24h - low24h) : 0.5

      let buyScore = 0
      let sellScore = 0
      const reasons: string[] = []
      const flags: string[] = []

      // ── [A] DISTRIBUSI DETECTION ─────────────────────────────
      const isDistributing = volRatio > 0.15 && ch24h > 5 && ch1h < -1.5
      const isPumpExhausted = ch7d > 200 && ch1h < 0
      const isLateEntry = ch7d > 100 && ch24h > 15
      const isSelloff = ch24h < -5 && ch1h < -2 && volRatio > 0.1
      const isDumpingFast = ch1h < -5 && volRatio > 0.2

      if (isDistributing) {
        sellScore += 35
        flags.push('distribusi')
        reasons.push(`⚠️ Distribusi: Vol tinggi tapi 1H turun ${ch1h.toFixed(1)}%`)
      }
      if (isPumpExhausted) {
        sellScore += 30
        flags.push('pump_exhausted')
        reasons.push(`🚨 Pump exhausted: +${ch7d.toFixed(0)}% 7D tapi 1H sudah negatif`)
      }
      if (isLateEntry) {
        flags.push('late_entry')
        buyScore -= 20
        reasons.push(`⛔ Late entry: sudah +${ch7d.toFixed(0)}% 7D`)
      }
      if (isSelloff) {
        sellScore += 28
        flags.push('selloff')
        reasons.push(`Sell-off: ${ch24h.toFixed(1)}% 24H + ${ch1h.toFixed(1)}% 1H`)
      }
      if (isDumpingFast) {
        sellScore += 20
        reasons.push(`Dump cepat: ${ch1h.toFixed(1)}% dalam 1 jam`)
      }

      // ── [B] AKUMULASI DETECTION ──────────────────────────────
      const isAccumulating = volRatio > 0.15 && ch24h > 3 && ch1h >= 0 && ch7d < 150
      const isFreshBreakout = ch1h > 3 && ch24h > 5 && rangePos > 0.8 && ch7d < 100
      const isReversal = ch7d < -20 && ch24h > 5 && ch1h > 1 && volRatio > 0.12
      const isBounceFromLow = rangePos < 0.2 && ch1h > 1.5 && ch24h > 0
      const isQuietAccum = volRatio > 0.2 && Math.abs(ch24h) < 3 && Math.abs(ch1h) < 1

      if (isAccumulating && !flags.includes('late_entry')) {
        buyScore += 35
        reasons.push(`📈 Akumulasi: Vol ${(volRatio * 100).toFixed(1)}% + price naik stabil`)
      }
      if (isFreshBreakout) {
        buyScore += 25
        reasons.push(`🚀 Breakout fresh: +${ch1h.toFixed(1)}% 1H di high range`)
      }
      if (isReversal) {
        buyScore += 28
        reasons.push(`Reversal: -${Math.abs(ch7d).toFixed(0)}% 7D, sekarang balik +${ch24h.toFixed(1)}%`)
      }
      if (isBounceFromLow) {
        buyScore += 18
        reasons.push(`📌 Bounce dari low — range pos ${(rangePos * 100).toFixed(0)}%`)
      }
      if (isQuietAccum) {
        buyScore += 15
        reasons.push(`🤫 Akumulasi diam: Vol ${(volRatio * 100).toFixed(1)}% tanpa spike harga`)
      }

      // ── [C] VOLUME BONUS (kontekstual) ───────────────────────
      if (volRatio > 0.4 && !isDistributing && !isPumpExhausted) {
        buyScore += 15
        reasons.push(`🔥 Vol/MCap ${(volRatio * 100).toFixed(1)}% (ekstrem)`)
      } else if (volRatio > 0.25 && !isDistributing) {
        buyScore += 10
        reasons.push(`🔥 Vol/MCap ${(volRatio * 100).toFixed(1)}% (tinggi)`)
      } else if (volRatio > 0.12) {
        buyScore += 5
        reasons.push(`📊 Vol/MCap ${(volRatio * 100).toFixed(1)}%`)
      }

      if (volRatio > 0.2 && ch24h < -3) {
        sellScore += 15
      }

      // ── [D] MOMENTUM DECAY PENALTY ───────────────────────────
      const momentumDecay = ch7d > 50 && Math.abs(ch24h) < 3
      if (momentumDecay) {
        buyScore -= 10
        reasons.push(`Momentum melambat setelah +${ch7d.toFixed(0)}% 7D`)
      }

      // ── [E] ATH PROXIMITY ────────────────────────────────────
      const isNearATH = athDist > -10
      const isFarATH = athDist < -70
      if (isNearATH && ch24h > 3 && !flags.includes('pump_exhausted')) {
        buyScore += 12
        reasons.push(`🎯 Dekat ATH — breakout momentum`)
      }
      if (isNearATH && ch1h < 0) {
        sellScore += 10
      }
      if (isFarATH && ch24h > 5 && ch7d < 50) {
        buyScore += 10
        reasons.push(`💎 Far from ATH — reversal potential`)
      }

      // ── [F] MARKET CAP FILTER (small cap = lebih volatile) ───
      const isSmallCap = mcap > 0 && mcap < 100_000_000
      if (isSmallCap && buyScore > sellScore) {
        buyScore += 5
        reasons.push(`🔬 Small cap — high risk/reward`)
      }

      // ── [G] RANGE POSITION ───────────────────────────────────
      if (rangePos > 0.9 && ch1h < 0) {
        sellScore += 12
      }
      if (rangePos < 0.1 && ch1h >= 0) {
        buyScore += 10
      }

      buyScore = Math.max(0, buyScore)
      sellScore = Math.max(0, sellScore)

      let action: 'BUY' | 'SELL' | 'WATCH' = 'WATCH'
      const scoreDiff = buyScore - sellScore
      if (flags.includes('pump_exhausted') || flags.includes('distribusi')) {
        action = sellScore > 30 ? 'SELL' : 'WATCH'
      } else if (scoreDiff >= 15 && buyScore >= 30) {
        action = 'BUY'
      } else if (scoreDiff <= -15 && sellScore >= 30) {
        action = 'SELL'
      } else {
        action = 'WATCH'
      }

      const totalScore = Math.max(buyScore, sellScore)

      return {
        coinId: coin.id,
        name: coin.name,
        symbol: (coin.symbol || '').toUpperCase(),
        image: coin.image,
        price,
        ch24h,
        ch1h,
        ch7d,
        volRatio,
        buyScore,
        sellScore,
        totalScore,
        action,
        reasons: [...new Set(reasons)].slice(0, 4),
        intradaySpike: volRatio > 0.2 && Math.abs(ch1h) > 2,
        mcap,
      }
    })
    .filter((c) => c.totalScore >= 25 && (c.volRatio > 0.08 || Math.abs(c.ch24h) > 4))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 10)

  return scored
}
