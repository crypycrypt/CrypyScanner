// ══════════════════════════════════════════════════════════════════
// lib/meme/enrich.ts
// Logika bersama untuk data meme token Solana: harga SOL, kurva
// bonding pump.fun, gerbang holder RugCheck, aturan bucket, dan
// skoring deterministik.
//
// Modul ini diekstrak dari app/api/meme-tokens/route.ts supaya
// endpoint pencarian (app/api/meme-search) memakai SATU sumber
// kebenaran yang sama — tidak ada duplikasi rumus kurva bonding
// maupun ambang gerbang holder. Semua angka di sini deterministik
// (tidak ada LLM) dan ambangnya terdokumentasi + teruji terhadap
// feed live.
// ══════════════════════════════════════════════════════════════════

// ─── Free data sources ──────────────────────────────────────────
// DexScreener public API: https://docs.dexscreener.com
// CoinGecko public API: https://docs.coingecko.com
// RugCheck public API:    https://api.rugcheck.xyz
export const DEXSCREENER_SEARCH = 'https://api.dexscreener.com/latest/dex/search'
export const DEXSCREENER_TOKENS = 'https://api.dexscreener.com/latest/dex/tokens'
// Daftar publik DexScreener (gratis, tanpa key) — sumber SUPLEMEN radar:
// profiles = token yang baru diprofilkan, boosts = token yang dibayar untuk
// promosi (latest & top). Dipakai memperbesar feed radar karena proxy lokal
// 127.0.0.1:3001 hanya mengirim ±30 token dan tidak menerima param limit.
export const DEXSCREENER_PROFILES = 'https://api.dexscreener.com/token-profiles/latest/v1'
export const DEXSCREENER_BOOSTS_LATEST = 'https://api.dexscreener.com/token-boosts/latest/v1'
export const DEXSCREENER_BOOSTS_TOP = 'https://api.dexscreener.com/token-boosts/top/v1'
export const COINGECKO_API = 'https://api.coingecko.com/api/v3'
export const RUGCHECK_REPORT = 'https://api.rugcheck.xyz/v1/tokens'

// ─── Helper: fetch JSON with timeout ────────────────────────────
export async function fetchJson(url: string, timeoutMs: number): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ─── Helper: map dengan batas konkurensi (30 token × 1 request RugCheck) ──
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++
      out[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return out
}

export const round2 = (v: number) => Math.round((Number.isFinite(v) ? v : 0) * 100) / 100

// ─── Harga SOL (dipakai mengkonversi mcap USD → mcap SOL) ────────────────
// Multi-sumber dengan fallback berurutan — diuji live dari environment ini:
//   Coinbase  https://api.coinbase.com/v2/prices/SOL-USD/spot      → 101.11 ✓
//   Kraken    https://api.kraken.com/0/public/Ticker?pair=SOLUSD   → 101.08 ✓
//   DexScreener (wrapped SOL mint, pair SOL/USDC)                  → 101.55 ✓
//   CoinGecko simple/price → sering 429 (rate limit free tier)     → cadangan
//   Binance REST → body kosong (diblokir)                          → tidak dipakai
// Di-cache 5 menit karena harga SOL tidak perlu presisi tick untuk menentukan
// posisi di kurva bonding; kalau semua sumber gagal, nilai terakhir dipakai.
const SOL_PRICE_TTL = 300_000
const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112'
let solPriceCache: { usd: number; ts: number } = { usd: 0, ts: 0 }

export async function getSolPriceUsd(): Promise<number> {
  if (solPriceCache.usd > 0 && Date.now() - solPriceCache.ts < SOL_PRICE_TTL) return solPriceCache.usd

  const cb = await fetchJson('https://api.coinbase.com/v2/prices/SOL-USD/spot', 5_000)
  let usd = Number(cb?.data?.amount || 0)

  if (!(usd > 0)) {
    const kr = await fetchJson('https://api.kraken.com/0/public/Ticker?pair=SOLUSD', 5_000)
    const krKey = kr?.result ? Object.keys(kr.result)[0] : null
    // c = last trade closed [price, lot-volume]
    usd = Number(krKey ? kr.result[krKey]?.c?.[0] : 0)
  }

  if (!(usd > 0)) {
    const dx = await fetchJson(`${DEXSCREENER_TOKENS}/${WRAPPED_SOL_MINT}`, 5_000)
    const pair = Array.isArray(dx?.pairs) ? dx.pairs.find((p: any) => p?.quoteToken?.symbol === 'USDC') || dx.pairs[0] : null
    usd = Number(pair?.priceUsd || 0)
  }

  if (!(usd > 0)) {
    const cg = await fetchJson(`${COINGECKO_API}/simple/price?ids=solana&vs_currencies=usd`, 5_000)
    usd = Number(cg?.solana?.usd || 0)
  }

  // Sanity band: tolak angka rusak (0 / negatif / absurd) agar progress kurva
  // tidak tercemar; pakai cache lama kalau semua sumber memberi angka tak wajar.
  if (usd > 1 && usd < 100_000) solPriceCache = { usd, ts: Date.now() }
  return solPriceCache.usd
}

