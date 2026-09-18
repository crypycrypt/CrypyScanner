import { NextRequest, NextResponse } from 'next/server'
// Logika bersama (harga SOL, kurva bonding pump.fun, gerbang holder RugCheck,
// aturan bucket, klasifikasi naratif) — satu sumber kebenaran dengan
// endpoint pencarian /api/meme-search. Diekstrak ke lib/meme/enrich.ts.
import {
  mapLimit,
  getSolPriceUsd,
  computeBonding,
  fetchHolderStats,
  holderCache,
  BUCKET_RULES,
  assignBucket,
  classifyNarrative,
  fetchSupplementMints,
  fetchPairsByMints,
} from '../../../lib/meme/enrich'
// Sinyal radar → Telegram (fire-and-forget, dedup permanen per address).
import { dispatchMemeRadarAlerts } from '../../../lib/meme/memeTelegramAlert'

// Server-side cache
const cache = new Map<string, { data: any; ts: number }>()
// 12 detik — sengaja LEBIH PENDEK dari interval poll dashboard (15s) supaya
// setiap poll membawa data baru (tabel update sendiri tanpa klik REFRESH).
// Aman dipangkas: sumber feed adalah proxy lokal (127.0.0.1:3001) dan data
// holder RugCheck punya cache sendiri 3 menit + dedup in-flight di
// lib/meme/enrich.ts, jadi rebuild cache tidak memukul upstream berulang.
const CACHE_DURATION = 12_000


// ─── Helper: compute AI score ───────────────────────────────────
function computeAIScore(token: any): { score: number; confidence: number; signal: string; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {}

  // Liquidity (10%)
  const liq = token.liquidity?.usd || 0
  let liqScore = 0
  if (liq > 100_000) liqScore = 10
  else if (liq > 50_000) liqScore = 7
  else if (liq > 25_000) liqScore = 5
  else if (liq > 10_000) liqScore = 3
  else liqScore = 1
  breakdown.liquidity = liqScore

  // Volume acceleration (10%)
  const vol1h = token.volume?.h1 || 0
  const vol24h = token.volume?.h24 || 0
  const volRatio = vol24h > 0 ? vol1h / (vol24h / 24) : 0
  let volScore = 0
  if (volRatio > 3) volScore = 10
  else if (volRatio > 2) volScore = 8
  else if (volRatio > 1.5) volScore = 6
  else if (volRatio > 1) volScore = 4
  else volScore = 2
  breakdown.volume_acceleration = volScore

  // Buy/sell ratio (10%)
  const buys1h = token.txns?.h1?.buys || 0
  const sells1h = token.txns?.h1?.sells || 0
  const totalTx = buys1h + sells1h
  const buyRatio = totalTx > 0 ? buys1h / totalTx : 0.5
  let bsScore = 0
  if (buyRatio > 0.7) bsScore = 10
  else if (buyRatio > 0.6) bsScore = 8
  else if (buyRatio > 0.55) bsScore = 6
  else if (buyRatio > 0.5) bsScore = 4
  else bsScore = 2
  breakdown.buy_sell_ratio = bsScore

  // Price momentum (10%)
  const priceChange1h = token.priceChange?.h1 || 0
  const priceChange24h = token.priceChange?.h24 || 0
  let momScore = 0
  if (priceChange1h > 20) momScore = 10
  else if (priceChange1h > 10) momScore = 8
  else if (priceChange1h > 5) momScore = 6
  else if (priceChange1h > 0) momScore = 4
  else momScore = 1
  breakdown.price_momentum = momScore

  // Holder growth proxy (10%) - use unique buyers as proxy
  const uniqueBuyers = token.txns?.h1?.uniqueBuys || 0
  let holderScore = 0
  if (uniqueBuyers > 100) holderScore = 10
  else if (uniqueBuyers > 50) holderScore = 8
  else if (uniqueBuyers > 20) holderScore = 6
  else if (uniqueBuyers > 5) holderScore = 4
  else holderScore = 2
  breakdown.holder_growth = holderScore

  // Smart money proxy (15%) - use buy pressure and volume
  let smartScore = 0
  if (buyRatio > 0.65 && vol1h > 50_000) smartScore = 15
  else if (buyRatio > 0.6 && vol1h > 25_000) smartScore = 12
  else if (buyRatio > 0.55 && vol1h > 10_000) smartScore = 8
  else if (buyRatio > 0.5) smartScore = 5
  else smartScore = 2
  breakdown.smart_money = smartScore

  // Narrative momentum (15%)
  const narrative = classifyNarrative(token.baseToken?.name || '', token.baseToken?.symbol || '')
  let narrScore = 0
  if (['PEPE', 'DOG', 'AI'].includes(narrative)) narrScore = 15
  else if (['CAT', 'POLITICAL', 'GAMING'].includes(narrative)) narrScore = 12
  else narrScore = 8
  breakdown.narrative_momentum = narrScore

  // Entry timing (8%)
  let timingScore = 0
  if (priceChange1h > 0 && priceChange1h < 10) timingScore = 8
  else if (priceChange1h > 10 && priceChange1h < 30) timingScore = 5
  else if (priceChange1h > 30) timingScore = 2
  else timingScore = 4
  breakdown.entry_timing = timingScore

  // Market structure (7%)
  let structScore = 0
  if (volRatio > 2 && buyRatio > 0.6) structScore = 7
  else if (volRatio > 1.5 && buyRatio > 0.55) structScore = 5
  else if (volRatio > 1) structScore = 3
  else structScore = 1
  breakdown.market_structure = structScore

  // Risk adjustment (5%)
  let riskAdj = 5
  if (liq < 25_000) riskAdj = 0
  else if (liq < 50_000) riskAdj = 2
  else if (liq < 100_000) riskAdj = 3
  breakdown.risk_adjustment = riskAdj

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  const score = Math.min(100, Math.round(total))

  // Confidence based on data richness
  const confidence = Math.min(100, Math.round(
    (total > 0 ? 70 : 30) +
    (uniqueBuyers > 0 ? 15 : 0) +
    (vol1h > 0 ? 10 : 0) +
    (liq > 0 ? 5 : 0)
  ))

  // Signal
  let signal = 'WAIT'
  if (score >= 80 && buyRatio > 0.6) signal = 'STRONG BUY'
  else if (score >= 70 && buyRatio > 0.55) signal = 'CONDITIONAL BUY'
  else if (score >= 60) signal = 'WATCH'
  else if (score >= 40) signal = 'WAIT'
  else signal = 'AVOID'

  return { score, confidence, signal, breakdown }
}

