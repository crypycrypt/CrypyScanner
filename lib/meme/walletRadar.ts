// ══════════════════════════════════════════════════════════════════════════
// REAL SMART-WALLET RADAR (Solana, on-chain)
// ──────────────────────────────────────────────────────────────────────────
// Menggantikan data wallet simulasi dengan wallet ASLI yang diturunkan dari
// transaksi on-chain. Sumber: Helius Enhanced (parsed) Transactions API.
//
// Alur:
//   1. Ambil seed token live (mint) yang sedang aktif dari proxy dex-feed.
//   2. Untuk tiap mint, tarik transaksi SWAP terbaru dari Helius.
//   3. Parse tiap swap → 1 "leg" (wallet, side BUY/SELL, mint, jumlah SOL,
//      jumlah token, timestamp). Trader = feePayer (penanda tangan tx).
//   4. Agregasi per wallet: realized PnL (SOL), win-rate, frekuensi, kategori
//      token, kurva ekuitas → smart-money score + klasifikasi DNA.
//   5. Kembalikan MemeWallet[] dengan `address` = alamat Solana LENGKAP
//      (44 char) sehingga tombol SALIN menyalin alamat asli, bukan placeholder.
//
// Kejujuran data: statistik dihitung dari jendela transaksi yang ditarik
// (swap pada token-token trending saat ini), BUKAN riwayat 30 hari penuh tiap
// wallet. Karena itu `roi30d` sebenarnya "realized PnL (SOL) pada jendela
// teramati" dan ditampilkan sebagai P&L, bukan ROI 30D sejati.
//
// Butuh env: HELIUS_API_KEY. Tanpa key → hasRealWalletProvider() = false dan
// route memakai fallback simulasi (diberi flag simulated:true).
// ══════════════════════════════════════════════════════════════════════════

import { fetchJson, mapLimit, classifyNarrative } from './enrich'
import { MemeWallet } from './types'

const WRAPPED_SOL = 'So11111111111111111111111111111111111111112'
const STABLE_MINTS = new Set<string>([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
])

// ─── Konfigurasi provider (key-gated) ──────────────────────────────────────
export function heliusKey(): string {
  return String(process.env.HELIUS_API_KEY || '').trim()
}

export type WalletProvider = 'helius' | 'simulated'

export function activeWalletProvider(): WalletProvider {
  const forced = String(process.env.SOLANA_WALLET_PROVIDER || '').toLowerCase()
  if (forced === 'simulated') return 'simulated'
  return heliusKey().length > 0 ? 'helius' : 'simulated'
}

export function hasRealWalletProvider(): boolean {
  return activeWalletProvider() === 'helius'
}

function heliusTxUrl(address: string, key: string, limit: number): string {
  const l = Math.max(1, Math.min(100, limit))
  return `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${encodeURIComponent(key)}&limit=${l}&type=SWAP`
}

// ─── Tipe leg swap ─────────────────────────────────────────────────────────
type SwapLeg = {
  sig: string
  ts: number          // detik (unix)
  wallet: string      // alamat Solana lengkap (feePayer)
  side: 'BUY' | 'SELL'
  mint: string        // mint token meme (bukan SOL/stable)
  sol: number         // SOL yang mengalir (masuk utk BUY, keluar utk SELL)
  tokenAmount: number // jumlah token (sudah disesuaikan desimal)
  source: string      // RAYDIUM | PUMPFUN | JUPITER | ...
}

export type SeedToken = { mint: string; symbol?: string; name?: string }

// ─── Parse satu transaksi SWAP Helius → leg ────────────────────────────────
// events.swap:
//   BUY  → nativeInput (SOL dibayar)  + tokenOutputs (token diterima)
//   SELL → nativeOutput (SOL diterima) + tokenInputs  (token dijual)
function rawTokenAmount(t: any): number {
  const raw = t?.rawTokenAmount
  if (!raw) return 0
  const amt = Number(raw.tokenAmount ?? 0)
  const dec = Number(raw.decimals ?? 0)
  if (!Number.isFinite(amt)) return 0
  return dec > 0 ? amt / Math.pow(10, dec) : amt
}

function pickTokenLeg(list: any[]): any {
  if (!Array.isArray(list) || !list.length) return null
  return (
    list.find((t: any) => t?.mint && t.mint !== WRAPPED_SOL && !STABLE_MINTS.has(String(t.mint))) ||
    list[0]
  )
}