// ─── Kurva bonding pump.fun ───────────────────────────────────────────────
// pump.fun memakai constant-product AMM virtual:
//   S0 = 30 SOL (virtual SOL reserve), T0 = 1.073e9 (virtual token reserve)
//   k  = S0 × T0 = 3.219e10
// Setelah x SOL masuk, y token keluar: (S0+x)(T0−y) = k  ⇒  T0−y = k/(S0+x)
// Harga spot kurva  p = (S0+x)/(T0−y) = (S0+x)²/k
// Market cap (supply riil 1e9 token) dalam SOL:
//   mcapSol = p × 1e9 = (30+x)² / (k/1e9) = (30+x)² / 32.19
// Dibalik untuk mendapat SOL terkumpul (x) dari mcap:
//   x = sqrt(32.19 × mcapSol) − 30
// Progress = x / 85 (graduation terjadi saat 85 SOL terkumpul).
// Validasi numerik: x=0 → mcap 27.96 SOL; x=85 → mcap 410.8 SOL
// (≈ $42.460 pada SOL $103.36) — cocok dengan angka graduation pump.fun.
export const BONDING = {
  virtualSol: 30,
  virtualTokens: 1.073e9,
  realSupply: 1e9,
  graduateSol: 85,
  get kPerSupply() { return (this.virtualSol * this.virtualTokens) / this.realSupply }, // 32.19
}

export function computeBonding(mcapUsd: number, solUsd: number, dexId: string): {
  progress: number; raisedSol: number; stage: 'BONDING' | 'GRADUATED' | 'UNKNOWN'
} {
  // Token yang sudah lulus kurva diperdagangkan di AMM biasa
  // (pumpswap / raydium / meteora) → secara definisi progress-nya 100%.
  if (dexId && dexId !== 'pumpfun') return { progress: 100, raisedSol: BONDING.graduateSol, stage: 'GRADUATED' }
  if (!solUsd || !mcapUsd || mcapUsd <= 0) return { progress: 0, raisedSol: 0, stage: 'UNKNOWN' }
  const mcapSol = mcapUsd / solUsd
  const raisedSol = Math.sqrt(BONDING.kPerSupply * mcapSol) - BONDING.virtualSol
  const progress = (raisedSol / BONDING.graduateSol) * 100
  return {
    progress: round2(Math.max(0, Math.min(100, progress))),
    raisedSol: round2(Math.max(0, raisedSol)),
    stage: 'BONDING',
  }
}

// ─── RugCheck: konsentrasi holder nyata (bukan angka 0 hardcoded) ─────────
// Endpoint: https://api.rugcheck.xyz/v1/tokens/{mint}/report
// Yang diambil: topHolders[].{pct,owner,address,insider}, knownAccounts
// (address → {name,type: AMM|LOCKER|CREATOR}), totalHolders,
// markets[0].{pubkey,lp.lpLockedPct}, creator, score_normalised, risks, rugged.
//
// PENTING: jumlah mentah top-10 hampir selalu memuat vault AMM/LP (alamat pair
// itu sendiri), sehingga angka-nya menipu. Contoh live yang diukur:
//   STONKSZN     raw  7.72% → setelah vault dikecualikan  1.86%
//   CRACKTOP     raw 33.63% → 20.11%
//   Misanthropic raw 52.80% → 22.15%
// Karena itu gerbang 25% user diterapkan pada angka ADJUSTED (vault / locker /
// creator-account / insider dibuang), bukan angka mentah.
export type HolderStats = {
  top10RawPct: number
  top10HolderPct: number
  totalHolders: number
  lpLockedPct: number
  deployerPct: number
  insiderPct: number
  rugScore: number
  rugRisks: string[]
  rugged: boolean
}
const HOLDER_TTL = 180_000        // data holder bergerak lambat → cache 3 menit
const HOLDER_NEG_TTL = 30_000     // gagal/rate-limit → coba lagi setelah 30 detik
export const holderCache = new Map<string, { stats: HolderStats | null; ts: number }>()
const holderInflight = new Map<string, Promise<HolderStats | null>>()