// ─── Helper: compute risk score ─────────────────────────────────
function computeRiskScore(token: any): { score: number; flags: string[]; levels: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> } {
  const flags: string[] = []
  const levels: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {}

  // Liquidity risk
  const liq = token.liquidity?.usd || 0
  if (liq < 10_000) {
    levels.liquidity = 'HIGH'
    flags.push('Low liquidity (<$10K)')
  } else if (liq < 50_000) {
    levels.liquidity = 'MEDIUM'
    flags.push('Moderate liquidity (<$50K)')
  } else {
    levels.liquidity = 'LOW'
  }

  // Holder concentration (proxy: buy/sell ratio)
  const buys1h = token.txns?.h1?.buys || 0
  const sells1h = token.txns?.h1?.sells || 0
  const totalTx = buys1h + sells1h
  const buyRatio = totalTx > 0 ? buys1h / totalTx : 0.5
  if (buyRatio < 0.3) {
    levels.holder = 'HIGH'
    flags.push('Heavy sell pressure')
  } else if (buyRatio < 0.45) {
    levels.holder = 'MEDIUM'
  } else {
    levels.holder = 'LOW'
  }

  // Deployer risk (proxy: very new token with high volatility)
  const priceChange1h = token.priceChange?.h1 || 0
  if (Math.abs(priceChange1h) > 50) {
    levels.deployer = 'HIGH'
    flags.push('Extreme volatility (>50% in 1h)')
  } else if (Math.abs(priceChange1h) > 25) {
    levels.deployer = 'MEDIUM'
  } else {
    levels.deployer = 'LOW'
  }

  // Exit risk
  const sellsVsBuys = sells1h > 0 ? sells1h / Math.max(buys1h, 1) : 0
  if (sellsVsBuys > 2) {
    levels.exit = 'HIGH'
    flags.push('Exit cluster detected')
  } else if (sellsVsBuys > 1) {
    levels.exit = 'MEDIUM'
  } else {
    levels.exit = 'LOW'
  }

  // Cluster risk (proxy: high volume with low unique buyers = bot activity)
  const uniqueBuyers = token.txns?.h1?.uniqueBuys || 0
  if (totalTx > 0 && uniqueBuyers / totalTx < 0.3) {
    levels.cluster = 'HIGH'
    flags.push('Possible bot/bundled activity')
  } else if (totalTx > 0 && uniqueBuyers / totalTx < 0.5) {
    levels.cluster = 'MEDIUM'
  } else {
    levels.cluster = 'LOW'
  }

  // Calculate overall risk score (0 = lowest, 100 = extreme)
  let score = 0
  if (levels.liquidity === 'HIGH') score += 35
  else if (levels.liquidity === 'MEDIUM') score += 15
  if (levels.holder === 'HIGH') score += 25
  else if (levels.holder === 'MEDIUM') score += 10
  if (levels.deployer === 'HIGH') score += 20
  else if (levels.deployer === 'MEDIUM') score += 8
  if (levels.exit === 'HIGH') score += 15
  else if (levels.exit === 'MEDIUM') score += 7
  if (levels.cluster === 'HIGH') score += 10
  else if (levels.cluster === 'MEDIUM') score += 5

  score = Math.min(100, score)

  return { score, flags, levels }
}

