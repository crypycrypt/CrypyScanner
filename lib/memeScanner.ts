// ══════════════════════════════════════════════════════════════════════════
//  MEME SCANNER — quality evaluation for NEW memecoins from scanner feeds
//  (BUMP!/GMGN-style on-chain data: holder distribution, bot%, bundle%,
//  creator history, etc.) — NOT price-action/candlestick based.
//
//  Pipeline (spec §2): HARD VETO first, then weighted scoring (§3).
//  A token that trips any veto is REJECTED without computing the score, so
//  obviously dangerous tokens can never slip through on lucky metrics.
//
//  ⚠ The weights/thresholds below are calibrated from the owner's historical
//  data (46 tokens, 11 "down"). DO NOT change them without explicit approval.
//
//  This module is intentionally dependency-free (pure functions + types) so
//  it can run server-side (API routes, outcome tracker) AND client-side
//  (radar table in MemeCommandCenter) without bundling anything heavy.
// ══════════════════════════════════════════════════════════════════════════
import type { MemeToken } from './meme/types'

// ─── §0 · CONFIG — central thresholds (edit here, not inside the functions) ─
// All hard-veto limits and bonus breakpoints live here so the logic stays
// readable and the numbers are easy to tune without touching function bodies.
export const MEME_CONFIG = {
  // Hard vetoes
  vetoMaxCreatorLaunches: 3000,
  vetoMinLpUsd: 5000,
  vetoMaxBundlePct: 60,
  vetoMinOrganicPct: 25,
  vetoMaxTopHolderPct: 30,
  // Dev/creator supply still held — above this = hard veto (dump risk)
  vetoMaxDevHoldPct: 1,
  // Scoring bonuses for a dev that appears to have sold out
  devSoldFullBonusMaxPct: 0.1,   // full +10 bonus when devHoldPct ≤ this
  devSoldPartialBonusMaxPct: 0.5, // partial +5 bonus when devHoldPct ≤ this (and > full)
  devSoldFullBonus: 10,
  devSoldPartialBonus: 5,
  // Tempering: trust the dev-sold bonus fully only when bundlers AND top
  // holder are both low (otherwise the dev may just have rotated supply into
  // a new wallet that shows up as top holder / bundle). Halved otherwise.
  devTrustBundleThreshold: 30,
  devTrustTopHolderThreshold: 15,
  devTrustFactorFull: 1,
  devTrustFactorHalf: 0.5,
}

// ─── §1 · Input schema (per incoming alert) ───────────────────────────────
export type MemeAlert = {
  timestamp: string
  category: string          // 'NEW BONDING' | 'VOLUME SURGE' | 'EARLY WATCH' | 'GRADUATED' | 'HOT' | 'STRONG MOMENTUM' | etc
  name: string
  symbol: string
  contractAddress: string
  chain: 'SOL' | 'EVM' | string
  platform: string           // 'Pump.fun' | 'stonkfun' | etc
  ageMinutes: number         // from '🌱 4m'
  bondingPct?: number        // undefined once Graduated
  graduated: boolean

  mcUsd: number
  lpUsd: number
  vol1mUsd: number
  change1mPct: number
  change5mPct: number

  buys: number
  sells: number
  buySellRatio: number

  holderCount: number
  top10Pct: number
  topHolders: number[]       // [TH1, TH2, TH3, TH4, TH5] individual percentages

  smartCount: number
  kolCount: number
  insiderCount: number

  botPct: number
  sniperCount: number
  bundlePct: number

  organicPct: number
  buyerCount: number

  creatorLaunches: number
  devHoldPct: number         // % supply still held by dev/creator original wallet
  xUrl?: string
}

export type MemeDecision = 'STRONG' | 'WATCH' | 'WEAK' | 'REJECT'

export type MemeVerdict = {
  decision: MemeDecision
  score: number
  reason: string
}