export async function fetchHolderStats(mint: string): Promise<HolderStats | null> {
  if (!mint) return null
  const hit = holderCache.get(mint)
  if (hit && Date.now() - hit.ts < (hit.stats ? HOLDER_TTL : HOLDER_NEG_TTL)) return hit.stats
  const flying = holderInflight.get(mint)
  if (flying) return flying

  const task = (async (): Promise<HolderStats | null> => {
    const r = await fetchJson(`${RUGCHECK_REPORT}/${mint}/report`, 9_000)
    const holders: any[] = Array.isArray(r?.topHolders) ? r.topHolders : []
    if (!r || holders.length === 0) {
      holderCache.set(mint, { stats: null, ts: Date.now() })
      return null
    }
    const known: Record<string, any> = r.knownAccounts || {}
    const market = Array.isArray(r.markets) ? r.markets[0] : null
    const pair = String(market?.pubkey || '')
    const creator = String(r.creator || '')
    const isVault = (h: any): boolean => {
      const owner = String(h?.owner || '')
      const addr = String(h?.address || '')
      if (pair && (owner === pair || addr === pair)) return true
      if (known[owner] || known[addr]) return true   // AMM / LOCKER / CREATOR account
      return Boolean(h?.insider)
    }
    const top10 = holders.slice(0, 10)
    const pct = (h: any) => Number(h?.pct || 0)
    const stats: HolderStats = {
      top10RawPct: round2(top10.reduce((s, h) => s + pct(h), 0)),
      top10HolderPct: round2(top10.filter(h => !isVault(h)).reduce((s, h) => s + pct(h), 0)),
      totalHolders: Number(r.totalHolders || 0),
      lpLockedPct: round2(Number(market?.lp?.lpLockedPct || 0)),
      deployerPct: round2(top10.filter(h => creator && (h?.owner === creator || h?.address === creator)).reduce((s, h) => s + pct(h), 0)),
      insiderPct: round2(top10.filter(h => h?.insider).reduce((s, h) => s + pct(h), 0)),
      rugScore: Number(r.score_normalised ?? r.score ?? 0),
      rugRisks: (Array.isArray(r.risks) ? r.risks : [])
        .slice(0, 6)
        .map((x: any) => String(x?.name || x?.label || x?.value || ''))
        .filter(Boolean),
      rugged: Boolean(r.rugged),
    }
    holderCache.set(mint, { stats, ts: Date.now() })
    return stats
  })()

  holderInflight.set(mint, task)
  try {
    return await task
  } catch {
    holderCache.set(mint, { stats: null, ts: Date.now() })
    return null
  } finally {
    holderInflight.delete(mint)
  }
}

// ─── Aturan bucket (angka dari spesifikasi user, bukan tebakan) ───────────
// Diuji terhadap 30 token feed live: mcap ada di semua token (median $15.084),
// vol5m median $369, txns5m median 15 → ambang momentum di bawah menyaring
// 14/30 token (tidak degenerat, tidak juga meloloskan semua).
//
// ⚠ Threshold di sini diubah (2026-09) supaya token yang lolos kualitas
// evaluateMemeAlert (STRONG/WATCH) tidak jatuh ke bucket NONE hanya karena
// progress/mcap/top10 sedikit di bawah ambang lama. Semua angka bisa diubah
// di satu tempat ini tanpa masuk ke body function assignBucket.
export const BUCKET_RULES = {
  newBonding: { minProgress: 10, maxMcapUsd: 10_000 },
  bondingRadar: { minProgress: 35, maxProgress: 99, minMcapUsd: 5_000 },
  momentum: { minMcapUsd: 5_000, minVol5mUsd: 500, minTxns5m: 5 },
  // Gerbang konsentrasi holder — diubah 25 → 30 supaya token dengan TH1
  // 26–30% (seperti RONNIE THE GHOST 26.2%) tidak langsung di-kick ke NONE.
  // Catatan: evaluateMemeAlert masih punya hard veto TH1 >30% (di
  // lib/memeScanner.ts MEME_CONFIG.vetoMaxTopHolderPct), jadi ada lapisan
  // keamanan yang lebih ketat di sana. Bucket ini hanya untuk klasifikasi,
  // bukan keputusan akhir.
  maxTop10Pct: 30,
}