export function parseSwapTx(tx: any): SwapLeg | null {
  if (!tx || tx.type !== 'SWAP') return null
  const ev = tx.events?.swap
  if (!ev) return null

  const wallet = String(
    tx.feePayer || ev.nativeInput?.account || ev.nativeOutput?.account || ''
  ).trim()
  if (!wallet) return null

  const ts = Number(tx.timestamp || 0)
  const sig = String(tx.signature || `${wallet}-${ts}`)
  const source = String(tx.source || '')

  // BUY: SOL masuk ke pool, token keluar ke trader
  if (ev.nativeInput && Array.isArray(ev.tokenOutputs) && ev.tokenOutputs.length) {
    const tok = pickTokenLeg(ev.tokenOutputs)
    const mint = String(tok?.mint || '')
    if (!mint || mint === WRAPPED_SOL || STABLE_MINTS.has(mint)) return null
    const sol = Number(ev.nativeInput.amount || 0) / 1e9
    if (!(sol > 0)) return null
    return { sig, ts, wallet, side: 'BUY', mint, sol, tokenAmount: rawTokenAmount(tok), source }
  }

  // SELL: token masuk ke pool, SOL keluar ke trader
  if (ev.nativeOutput && Array.isArray(ev.tokenInputs) && ev.tokenInputs.length) {
    const tok = pickTokenLeg(ev.tokenInputs)
    const mint = String(tok?.mint || '')
    if (!mint || mint === WRAPPED_SOL || STABLE_MINTS.has(mint)) return null
    const sol = Number(ev.nativeOutput.amount || 0) / 1e9
    if (!(sol > 0)) return null
    return { sig, ts, wallet, side: 'SELL', mint, sol, tokenAmount: rawTokenAmount(tok), source }
  }

  return null
}

// ─── Helper statistik ──────────────────────────────────────────────────────
function relTime(tsSec: number): string {
  if (!tsSec) return '—'
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - tsSec))
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function classifyWalletDNA(f: { avgHoldMin: number; winRate: number; avgROI: number; trades: number }): string {
  if (f.avgHoldMin < 10 && f.winRate >= 55) return 'EARLY SNIPER'
  if (f.avgHoldMin < 30) return 'FAST FLIPPER'
  if (f.avgHoldMin >= 120 && f.winRate >= 55) return 'SWING TRADER'
  if (f.avgROI >= 2 && f.winRate >= 60) return 'SMART ACCUMULATOR'
  if (f.trades >= 15) return 'SCALP BOT'
  if (f.winRate > 0 && f.winRate < 40) return 'CHASER'
  return 'GENERAL TRADER'
}

// Smart-money score heuristik 0–100 dari perilaku on-chain teramati.
function computeSmartScore(f: {
  winRate: number; avgROI: number; trades: number; closed: number
  sellDiscipline: number; recencyMin: number
}): number {
  let s = 0
  s += Math.min(35, f.winRate * 0.35)                 // win-rate → maks 35
  s += Math.min(25, Math.max(0, f.avgROI - 1) * 25)   // ROI multiple di atas 1x → maks 25
  s += Math.min(20, f.trades * 1.0)                   // aktivitas → maks 20
  s += f.closed > 0 ? 10 : 0                          // punya posisi tertutup (PnL nyata)
  const sd = f.sellDiscipline
  s += sd > 0.3 && sd < 1.5 ? 10 : sd >= 1.5 ? 2 : 5  // disiplin jual sehat
  s += f.recencyMin < 60 ? 5 : f.recencyMin < 600 ? 2 : 0 // recency
  return Math.max(1, Math.min(100, Math.round(s)))
}

// Kurva ekuitas (SOL berjalan) → 12 titik 0–100 untuk sparkline.
function buildSparkline(sorted: SwapLeg[]): number[] {
  if (!sorted.length) return Array(12).fill(50)
  const curve: number[] = []
  let run = 0
  sorted.forEach(l => {
    run += l.side === 'SELL' ? l.sol : -l.sol
    curve.push(run)
  })
  const min = Math.min(...curve)
  const max = Math.max(...curve)
  const span = max - min || 1
  const pts: number[] = []
  for (let i = 0; i < 12; i++) {
    const idx = curve.length === 1 ? 0 : Math.floor((i * (curve.length - 1)) / 11)
    pts.push(Math.round(((curve[idx] - min) / span) * 100))
  }
  return pts
}