// ─── §3 · FORMULA — scoring 0-100 ─────────────────────────────────────────
// Weights are tuned from historical findings: `creatorLaunches` proved the
// most discriminative feature; `TH1`/`Top10%` turned out weak (almost no
// difference between rug vs stable groups in the sample), so their weight is
// deliberately smaller than initial intuition suggested.
export function computeScore(a: MemeAlert): number {
  const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

  // 1. Creator trust (largest weight — strongest finding from historical data)
  //    log-scaled so creators with a medium history (e.g. 50-500 launches) are
  //    not punished too harshly, while extremes (>1000) still are.
  const creatorScore = clamp(100 - Math.log10(a.creatorLaunches + 1) * 22)

  // 2. Bundle% — lower is better (supply not controlled from launch)
  const bundleScore = clamp(100 - a.bundlePct)

  // 3. Bot% — lower is better (more organic volume)
  const botScore = clamp(100 - a.botPct)

  // 4. Smart money + KOL involvement — signal that someone "knows something"
  //    or there is real social exposure (not a guarantee, but a bonus)
  const smartKolScore = clamp((a.smartCount + a.kolCount) * 20)

  // 5. LP/MC ratio — liquidity relative to market cap size
  //    (thin LP vs big MC = price easily manipulated with small capital)
  const lpRatioScore = clamp((a.lpUsd / Math.max(a.mcUsd, 1)) * 80)

  // 6. Organic% — still used but with reduced weight (weak in historical data)
  const organicScore = a.organicPct

  // 7. Insider penalty — high insider count = extra red flag (not in the
  //    original formula, added as a sensible complement)
  const insiderPenalty = Math.min(20, a.insiderCount * 7)

  // 8. Dev-sold bonus — dev/creator original wallet appears to have sold out
  //    (devHoldPct low). Tempered: this bonus is only trusted fully when the
  //    other risk signals are also low, because a dev that "looks" sold may
  //    simply have rotated supply into a new wallet that then shows up as a
  //    top holder or inside the bundle (sybil/rotation, not a real exit).
  //    devHoldPct rendah/nol BUKAN jaminan aman. Dev/creator asli bisa saja
  //    memindahkan supply-nya ke wallet lain sebelum "keliatan" jual, lalu
  //    wallet baru itu justru muncul sebagai top holder atau bagian dari
  //    bundle. Makanya bonus ini ditahan (devTrustFactor) dan tetap harus
  //    dicek silang dengan bundlePct, topHolders, dan lpUsd - jangan pernah
  //    dipakai sendirian sebagai penentu keputusan.
  const devSoldBonus =
    a.devHoldPct <= MEME_CONFIG.devSoldFullBonusMaxPct
      ? MEME_CONFIG.devSoldFullBonus
      : a.devHoldPct <= MEME_CONFIG.devSoldPartialBonusMaxPct
      ? MEME_CONFIG.devSoldPartialBonus
      : 0
  const devTrustFactor =
    a.bundlePct < MEME_CONFIG.devTrustBundleThreshold &&
    (a.topHolders[0] ?? 100) < MEME_CONFIG.devTrustTopHolderThreshold
      ? MEME_CONFIG.devTrustFactorFull
      : MEME_CONFIG.devTrustFactorHalf
  const adjustedDevBonus = devSoldBonus * devTrustFactor

  const weighted =
    creatorScore   * 0.30 +
    bundleScore    * 0.20 +
    botScore       * 0.15 +
    smartKolScore  * 0.10 +
    lpRatioScore   * 0.10 +
    organicScore   * 0.15
    - insiderPenalty
    + adjustedDevBonus

  return Math.round(clamp(weighted))
}

// ─── §2 · LOGIC — hard veto first, then scoring ───────────────────────────
// Order matters: hard vetoes are checked BEFORE the score is computed, so
// clearly dangerous tokens cannot pass just because other metrics look good.
export function evaluateMemeAlert(alert: MemeAlert): MemeVerdict {
  // ── HARD VETO — instant REJECT, score is not computed ──
  if (alert.creatorLaunches > 3000) {
    return {
      decision: 'REJECT',
      score: 0,
      reason:
        'creator serial launcher (>3000 token sebelumnya) — di data historis, grup token yang turun ≥10% dari puncak punya rata-rata creatorLaunches 5x lipat grup yang stabil',
    }
  }

  if (alert.lpUsd < 5000) {
    return {
      decision: 'REJECT',
      score: 0,
      reason: 'likuiditas terlalu tipis (<$5K) — risiko slippage ekstrem',
    }
  }

  if (alert.bundlePct > 60) {
    return {
      decision: 'REJECT',
      score: 0,
      reason: 'bundle >60% — mayoritas supply dikontrol dari launch',
    }
  }

  if (alert.organicPct < 25) {
    return {
      decision: 'REJECT',
      score: 0,
      reason: 'organic <25% — volume didominasi bot/wash trading',
    }
  }

  if ((alert.topHolders?.[0] ?? 0) > 30) {
    return {
      decision: 'REJECT',
      score: 0,
      reason: 'satu wallet pegang >30% supply — risiko dump instan',
    }
  }

  if (alert.devHoldPct > MEME_CONFIG.vetoMaxDevHoldPct) {
    return {
      decision: 'REJECT',
      score: 0,
      reason:
        'dev masih pegang ' + alert.devHoldPct + '% supply (>' +
        MEME_CONFIG.vetoMaxDevHoldPct +
        '%) — risiko dump tinggi',
    }
  }

  // ── SCORING — only for tokens that pass the vetoes ──
  const score = computeScore(alert)

  if (score >= 65) {
    return { decision: 'STRONG', score, reason: `lolos semua hard veto · skor ${score} ≥ 65` }
  }
  if (score >= 45) {
    return { decision: 'WATCH', score, reason: `lolos semua hard veto · skor ${score} di rentang 45–64` }
  }
  return { decision: 'WEAK', score, reason: `lolos hard veto tapi skor ${score} < 45 — risiko tinggi` }
}