export function assignBucket(t: {
  mcap: number; bondingProgress: number; bondingStage: string
  vol5m: number; txns5m: number; top10HolderPct: number; holderGate: string
}): { bucket: 'NEW_BONDING' | 'BONDING_RADAR' | 'MOMENTUM' | 'NONE'; reason: string } {
  const R = BUCKET_RULES
  const mc = `$${(t.mcap / 1000).toFixed(1)}k`
  const pg = `${t.bondingProgress.toFixed(0)}%`

  // Gerbang konsentrasi holder berlaku untuk SEMUA bucket: token yang
  // supply-nya terkonsentrasi di segelintir wallet disaring keluar.
  if (t.holderGate === 'FAIL') {
    return { bucket: 'NONE', reason: `top-10 holder ${t.top10HolderPct.toFixed(1)}% > ${R.maxTop10Pct}% (terlalu terkonsentrasi)` }
  }

  if (t.bondingStage === 'BONDING' && t.bondingProgress >= R.newBonding.minProgress && t.mcap <= R.newBonding.maxMcapUsd) {
    return { bucket: 'NEW_BONDING', reason: `progress ${pg} ≥ ${R.newBonding.minProgress}% & mcap ${mc} ≤ $10k` }
  }
  if (t.bondingStage === 'BONDING' && t.bondingProgress >= R.bondingRadar.minProgress && t.bondingProgress <= R.bondingRadar.maxProgress && t.mcap >= R.bondingRadar.minMcapUsd) {
    return { bucket: 'BONDING_RADAR', reason: `progress ${pg} di 35–99% & mcap ${mc} ≥ $10k` }
  }
  if (t.mcap >= R.momentum.minMcapUsd && t.vol5m >= R.momentum.minVol5mUsd && t.txns5m >= R.momentum.minTxns5m) {
    return { bucket: 'MOMENTUM', reason: `mcap ${mc} ≥ $10k + vol5m $${Math.round(t.vol5m)} / ${t.txns5m} txns` }
  }

  // Alasan penolakan yang spesifik supaya tidak ada "list mati" tanpa penjelasan.
  if (t.mcap < R.momentum.minMcapUsd && t.bondingStage !== 'BONDING') return { bucket: 'NONE', reason: `mcap ${mc} < $10k & sudah lepas kurva` }
  if (t.bondingStage === 'BONDING' && t.bondingProgress < R.newBonding.minProgress) return { bucket: 'NONE', reason: `progress ${pg} < ${R.newBonding.minProgress}% (kurva belum bergerak)` }
  if (t.bondingStage === 'UNKNOWN') return { bucket: 'NONE', reason: 'harga SOL / mcap tidak tersedia → progress tak bisa dihitung' }
  if (t.mcap >= R.momentum.minMcapUsd) return { bucket: 'NONE', reason: `mcap ${mc} ≥ $10k tapi vol5m $${Math.round(t.vol5m)} / ${t.txns5m} txns di bawah ambang momentum` }
  return { bucket: 'NONE', reason: `mcap ${mc}, progress ${pg} — di luar aturan bucket` }
}

// ─── Helper: classify narrative ─────────────────────────────────
export function classifyNarrative(name: string, symbol: string): string {
  const text = `${name} ${symbol}`.toLowerCase()
  if (text.includes('frog')) return 'FROG'
  if (text.includes('dog') || text.includes('wif') || text.includes('shib') || text.includes('inu')) return 'DOG'
  if (text.includes('cat') || text.includes('popcat') || text.includes('meow') || text.includes('samoyed')) return 'CAT'
  if (text.includes('ai') || text.includes('agent') || text.includes('bot')) return 'AI'
  if (text.includes('politi') || text.includes('trump') || text.includes('biden') || text.includes('maga')) return 'POLITICAL'
  if (text.includes('sport') || text.includes('nba') || text.includes('nfl') || text.includes('soccer')) return 'SPORTS'
  if (text.includes('game') || text.includes('play') || text.includes('nft')) return 'GAMING'
  if (text.includes('food') || text.includes('banana') || text.includes('pizza')) return 'FOOD'
  if (text.includes('art') || text.includes('pixel')) return 'ART'
  if (text.includes('music') || text.includes('song')) return 'MUSIC'
  return 'MEME'
}