// ─── Helper: compute entry timing ─────────────────────────────────
function computeEntryTiming(token: any): { quality: number; phase: 'EARLY' | 'CURRENT' | 'LATE'; reasons: string[] } {
  const reasons: string[] = []
  const priceChange1h = token.priceChange?.h1 || 0
  const priceChange24h = token.priceChange?.h24 || 0
  const buyRatio = (token.txns?.h1?.buys || 0) / Math.max((token.txns?.h1?.buys || 0) + (token.txns?.h1?.sells || 0), 1)

  let quality = 50
  let phase: 'EARLY' | 'CURRENT' | 'LATE' = 'CURRENT'

  if (priceChange1h < 5 && buyRatio > 0.6) {
    phase = 'EARLY'
    quality = 85
    reasons.push('Smart money still accumulating')
    reasons.push('Low price movement vs volume')
  } else if (priceChange1h < 15 && buyRatio > 0.55) {
    phase = 'CURRENT'
    quality = 70
    reasons.push('Active accumulation phase')
    reasons.push('Buy pressure increasing')
  } else if (priceChange1h > 30) {
    phase = 'LATE'
    quality = 30
    reasons.push('Price already moved significantly')
    reasons.push('Late entry risk')
  } else {
    phase = 'CURRENT'
    quality = 55
    reasons.push('Moderate entry window')
  }

  if (priceChange24h > 100) {
    quality = Math.max(20, quality - 20)
    reasons.push('Already up significantly in 24h')
  }

  return { quality, phase, reasons }
}

// ─── Helper: compute exit pressure ──────────────────────────────
function computeExitPressure(token: any): { pressure: number; level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; reasons: string[] } {
  const reasons: string[] = []
  const sells1h = token.txns?.h1?.sells || 0
  const buys1h = token.txns?.h1?.buys || 0
  const totalTx = buys1h + sells1h
  const sellRatio = totalTx > 0 ? sells1h / totalTx : 0
  const priceChange1h = token.priceChange?.h1 || 0

  let pressure = 0
  if (sellRatio > 0.6) {
    pressure += 40
    reasons.push('High sell ratio')
  } else if (sellRatio > 0.5) {
    pressure += 20
    reasons.push('Sell pressure building')
  }

  if (priceChange1h < -10) {
    pressure += 25
    reasons.push('Price declining')
  } else if (priceChange1h < 0) {
    pressure += 10
    reasons.push('Price flat/down')
  }

  if (sells1h > 50) {
    pressure += 15
    reasons.push('High sell volume')
  }

  pressure = Math.min(100, pressure)

  let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  if (pressure >= 70) level = 'CRITICAL'
  else if (pressure >= 50) level = 'HIGH'
  else if (pressure >= 30) level = 'MEDIUM'
  else level = 'LOW'

  return { pressure, level, reasons }
}