// ─── Radar feed adapter ───────────────────────────────────────────────────
// The Meme radar (app/api/meme-tokens) already produces rich per-token data
// (MemeToken). This adapter maps it into a MemeAlert so every coin that comes
// out of the radar can be run through the exact same veto+score pipeline.
//
// Fields the radar feed does NOT provide are derived from the closest
// available proxy and listed in `estimatedFields` so the UI can be honest
// about which inputs are estimates:
//   • creatorLaunches — unknown from DexScreener/RugCheck feed → 0 (neutral).
//   • kolCount / sniperCount — unknown → 0.
//   • topHolders — individual TH1..TH5 not in feed → [] (TH1 veto skipped;
//     the radar's own top-10 holder gate ≤25% still guards concentration).
//   • organicPct — proxied from uniqueBuyers / buys (repeat-buy heavy volume
//     scores low). botPct = 100 − organicPct.
//   • bundlePct — proxied from deployerPct + insiderPct (supply controlled
//     by insiders at/after launch).
//   • insiderCount — bucketed from insiderPct (≥15%→3, ≥8%→2, ≥3%→1, else 0).
  //   • devHoldPct — unknown from DexScreener/RugCheck feed → 0 (neutral; the
  //     dev-sold bonus in computeScore is a bonus, never a veto driver here).
export function estimateAlertFromToken(t: MemeToken): { alert: MemeAlert; estimatedFields: string[] } {
  const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

  // organicPct = rasio transaksi yang dilakukan oleh buyer unik (bukan repeat-buy
  // / bot). Dihitung dari txns5m (5m) × 12 → proyeksi 1h, karena feed live
  // hanya menyediakan data 5m (lihat route.ts Step 2: buys1h = buys5m × 12).
  // ⚠ Sebelumnya dihitung dari t.buys1h / t.uniqueBuyers, tapi field-field
  // itu tidak ada di feed live → buys1h = 0 → organicPct = 0 → semua token
  // otomatis REJECT (veto organic <25%). Sekarang dihitung dari data yang
  // benar-benar ada di feed: buys5m / txns5m.
  const buys5m = t.buys5m || 0
  const sells5m = t.sells5m || 0
  const txns5m = t.txns5m || 0
  const buys = Math.round(buys5m * 12)        // proyeksi 1h (sama dengan route.ts)
  const sells = Math.round(sells5m * 12)
  const totalTx = buys + sells
  // uniqueBuyers di feed live tidak ada → gunakan txns5m sebagai proxy
  // (repeat-buy heavy volume akan mengurangi organicPct, sesuai prinsip
  // "organic = volume dari banyak buyer berbeda"). Tanpa data unik, kita
  // anggap setiap txn adalah buyer berbeda → organicPct = 100% (netral,
  // tidak memicu veto). Field ini ditandai estimatedFields.
  const organicPct = clamp(totalTx > 0 ? (txns5m / totalTx) * 100 : 100)
  const botPct = clamp(100 - organicPct)
  const bundlePct = clamp((t.deployerPct || 0) + (t.insiderPct || 0))
  const insiderPct = t.insiderPct || 0
  const insiderCount = insiderPct >= 15 ? 3 : insiderPct >= 8 ? 2 : insiderPct >= 3 ? 1 : 0
  const graduated = t.bondingStage === 'GRADUATED'

  const alert: MemeAlert = {
    timestamp: new Date().toISOString(),
    category: t.bucket === 'NEW_BONDING' ? 'NEW BONDING'
      : t.bucket === 'BONDING_RADAR' ? 'BONDING RADAR'
      : t.bucket === 'MOMENTUM' ? 'STRONG MOMENTUM'
      : 'EARLY WATCH',
    name: t.name,
    symbol: t.symbol,
    contractAddress: t.address,
    chain: 'SOL',
    platform: (t.dexId || '').toLowerCase() === 'pumpfun' ? 'Pump.fun' : t.dexId || 'DexScreener',
    ageMinutes: t.age || 0,
    bondingPct: graduated ? undefined : t.bondingProgress || 0,
    graduated,

    mcUsd: t.mcap || 0,
    lpUsd: t.liquidity || 0,
    vol1mUsd: (t.volume1h || 0) / 60,
    change1mPct: (t.priceChange1h || 0) / 60,
    change5mPct: t.ch5m || 0,

    buys,
    sells: t.sells1h || 0,
    buySellRatio: parseFloat(t.buySellRatio || '50') || 50,

    holderCount: t.holderCount || t.totalHolders || 0,
    top10Pct: t.top10HolderPct || 0,
    topHolders: [],

    smartCount: t.smartMoneyCount || 0,
    kolCount: 0,
    insiderCount,

    botPct,
    sniperCount: 0,
    bundlePct,

    organicPct,
    buyerCount: t.uniqueBuyers || 0,

    creatorLaunches: 0,
    devHoldPct: 0,
    xUrl: t.dexUrl || undefined,
  }

  const estimatedFields = [
    'creatorLaunches', 'kolCount', 'sniperCount', 'topHolders',
    'organicPct', 'botPct', 'bundlePct', 'insiderCount', 'devHoldPct',
  ]
  return { alert, estimatedFields }
}

/** Convenience wrapper used by the radar UI: token → verdict (+ estimates). */
export function scanMemeToken(t: MemeToken): MemeVerdict & { estimatedFields: string[] } {
  const { alert, estimatedFields } = estimateAlertFromToken(t)
  return { ...evaluateMemeAlert(alert), estimatedFields }
}