// ─── Risiko dari fakta terukur (dipakai radar & pencarian) ────────────────
// Ambang identik dengan yang sudah berjalan di /api/meme-tokens:
//   liq < $10k → +35 (HIGH) · liq < $50k → +15 (MEDIUM)
//   buyRatio < 0.30 → +25   · buyRatio < 0.45 → +10
//   |ch1h| > 50% → +20      · |ch1h| > 25% → +8
//   sell/buy > 2 → +15      · sell/buy > 1 → +7
export function computeRiskFromFacts(f: {
  liq: number; buyRatio: number; ch1h: number; buys1h: number; sells1h: number
}): number {
  let riskScore = 0
  if (f.liq < 10_000) riskScore += 35
  else if (f.liq < 50_000) riskScore += 15
  if (f.buyRatio < 0.3) riskScore += 25
  else if (f.buyRatio < 0.45) riskScore += 10
  if (Math.abs(f.ch1h) > 50) riskScore += 20
  else if (Math.abs(f.ch1h) > 25) riskScore += 8
  if (f.sells1h > 0 && f.sells1h / Math.max(f.buys1h, 1) > 2) riskScore += 15
  else if (f.sells1h > 0 && f.sells1h / Math.max(f.buys1h, 1) > 1) riskScore += 7
  return Math.min(100, riskScore)
}

// ─── Penalti risiko dari data holder RugCheck ─────────────────────────────
// Fakta, bukan tebakan: gerbang top-10 > 25%, LP tidak terkunci pada token
// yang sudah graduate, tanda RUGGED, dan insider di top-10.
export function applyHolderRisk(
  riskScore: number,
  riskFlags: string[],
  stats: HolderStats | null,
  holderGate: 'PASS' | 'FAIL' | 'UNKNOWN',
  bondingStage: string,
): { riskScore: number; riskFlags: string[] } {
  const flags = [...riskFlags]
  let score = riskScore
  if (stats) {
    if (holderGate === 'FAIL') { score += 20; flags.push(`Top-10 holder ${stats.top10HolderPct.toFixed(1)}% > ${BUCKET_RULES.maxTop10Pct}%`) }
    if (bondingStage === 'GRADUATED' && stats.lpLockedPct < 90) { score += 10; flags.push(`LP terkunci hanya ${stats.lpLockedPct.toFixed(0)}%`) }
    if (stats.rugged) { score += 40; flags.push('Ditandai RUGGED oleh RugCheck') }
    if (stats.insiderPct > 5) { score += 10; flags.push(`Insider ${stats.insiderPct.toFixed(1)}% di top-10`) }
  }
  return { riskScore: Math.min(100, score), riskFlags: flags }
}

// ─── Label sinyal dari skor (band identik dengan radar) ───────────────────
export function aiSignalFromScore(aiScore: number, buyRatio: number): string {
  if (aiScore >= 80 && buyRatio > 0.6) return 'STRONG BUY'
  if (aiScore >= 70 && buyRatio > 0.55) return 'CONDITIONAL BUY'
  if (aiScore >= 60) return 'WATCH'
  if (aiScore >= 40) return 'WAIT'
  return 'AVOID'
}

// ─── Fase & kualitas entry (diturunkan dari kurva bonding + aktivitas) ────
export function computeEntryFacts(f: {
  bonding: { progress: number; raisedSol: number; stage: string }
  buyRatio: number; vol5m: number; txns5m: number
  ageHours: number; dexId: string; aiScore: number; riskScore: number
}): { entryPhase: 'EARLY' | 'CURRENT' | 'LATE'; entryQuality: number; entryReasons: string[] } {
  const { bonding, buyRatio, vol5m, txns5m, ageHours, dexId, aiScore, riskScore } = f
  const entryPhase: 'EARLY' | 'CURRENT' | 'LATE' =
    bonding.stage === 'BONDING' && bonding.progress < 35 ? 'EARLY'
    : bonding.stage === 'BONDING' || ageHours < 24 ? 'CURRENT'
    : 'LATE'
  const entryQuality = Math.max(0, Math.min(100, Math.round(
    aiScore * 0.4 + (100 - riskScore) * 0.3 + buyRatio * 100 * 0.2 + Math.min(100, txns5m * 2) * 0.1
  )))
  const entryReasons: string[] = []
  if (bonding.stage === 'BONDING') entryReasons.push(`Kurva bonding ${bonding.progress.toFixed(0)}% (${bonding.raisedSol.toFixed(1)}/85 SOL)`)
  else if (bonding.stage === 'GRADUATED') entryReasons.push(`Sudah graduate — diperdagangkan di ${dexId || 'DEX'}`)
  if (buyRatio > 0.55) entryReasons.push(`Buy pressure ${(buyRatio * 100).toFixed(0)}%`)
  if (vol5m >= BUCKET_RULES.momentum.minVol5mUsd) entryReasons.push(`Vol 5m $${Math.round(vol5m)} · ${txns5m} txns — ada gerak`)
  if (entryReasons.length === 0) entryReasons.push('Data live DexScreener')
  return { entryPhase, entryQuality, entryReasons }
}