// ─── Main API handler ───────────────────────────────────────────
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const chain = sp.get('chain') || 'solana'
  const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 100)
  // Pagination — default page 1, 50 per halaman (max 200). Tabel radar bisa
  // melebihi 100 token dari feed live + suplemen DexScreener; tanpa pagination
  // listnya tidak terbatas dan membebani render. `page` dan `pageSize`
  // overrides `limit` backward-compatible: masih menerima `limit` tanpa page
  // (semua token). Cap 200 (bukan 100) supaya query sniper — yang meminta
  // pageSize=200 karena butuh SELURUH feed tanpa pagination — benar-benar
  // menerima semua token hasil merge proxy + suplemen.
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
  const pageSize = Math.min(parseInt(sp.get('pageSize') || String(limit), 10), 200)
  const sortBy = sp.get('sort') || 'ai_score'
  const narrative = sp.get('narrative') || 'all'
  const minLiquidity = parseInt(sp.get('min_liq') || '10000', 10)
  const bucketFilter = sp.get('bucket') || 'all' // all | NEW_BONDING | BONDING_RADAR | MOMENTUM | NONE
  const forceRefresh = sp.get('refresh') === '1'

  const cacheKey = `meme-${chain}-${limit}-${sortBy}-${narrative}-${minLiquidity}-${bucketFilter}-${page}-${pageSize}`
  const cached = cache.get(cacheKey)
  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_DURATION) {
    return NextResponse.json({ ok: true, cached: true, ...cached.data })
  }

  try {
    // Step 1: Fetch live meme token feed from local proxy (same source as dex-forensics)
    const proxyRes = await fetch('http://127.0.0.1:3001/api/dex-feed/live', {
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 0 },
    })
    if (!proxyRes.ok) throw new Error(`Proxy feed returned ${proxyRes.status}`)
    const proxyData = await proxyRes.json()
    if (!proxyData.ok || !Array.isArray(proxyData.tokens)) {
      throw new Error('Invalid proxy feed response')
    }

    // Harga SOL dibutuhkan untuk mengkonversi mcap USD → posisi di kurva
    // bonding pump.fun (lihat computeBonding). Di-cache 5 menit.
    const solUsd = await getSolPriceUsd()

    // Step 2: Transform proxy tokens to match API contract
    const base = proxyData.tokens.map((t: any) => {
      const buys1h = Math.round((t.buys5m || 0) * 12)
      const sells1h = Math.round((t.sells5m || 0) * 12)
      const totalTx = buys1h + sells1h
      const buyRatio = totalTx > 0 ? buys1h / totalTx : 0.5
      const liq = parseFloat(t.liq || 0)
      const vol1h = parseFloat(t.vol1h || 0)
      const vol24h = vol1h * 24 // approximation from 1h volume
      const ch1h = parseFloat(t.ch1h || 0)
      const ch24h = parseFloat(t.ch24h || 0)
      // Field live yang sebelumnya DIBUANG oleh transform lama — sekarang
      // diteruskan apa adanya (tidak ada angka yang dikarang):
      const mcap = parseFloat(t.mcap || 0)
      const dexId = String(t.dexId || '')
      const vol5m = parseFloat(t.vol5m || 0)
      const ch5m = parseFloat(t.ch5m || 0)
      const txns5m = Number(t.txns5m || 0)
      const bonding = computeBonding(mcap, solUsd, dexId)

      // Simple AI score from proxy apeScore
      const aiScore = Math.min(100, Math.round((t.apeScore || 0) * 10))
      const aiConfidence = Math.min(100, Math.round(
        (t.apeScore > 0 ? 70 : 30) +
        (totalTx > 0 ? 15 : 0) +
        (vol1h > 0 ? 10 : 0) +
        (liq > 0 ? 5 : 0)
      ))
      let aiSignal = 'WAIT'
      if (aiScore >= 80 && buyRatio > 0.6) aiSignal = 'STRONG BUY'
      else if (aiScore >= 70 && buyRatio > 0.55) aiSignal = 'CONDITIONAL BUY'
      else if (aiScore >= 60) aiSignal = 'WATCH'
      else if (aiScore >= 40) aiSignal = 'WAIT'
      else aiSignal = 'AVOID'

      // Simple risk score
      let riskScore = 0
      if (liq < 10_000) riskScore += 35
      else if (liq < 50_000) riskScore += 15
      if (buyRatio < 0.3) riskScore += 25
      else if (buyRatio < 0.45) riskScore += 10
      if (Math.abs(ch1h) > 50) riskScore += 20
      else if (Math.abs(ch1h) > 25) riskScore += 8
      if (sells1h > 0 && sells1h / Math.max(buys1h, 1) > 2) riskScore += 15
      else if (sells1h > 0 && sells1h / Math.max(buys1h, 1) > 1) riskScore += 7
      riskScore = Math.min(100, riskScore)

      const narr = classifyNarrative(t.name || '', t.symbol || '')

      // Entry phase/quality kini diturunkan dari posisi kurva bonding +
      // aktivitas nyata (sebelumnya konstanta 50/'CURRENT' untuk semua token).
      const entryPhase: 'EARLY' | 'CURRENT' | 'LATE' =
        bonding.stage === 'BONDING' && bonding.progress < 35 ? 'EARLY'
        : bonding.stage === 'BONDING' || (t.ageHours || 0) < 24 ? 'CURRENT'
        : 'LATE'
      const entryQuality = Math.max(0, Math.min(100, Math.round(
        aiScore * 0.4 + (100 - riskScore) * 0.3 + buyRatio * 100 * 0.2 + Math.min(100, txns5m * 2) * 0.1
      )))
      const entryReasons: string[] = []
      if (bonding.stage === 'BONDING') entryReasons.push(`Kurva bonding ${bonding.progress.toFixed(0)}% (${bonding.raisedSol.toFixed(1)}/85 SOL)`)
      else if (bonding.stage === 'GRADUATED') entryReasons.push(`Sudah graduate — diperdagangkan di ${dexId || 'DEX'}`)
      if (buyRatio > 0.55) entryReasons.push(`Buy pressure ${(buyRatio * 100).toFixed(0)}% (proyeksi 1h dari 5m)`)
      if (vol5m >= BUCKET_RULES.momentum.minVol5mUsd) entryReasons.push(`Vol 5m $${Math.round(vol5m)} · ${txns5m} txns — ada gerak`)
      if (entryReasons.length === 0) entryReasons.push('Live feed data')

      return {
        address: t.address || '',
        symbol: t.symbol || '???',
        name: t.name || 'Unknown',
        price: parseFloat(t.price || 0),
        priceChange1h: ch1h,
        priceChange24h: ch24h,
        // Feed tidak menyediakan jendela 7d; pakai ch24h apa adanya daripada
        // mengarang ch24h×7 (angka fabrikasi = melanggar prinsip data-verified).
        priceChange7d: ch24h,
        liquidity: liq,
        liquidityChange1h: 0,
        volume1h: vol1h,
        volume24h: vol24h,
        volumeAcceleration: vol24h > 0 ? vol1h / (vol24h / 24) : 0,
        buys1h,
        sells1h,
        buySellRatio: totalTx > 0 ? (buys1h / totalTx * 100).toFixed(1) : '50.0',
        uniqueBuyers: t.buys5m || 0,
        uniqueSellers: t.sells5m || 0,
        smartMoneyInflow: 0, // tidak ada sumber data wallet-tracking di feed ini
        smartMoneyCount: 0,
        sniperActivity: buys1h > 20 ? 'HIGH' : buys1h > 5 ? 'MEDIUM' : 'LOW',
        earlyBuyerQuality: 0,
        narrative: narr,
        narrativeMomentum: 0,
        aiScore,
        aiConfidence,
        aiSignal,
        // Breakdown nyata dari input yang tersedia (bukan {} kosong):
        aiBreakdown: {
          ape_score_x10: aiScore,
          buy_ratio_pct: Math.round(buyRatio * 100),
          vol5m_usd: Math.round(vol5m),
          txns5m,
          liq_usd: Math.round(liq),
          ch1h_pct: Math.round(ch1h),
        },
        riskScore,
        riskFlags: riskScore >= 70 ? ['High risk'] : [],
        riskLevels: {
          liquidity: liq < 10_000 ? 'HIGH' : liq < 50_000 ? 'MEDIUM' : 'LOW',
          holder: buyRatio < 0.3 ? 'HIGH' : buyRatio < 0.45 ? 'MEDIUM' : 'LOW',
          deployer: Math.abs(ch1h) > 50 ? 'HIGH' : Math.abs(ch1h) > 25 ? 'MEDIUM' : 'LOW',
          exit: sells1h > 0 && sells1h / Math.max(buys1h, 1) > 2 ? 'HIGH' : sells1h > 0 && sells1h / Math.max(buys1h, 1) > 1 ? 'MEDIUM' : 'LOW',
          cluster: 'LOW',
        },
        entryQuality,
        entryPhase,
        entryReasons,
        exitPressure: sells1h > 0 ? Math.min(100, Math.round(sells1h / Math.max(buys1h, 1) * 20)) : 0,
        exitLevel: sells1h > 0 && sells1h / Math.max(buys1h, 1) > 2 ? 'HIGH' : 'LOW',
        exitReasons: [],
        dexUrl: t.dexUrl || '',
        pairAddress: t.pairAddress || '',
        createdAt: new Date().toISOString(),
        age: Math.round((t.ageHours || 0) * 60),
        source: 'proxy-feed',
        freshness: 'LIVE',
        // Pass-through data live:
        mcap,
        dexId,
        phase: String(t.phase || ''),
        logoUrl: String(t.logoUrl || ''),
        vol5m,
        ch5m,
        txns5m,
        ageFmt: String(t.ageFmt || ''),
        isBoosted: Boolean(t.isBoosted),
        // Kurva bonding (deterministik dari mcap + harga SOL):
        bondingProgress: bonding.progress,
        bondingRaisedSol: bonding.raisedSol,
        bondingStage: bonding.stage,
        solPriceUsd: solUsd,
      }
    })

    // Step 2a: SUPLEMEN feed dari daftar publik DexScreener (token-profiles +
    // token-boosts latest/top). Proxy lokal hard-cap ±30 token dan tidak
    // menerima param limit, sehingga setelah dedup + filter min_liq radar
    // sering tinggal ±14 baris dan pagination tidak pernah muncul. Suplemen
    // menambah mint Solana BARU yang belum ada di feed proxy; fail-soft —
    // jika daftar DexScreener mati, radar tetap jalan dengan feed proxy.
    let supplementTokens: any[] = []
    try {
      const baseMints = new Set(base.map((t: any) => t.address).filter(Boolean))
      const supMints = (await fetchSupplementMints()).filter((m: string) => !baseMints.has(m))
      supplementTokens = await fetchPairsByMints(supMints, solUsd)
    } catch (e: any) {
      console.error('/api/meme-tokens supplement error:', e?.message ?? e)
    }
    const merged = [...base, ...supplementTokens]

    // Step 2b: dedup per mint. Feed proxy dapat mengirim beberapa pair untuk
    // token yang sama (teramati live: POLLY di raydium liq $78k & meteora
    // liq $31k — mint identik). Tanpa dedup: coin sama tampil dua kali di
    // radar (peringatan React duplicate-key), bucketCounts/holderCoverage
    // terhitung ganda, dan RugCheck dipanggil berulang untuk mint yang sama.
    // Aturan: pair dengan likuiditas tertinggi dipertahankan — identik
    // dengan aturan di /api/meme-search. Berlaku untuk feed proxy + suplemen.
    const byMint = new Map<string, any>()
    for (const tk of merged) {
      const prev = byMint.get(tk.address)
      if (!prev || (tk.liquidity || 0) > (prev.liquidity || 0)) byMint.set(tk.address, tk)
    }
    const deduped = [...byMint.values()]

    // pumpFunVolume dihitung dari SEMUA pair pump.fun di feed (sebelum dedup
    // lintas-dex), lalu didedup per mint di dalam subset-nya: token yang sudah
    // graduate bisa punya pair raydium/meteora berlikuiditas lebih tinggi,
    // tapi volume kurva pump.fun-nya tetap nyata dan harus terhitung.
    const pumpByMint = new Map<string, any>()
    for (const tk of merged) {
      if (tk.dexId !== 'pumpfun') continue
      const prev = pumpByMint.get(tk.address)
      if (!prev || (tk.liquidity || 0) > (prev.liquidity || 0)) pumpByMint.set(tk.address, tk)
    }
    const pumpTokens = [...pumpByMint.values()]

    // Step 3: enrichment RugCheck — data holder NYATA per mint (pengganti
    // topHolderConcentration/holderCount/deployerExposure yang dulu 0 hardcoded).
    // Konkurensi dibatasi 6 request paralel; hasil di-cache 3 menit per mint
    // sehingga refresh UI 30 detik tidak membanjiri API publik.
    // CAP: dengan suplemen DexScreener, deduped bisa mencapai ±120 mint.
    // Hanya ENRICH_MAX token pertama (urutan feed proxy dulu, lalu suplemen)
    // yang ditarik data holder-nya; sisanya tetap tampil dengan holderGate
    // UNKNOWN (pola sama dengan /api/meme-search) supaya rebuild cache tetap
    // cepat dan RugCheck tidak dibanjiri.
    const ENRICH_MAX = 80
    const enrichable = new Set(deduped.slice(0, ENRICH_MAX).map((t: any) => t.address))
    const enriched = await mapLimit(deduped, 6, async (tk: any) => {
      const stats = enrichable.has(tk.address) ? await fetchHolderStats(tk.address) : null
      const cachedAt = holderCache.get(tk.address)?.ts
      const holderDataAge = cachedAt ? Math.round((Date.now() - cachedAt) / 1000) : -1
      const holderGate: 'PASS' | 'FAIL' | 'UNKNOWN' = stats
        ? (stats.top10HolderPct > BUCKET_RULES.maxTop10Pct ? 'FAIL' : 'PASS')
        : 'UNKNOWN'

      // Penalti risiko dari fakta holder (bukan tebakan):
      let riskScore = tk.riskScore
      const riskFlags: string[] = [...tk.riskFlags]
      if (stats) {
        if (holderGate === 'FAIL') { riskScore += 20; riskFlags.push(`Top-10 holder ${stats.top10HolderPct.toFixed(1)}% > ${BUCKET_RULES.maxTop10Pct}%`) }
        if (tk.bondingStage === 'GRADUATED' && stats.lpLockedPct < 90) { riskScore += 10; riskFlags.push(`LP terkunci hanya ${stats.lpLockedPct.toFixed(0)}%`) }
        if (stats.rugged) { riskScore += 40; riskFlags.push('Ditandai RUGGED oleh RugCheck') }
        if (stats.insiderPct > 5) { riskScore += 10; riskFlags.push(`Insider ${stats.insiderPct.toFixed(1)}% di top-10`) }
      }
      riskScore = Math.min(100, riskScore)

      const { bucket, reason } = assignBucket({
        mcap: tk.mcap,
        bondingProgress: tk.bondingProgress,
        bondingStage: tk.bondingStage,
        vol5m: tk.vol5m,
        txns5m: tk.txns5m,
        top10HolderPct: stats ? stats.top10HolderPct : 0,
        holderGate,
      })

      return {
        ...tk,
        riskScore,
        riskFlags,
        riskLevels: {
          ...tk.riskLevels,
          holder: stats
            ? (stats.top10HolderPct > BUCKET_RULES.maxTop10Pct ? 'HIGH' : stats.top10HolderPct > 15 ? 'MEDIUM' : 'LOW')
            : tk.riskLevels.holder,
        },
        holderCount: stats?.totalHolders ?? 0,
        topHolderConcentration: stats?.top10HolderPct ?? 0,
        deployerExposure: stats?.deployerPct ?? 0,
        top10RawPct: stats?.top10RawPct ?? 0,
        top10HolderPct: stats?.top10HolderPct ?? 0,
        totalHolders: stats?.totalHolders ?? 0,
        lpLockedPct: stats?.lpLockedPct ?? 0,
        deployerPct: stats?.deployerPct ?? 0,
        insiderPct: stats?.insiderPct ?? 0,
        rugScore: stats?.rugScore ?? 0,
        rugRisks: stats?.rugRisks ?? [],
        rugged: stats?.rugged ?? false,
        holderGate,
        holderDataAge,
        bucket,
        bucketReason: reason,
      }
    })

    // ── Sinyal radar → Telegram (fire-and-forget, dedup persisten) ──────────
    // `enriched` = SEMESTA token radar lengkap (sebelum filter naratif/bucket/
    // pagination), jadi alert tidak bergantung pada filter yang sedang dipakai
    // user. dispatchMemeRadarAlerts menyaring sinyal kuat, melewati yang sudah
    // pernah dikirim (store .data/meme-telegram-sent.json), dan tidak pernah
    // melempar error / memblokir respons. No-op tanpa TELEGRAM_BOT_TOKEN.
    void dispatchMemeRadarAlerts(enriched)

    // Filter likuiditas minimum — DILEWATI ketika bucket spesifik dipilih:
    // token yang masih di kurva bonding secara alami likuiditasnya < $10k
    // (27.96–85 SOL ≈ $2.9k–$8.8k), jadi min_liq $10k akan menghapus seluruh
    // kandidat NEW_BONDING/BONDING_RADAR. Aturan bucket + gerbang holder 25%
    // sudah menjadi penyaringnya.
    const liqFiltered = bucketFilter !== 'all'
      ? enriched
      : enriched.filter((t: any) => t.liquidity >= minLiquidity)

    // Filter by bucket if specified
    const bucketFiltered = bucketFilter !== 'all'
      ? liqFiltered.filter((t: any) => t.bucket === bucketFilter)
      : liqFiltered

    // Filter by narrative if specified
    const narrativeFiltered = narrative !== 'all'
      ? bucketFiltered.filter((t: any) => t.narrative === narrative)
      : bucketFiltered

    // Apply sorting
    const sorted = [...narrativeFiltered].sort((a, b) => {
      switch (sortBy) {
        case 'ai_score': return b.aiScore - a.aiScore
        case 'risk_score': return a.riskScore - b.riskScore
        case 'volume': return b.volume24h - a.volume24h
        case 'liquidity': return b.liquidity - a.liquidity
        case 'price_change': return b.priceChange1h - a.priceChange1h
        case 'newest': return a.age - b.age
        case 'exit_pressure': return b.exitPressure - a.exitPressure
        case 'buy_pressure': return parseFloat(b.buySellRatio) - parseFloat(a.buySellRatio)
        case 'mcap': return b.mcap - a.mcap
        case 'progress': return b.bondingProgress - a.bondingProgress
        case 'top10': return a.top10HolderPct - b.top10HolderPct // paling aman dulu
        default: return b.aiScore - a.aiScore
      }
    })

    // Jumlah per bucket dihitung dari SELURUH feed (sebelum filter naratif/
    // likuiditas) supaya chip filter di UI menampilkan angka yang jujur.
    const bucketCounts: Record<string, number> = { NEW_BONDING: 0, BONDING_RADAR: 0, MOMENTUM: 0, NONE: 0 }
    enriched.forEach((t: any) => { bucketCounts[t.bucket] = (bucketCounts[t.bucket] || 0) + 1 })
    const holderCoverage = enriched.filter((t: any) => t.holderGate !== 'UNKNOWN').length

    // Volume agregat token yang MASIH diperdagangkan di kurva bonding pump.fun
    // (dexId === 'pumpfun'). Dihitung deterministik dari feed live (bukan angka
    // karangan), dedup per mint di Step 2b, untuk memberi gambaran seberapa
    // besar aktivitas trading pump.fun saat ini.
    const pumpFunVolume = {
      tokens: pumpTokens.length,
      vol5m: Math.round(pumpTokens.reduce((s: number, t: any) => s + (t.vol5m || 0), 0)),
      vol24h: Math.round(pumpTokens.reduce((s: number, t: any) => s + (t.volume24h || 0), 0)),
      txns5m: pumpTokens.reduce((s: number, t: any) => s + (t.txns5m || 0), 0),
    }

    // Pagination: split sorted list per halaman. `total` = seluruh token yang lolos
    // filter (bukan yang dikirim), jadi client tahu berapa halaman ada.
    const total = sorted.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    const result = {
      tokens: sorted.slice(start, start + pageSize),
      page: safePage,
      pageSize,
      total,
      totalPages,
      chain,
      sortBy,
      narrative,
      bucket: bucketFilter,
      bucketCounts,
      solPriceUsd: solUsd,
      holderGateMaxPct: BUCKET_RULES.maxTop10Pct,
      holderCoverage,
      // Transparansi sumber: berapa token dari proxy live vs suplemen daftar
      // publik DexScreener (profiles/boosts) setelah dedup per mint.
      sourceCounts: {
        proxyFeed: deduped.filter((t: any) => t.source === 'proxy-feed').length,
        dexscreenerSupplement: deduped.filter((t: any) => t.source === 'dexscreener-supplement').length,
      },
      pumpFunVolume,
      fetchedAt: new Date().toISOString(),
      cgTokens: [],
    }

    cache.set(cacheKey, { data: result, ts: Date.now() })

    return NextResponse.json({ ok: true, cached: false, ...result })
  } catch (error: any) {
    console.error('/api/meme-tokens error:', error?.message ?? error)
    if (cached) return NextResponse.json({ ok: true, cached: true, stale: true, ...cached.data })
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch meme token data' },
      { status: 500 }
    )
  }
}