// ─── Agregasi leg → MemeWallet (alamat LENGKAP) ────────────────────────────
function computeStats(
  addr: string,
  legs: SwapLeg[],
  mintMeta: Map<string, { symbol: string; name: string }>
): MemeWallet | null {
  const sorted = [...legs].sort((a, b) => a.ts - b.ts)
  if (sorted.length < 2) return null // butuh ≥2 trade agar statistik berarti

  const buys = sorted.filter(l => l.side === 'BUY')
  const sells = sorted.filter(l => l.side === 'SELL')
  const distinctMints = Array.from(new Set(sorted.map(l => l.mint)))

  // Realized PnL per mint (hanya posisi yang sudah ada penjualan).
  let realized = 0
  let closed = 0
  let wins = 0
  let roiSum = 0
  const perMintRoi: Record<string, number> = {}
  distinctMints.forEach(m => {
    const ml = sorted.filter(l => l.mint === m)
    const spent = ml.filter(l => l.side === 'BUY').reduce((s, l) => s + l.sol, 0)
    const recv = ml.filter(l => l.side === 'SELL').reduce((s, l) => s + l.sol, 0)
    const tokBought = ml.filter(l => l.side === 'BUY').reduce((s, l) => s + l.tokenAmount, 0)
    const tokSold = ml.filter(l => l.side === 'SELL').reduce((s, l) => s + l.tokenAmount, 0)
    if (tokSold > 0 && spent > 0) {
      const matchedFrac = tokBought > 0 ? Math.min(1, tokSold / tokBought) : 1
      const cost = spent * matchedFrac
      const pnl = recv - cost
      realized += pnl
      closed++
      if (pnl > 0) wins++
      const roi = cost > 0 ? recv / cost : 0
      roiSum += roi
      perMintRoi[m] = roi
    }
  })

  const winRate = closed > 0 ? Math.round((wins / closed) * 100) : 0
  const avgROI = closed > 0 ? +(roiSum / closed).toFixed(2) : 0
  const netSol = +realized.toFixed(2)
  const isProfit = netSol > 0

  const firstTs = sorted[0]?.ts || 0
  const lastTs = sorted[sorted.length - 1]?.ts || 0
  const spanMin = Math.max(1, Math.round((lastTs - firstTs) / 60))
  const avgHoldMin = Math.max(1, Math.round(spanMin / sorted.length))

  const cats = new Set<string>()
  distinctMints.forEach(m => {
    const meta = mintMeta.get(m)
    cats.add(classifyNarrative(meta?.name || '', meta?.symbol || ''))
  })
  const preferredCategories = Array.from(cats).slice(0, 4)

  const sparkline = buildSparkline(sorted)
  // Umur trade terakhir dalam MENIT (threshold score memakai menit: <60 / <600).
  const recencyMin = Math.max(0, Math.round((Date.now() / 1000 - lastTs) / 60))
  const sellDiscipline = buys.length > 0 ? sells.length / buys.length : sells.length > 0 ? 2 : 0

  const smartMoneyScore = computeSmartScore({
    winRate, avgROI, trades: sorted.length, closed, sellDiscipline, recencyMin,
  })
  const dna = classifyWalletDNA({ avgHoldMin, winRate, avgROI, trades: sorted.length })
  const avgBuySol = buys.length > 0 ? buys.reduce((s, l) => s + l.sol, 0) / buys.length : 0
  const confidence = Math.min(95, 40 + sorted.length * 2 + closed * 3)

  const recentTrades = sorted.slice(-6).reverse().map((l, i) => {
    const meta = mintMeta.get(l.mint)
    const roi = perMintRoi[l.mint] ?? 0
    return {
      id: `${addr}-t${i}`,
      token: meta?.symbol || `${l.mint.slice(0, 4)}…`,
      isWin: roi >= 1,
      roi: +roi.toFixed(2),
      entryPrice: l.side === 'BUY' && l.tokenAmount > 0 ? l.sol / l.tokenAmount : 0,
      exitPrice: l.side === 'SELL' && l.tokenAmount > 0 ? l.sol / l.tokenAmount : 0,
    }
  })

  return {
    id: addr,
    address: addr, // ← alamat Solana LENGKAP (dipakai tombol SALIN)
    shortAddr: `${addr.slice(0, 4)}…${addr.slice(-4)}`,
    label: `${distinctMints.length} token · ${sorted.length} swap`,
    dna,
    confidence,
    roi30d: `${netSol >= 0 ? '+' : ''}${netSol.toFixed(2)} SOL`,
    winRate,
    avgROI,
    medianROI: avgROI,
    avgHoldingTime: `${avgHoldMin}m`,
    medianHoldingTime: `${avgHoldMin}m`,
    avgEntryMc: '—',
    avgExitMc: '—',
    tradeCount: sorted.length,
    successfulTrades: wins,
    failedTrades: Math.max(0, closed - wins),
    preferredCategories,
    preferredLaunchAge: '—',
    preferredLiquidityRange: '—',
    avgPositionSize: `${avgBuySol.toFixed(2)} SOL`,
    buyingBehavior: `${buys.length} buy teramati`,
    sellingBehavior: `${sells.length} sell teramati`,
    scalingBehavior: distinctMints.length > 3 ? 'terdiversifikasi antar token' : 'posisi terkonsentrasi',
    convictionBehavior:
      avgHoldMin < 15 ? 'fast flip (<15m)' : avgHoldMin < 120 ? 'swing intraday' : 'hold lebih lama',
    smartMoneyScore,
    lastActive: relTime(lastTs),
    isProfit,
    solValue: Math.abs(netSol),
    profitLoss: netSol,
    sparkline,
    recentTrades,
  }
}