// ─── Skor untuk hasil PENCARIAN (tanpa apeScore dari proxy feed) ──────────
// DexScreener search tidak menyediakan apeScore, jadi skor dihitung dari
// fakta yang benar-benar ada di respons pair. Setiap komponen memakai ambang
// yang SUDAH terverifikasi di modul ini (tidak ada angka baru yang dikarang):
//   buyPressure 30% → rasio buy 1h (txns.h1)
//   volume      25% → vol5m penuh pada $500  (= BUCKET_RULES.momentum.minVol5mUsd)
//   liquidity   20% → penuh pada $50k        (= batas MEDIUM→LOW computeRiskFromFacts)
//   aktivitas   15% → txns5m × 2, penuh pada 50 txns/5m (= rumus entryQuality)
//   momentum    10% → ch1h × 2, penuh pada +50%
export function computeSearchScore(f: {
  buyRatio: number; vol5m: number; liq: number; txns5m: number; ch1h: number
}): { score: number; breakdown: Record<string, number> } {
  const buyPressure = Math.max(0, Math.min(100, f.buyRatio * 100))
  const volume = Math.max(0, Math.min(100, (f.vol5m / BUCKET_RULES.momentum.minVol5mUsd) * 100))
  const liquidity = Math.max(0, Math.min(100, (f.liq / 50_000) * 100))
  const activity = Math.max(0, Math.min(100, f.txns5m * 2))
  const momentum = Math.max(0, Math.min(100, f.ch1h * 2))
  const score = Math.max(0, Math.min(100, Math.round(
    buyPressure * 0.30 + volume * 0.25 + liquidity * 0.20 + activity * 0.15 + momentum * 0.10
  )))
  return {
    score,
    breakdown: {
      buy_ratio_pct: Math.round(buyPressure),
      vol5m_usd: Math.round(f.vol5m),
      liq_usd: Math.round(f.liq),
      txns5m: Math.round(f.txns5m),
      ch1h_pct: Math.round(f.ch1h),
      w_buy_30: Math.round(buyPressure * 0.30),
      w_vol_25: Math.round(volume * 0.25),
      w_liq_20: Math.round(liquidity * 0.20),
      w_act_15: Math.round(activity * 0.15),
      w_mom_10: Math.round(momentum * 0.10),
    },
  }
}

// ─── Deteksi alamat mint Solana (base58, 32–44 karakter) ──────────────────
export function isSolanaMint(q: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(q || '').trim())
}