// ─── Discovery utama ───────────────────────────────────────────────────────
export type DiscoverResult = {
  wallets: MemeWallet[]
  legs: number
  mintsQueried: number
  walletsSeen: number
}

export async function discoverWallets(
  seeds: SeedToken[],
  opts?: { perMint?: number; concurrency?: number; topN?: number; maxMints?: number }
): Promise<DiscoverResult> {
  const key = heliusKey()
  if (!key) return { wallets: [], legs: 0, mintsQueried: 0, walletsSeen: 0 }

  const perMint = Math.min(100, opts?.perMint ?? 50)
  const concurrency = opts?.concurrency ?? 4
  const topN = opts?.topN ?? 20
  const maxMints = opts?.maxMints ?? 10

  const uniqueSeeds: SeedToken[] = []
  const seenMint = new Set<string>()
  for (const s of seeds) {
    if (!s?.mint || seenMint.has(s.mint)) continue
    seenMint.add(s.mint)
    uniqueSeeds.push(s)
    if (uniqueSeeds.length >= maxMints) break
  }

  const mintMeta = new Map<string, { symbol: string; name: string }>()
  uniqueSeeds.forEach(s => mintMeta.set(s.mint, { symbol: s.symbol || '', name: s.name || '' }))

  // Tarik SWAP terbaru per mint (concurrency dibatasi agar ramah rate-limit).
  const batches = await mapLimit(uniqueSeeds, concurrency, async (s) => {
    const data = await fetchJson(heliusTxUrl(s.mint, key, perMint), 12_000)
    return Array.isArray(data) ? data : []
  })

  const legs: SwapLeg[] = []
  const seenLeg = new Set<string>()
  batches.flat().forEach((tx: any) => {
    const leg = parseSwapTx(tx)
    if (!leg) return
    const dedupeKey = `${leg.sig}:${leg.wallet}:${leg.mint}:${leg.side}`
    if (seenLeg.has(dedupeKey)) return
    seenLeg.add(dedupeKey)
    // Mint di luar seed tetap dicatat (symbol/name kosong) agar agregasi tidak
    // kehilangan token yang ditransaksikan wallet pada pair lain.
    if (!mintMeta.has(leg.mint)) {
      mintMeta.set(leg.mint, { symbol: '', name: '' })
    }
    legs.push(leg)
  })

  // Agregasi per wallet.
  const byWallet = new Map<string, SwapLeg[]>()
  legs.forEach(l => {
    const arr = byWallet.get(l.wallet)
    if (arr) arr.push(l)
    else byWallet.set(l.wallet, [l])
  })

  const wallets: MemeWallet[] = []
  byWallet.forEach((wl, addr) => {
    const stat = computeStats(addr, wl, mintMeta)
    if (stat) wallets.push(stat)
  })

  wallets.sort((a, b) => b.smartMoneyScore - a.smartMoneyScore)
  const top = wallets.slice(0, topN).map((w, i) => ({ ...w, id: `wallet-${i + 1}` }))

  return { wallets: top, legs: legs.length, mintsQueried: uniqueSeeds.length, walletsSeen: byWallet.size }
}