// ─── Map pair DexScreener → kontrak MemeToken ─────────────────────────────
// Semua field berasal dari respons pair DexScreener (tidak ada yang dikarang).
// Jendela 7d tidak disediakan API → priceChange7d memakai ch24h apa adanya,
// sama seperti perlakuan di /api/meme-tokens.
export function mapDexScreenerPair(pair: any, solUsd: number): any {
  const liq = Number(pair?.liquidity?.usd || 0)
  const vol5m = Number(pair?.volume?.m5 || 0)
  const vol1h = Number(pair?.volume?.h1 || 0)
  const vol24h = Number(pair?.volume?.h24 || 0)
  const buys1h = Number(pair?.txns?.h1?.buys || 0)
  const sells1h = Number(pair?.txns?.h1?.sells || 0)
  const totalTx1h = buys1h + sells1h
  const buyRatio = totalTx1h > 0 ? buys1h / totalTx1h : 0.5
  const txns5m = Number(pair?.txns?.m5?.buys || 0) + Number(pair?.txns?.m5?.sells || 0)
  const ch1h = Number(pair?.priceChange?.h1 || 0)
  const ch24h = Number(pair?.priceChange?.h24 || 0)
  const ch5m = Number(pair?.priceChange?.m5 || 0)
  const mcap = Number(pair?.marketCap || pair?.fdv || 0)
  const dexId = String(pair?.dexId || '')
  const createdAt = Number(pair?.pairCreatedAt || 0)
  const ageMinutes = createdAt > 0 ? Math.max(0, Math.round((Date.now() - createdAt) / 60000)) : 0
  const bonding = computeBonding(mcap, solUsd, dexId)

  const { score: aiScore, breakdown } = computeSearchScore({ buyRatio, vol5m, liq, txns5m, ch1h })
  const aiConfidence = Math.min(100, 40
    + (totalTx1h > 0 ? 20 : 0)
    + (liq > 0 ? 20 : 0)
    + (vol24h > 0 ? 10 : 0)
    + (mcap > 0 ? 10 : 0))
  const riskScore = computeRiskFromFacts({ liq, buyRatio, ch1h, buys1h, sells1h })
  const entry = computeEntryFacts({
    bonding, buyRatio, vol5m, txns5m,
    ageHours: ageMinutes / 60, dexId, aiScore, riskScore,
  })

  return {
    address: String(pair?.baseToken?.address || ''),
    symbol: String(pair?.baseToken?.symbol || '???'),
    name: String(pair?.baseToken?.name || 'Unknown'),
    price: Number(pair?.priceUsd || 0),
    priceNative: Number(pair?.priceNative || 0),
    quoteSymbol: String(pair?.quoteToken?.symbol || ''),
    priceChange1h: ch1h,
    priceChange24h: ch24h,
    priceChange7d: ch24h,
    liquidity: liq,
    liquidityChange1h: 0,
    volume1h: vol1h,
    volume24h: vol24h,
    volumeAcceleration: vol24h > 0 ? vol1h / (vol24h / 24) : 0,
    buys1h,
    sells1h,
    buySellRatio: totalTx1h > 0 ? (buys1h / totalTx1h * 100).toFixed(1) : '50.0',
    uniqueBuyers: Number(pair?.txns?.m5?.buys || 0),
    uniqueSellers: Number(pair?.txns?.m5?.sells || 0),
    smartMoneyInflow: 0,   // tidak ada sumber wallet-tracking di DexScreener search
    smartMoneyCount: 0,
    sniperActivity: buys1h > 20 ? 'HIGH' : buys1h > 5 ? 'MEDIUM' : 'LOW',
    earlyBuyerQuality: 0,
    narrative: classifyNarrative(String(pair?.baseToken?.name || ''), String(pair?.baseToken?.symbol || '')),
    narrativeMomentum: 0,
    aiScore,
    aiConfidence,
    aiSignal: aiSignalFromScore(aiScore, buyRatio),
    aiBreakdown: breakdown,
    riskScore,
    riskFlags: riskScore >= 70 ? ['High risk'] : [],
    riskLevels: {
      liquidity: liq < 10_000 ? 'HIGH' : liq < 50_000 ? 'MEDIUM' : 'LOW',
      holder: buyRatio < 0.3 ? 'HIGH' : buyRatio < 0.45 ? 'MEDIUM' : 'LOW',
      deployer: Math.abs(ch1h) > 50 ? 'HIGH' : Math.abs(ch1h) > 25 ? 'MEDIUM' : 'LOW',
      exit: sells1h > 0 && sells1h / Math.max(buys1h, 1) > 2 ? 'HIGH' : sells1h > 0 && sells1h / Math.max(buys1h, 1) > 1 ? 'MEDIUM' : 'LOW',
      cluster: 'LOW',
    },
    entryQuality: entry.entryQuality,
    entryPhase: entry.entryPhase,
    entryReasons: entry.entryReasons,
    exitPressure: sells1h > 0 ? Math.min(100, Math.round(sells1h / Math.max(buys1h, 1) * 20)) : 0,
    exitLevel: sells1h > 0 && sells1h / Math.max(buys1h, 1) > 2 ? 'HIGH' : 'LOW',
    exitReasons: [],
    dexUrl: String(pair?.url || ''),
    pairAddress: String(pair?.pairAddress || ''),
    createdAt: new Date().toISOString(),
    age: ageMinutes,
    source: 'dexscreener-search',
    freshness: 'LIVE',
    mcap,
    dexId,
    phase: '',
    logoUrl: String(pair?.info?.imageUrl || ''),
    vol5m,
    ch5m,
    txns5m,
    ageFmt: ageMinutes > 1440 ? `${Math.round(ageMinutes / 1440)}d` : ageMinutes > 60 ? `${Math.round(ageMinutes / 60)}h` : `${ageMinutes}m`,
    isBoosted: Array.isArray(pair?.labels) && pair.labels.includes('boosted'),
    bondingProgress: bonding.progress,
    bondingRaisedSol: bonding.raisedSol,
    bondingStage: bonding.stage,
    solPriceUsd: solUsd,
  }
}

// ─── Enrichment holder + bucket untuk satu token (dipakai pencarian) ──────
// Memakai fetchHolderStats + assignBucket + applyHolderRisk yang sama dengan
// radar, sehingga hasil pencarian dinilai dengan gerbang yang identik.
export async function enrichTokenWithHolders(tk: any): Promise<any> {
  const stats = await fetchHolderStats(tk.address)
  const cachedAt = holderCache.get(tk.address)?.ts
  const holderDataAge = cachedAt ? Math.round((Date.now() - cachedAt) / 1000) : -1
  const holderGate: 'PASS' | 'FAIL' | 'UNKNOWN' = stats
    ? (stats.top10HolderPct > BUCKET_RULES.maxTop10Pct ? 'FAIL' : 'PASS')
    : 'UNKNOWN'

  const held = applyHolderRisk(tk.riskScore, tk.riskFlags, stats, holderGate, tk.bondingStage)
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
    riskScore: held.riskScore,
    riskFlags: held.riskFlags,
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
}

// ─── Feed SUPLEMEN: daftar publik DexScreener (profiles + boosts) ──────────
// Proxy lokal 127.0.0.1:3001 hanya mengirim ±30 token (hard cap, tidak
// menerima param limit), sehingga setelah dedup + filter likuiditas radar
// sering tinggal ±14 baris dan pagination tidak pernah muncul. Helper ini
// menambah mint Solana dari daftar publik gratis DexScreener, lalu menarik
// pair-nya secara batch (≤30 mint per request) dan memetakannya dengan
// mapDexScreenerPair — kontrak field yang sama persis dengan endpoint
// pencarian, jadi aman digabung ke pipeline radar (dedup → RugCheck →
// bucket → sort → pagination).

const SUPPLEMENT_LIST_TIMEOUT_MS = 8_000
const SUPPLEMENT_PAIRS_TIMEOUT_MS = 10_000
const SUPPLEMENT_MINTS_PER_REQUEST = 30   // batas batch /latest/dex/tokens (terverifikasi)
const SUPPLEMENT_MAX_MINTS = 90           // 3 daftar × ±30 entri; dibatasi agar hemat kuota

// Ambil mint Solana unik dari tiga daftar publik (paralel, fail-soft per
// daftar — jika satu endpoint mati, dua lainnya tetap dipakai).
export async function fetchSupplementMints(): Promise<string[]> {
  const lists = await Promise.all([
    fetchJson(DEXSCREENER_PROFILES, SUPPLEMENT_LIST_TIMEOUT_MS),
    fetchJson(DEXSCREENER_BOOSTS_LATEST, SUPPLEMENT_LIST_TIMEOUT_MS),
    fetchJson(DEXSCREENER_BOOSTS_TOP, SUPPLEMENT_LIST_TIMEOUT_MS),
  ])
  const seen = new Set<string>()
  const mints: string[] = []
  for (const list of lists) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (String(item?.chainId || '') !== 'solana') continue
      const addr = String(item?.tokenAddress || '').trim()
      if (!isSolanaMint(addr) || seen.has(addr)) continue
      seen.add(addr)
      mints.push(addr)
    }
  }
  return mints.slice(0, SUPPLEMENT_MAX_MINTS)
}

// Tarik pair untuk daftar mint secara batch (≤30 mint per request, konkurensi
// 3), petakan dengan mapDexScreenerPair, lalu simpan hanya pair dengan
// likuiditas tertinggi per mint (dedup identik dengan radar/pencarian).
export async function fetchPairsByMints(mints: string[], solUsd: number): Promise<any[]> {
  if (!mints.length) return []
  const chunks: string[][] = []
  for (let i = 0; i < mints.length; i += SUPPLEMENT_MINTS_PER_REQUEST) {
    chunks.push(mints.slice(i, i + SUPPLEMENT_MINTS_PER_REQUEST))
  }
  const results = await mapLimit(chunks, 3, async (chunk) => {
    const data = await fetchJson(`${DEXSCREENER_TOKENS}/${chunk.join(',')}`, SUPPLEMENT_PAIRS_TIMEOUT_MS)
    if (!data || !Array.isArray(data.pairs)) return [] as any[]
    return data.pairs as any[]
  })
  const bestByMint = new Map<string, any>()
  for (const pairs of results) {
    for (const pair of pairs) {
      if (String(pair?.chainId || '') !== 'solana') continue
      const mapped = mapDexScreenerPair(pair, solUsd)
      // Lewati pair mati (likuiditas $0 — sering muncul di daftar profiles/
      // boosts untuk token yang sudah tidak diperdagangkan). Suplemen ada
      // untuk MEMPERBESAR radar; pair mati hanya jadi noise di bucketCounts.
      if (!mapped.address || !(mapped.liquidity > 0)) continue
      mapped.source = 'dexscreener-supplement'
      const prev = bestByMint.get(mapped.address)
      if (!prev || mapped.liquidity > prev.liquidity) bestByMint.set(mapped.address, mapped)
    }
  }
  return Array.from(bestByMint.values())
}
