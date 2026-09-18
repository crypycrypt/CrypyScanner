import { NextRequest, NextResponse } from 'next/server'
import { MemeWallet } from '../../../lib/meme/types'
import {
  discoverWallets,
  hasRealWalletProvider,
  activeWalletProvider,
  type SeedToken,
} from '../../../lib/meme/walletRadar'

// ─── Smart-wallet radar (Solana) ───────────────────────────────────────────
// DUA mode, dipilih otomatis dari ketersediaan API key:
//
//   provider = 'helius'   → DATA ASLI on-chain. Wallet ditemukan dari transaksi
//                           SWAP nyata pada token meme yang sedang live (proxy
//                           dex-feed), lalu diagregasi jadi PnL/win-rate/DNA.
//                           `address` = alamat Solana LENGKAP (tombol SALIN
//                           menyalin alamat asli). Butuh env HELIUS_API_KEY.
//
//   provider = 'simulated'→ fallback DEMO (tanpa key). Angka dikarang dengan
//                           Math.random dan alamat hanya placeholder pendek.
//                           Diberi flag `simulated:true` agar UI jujur.
//
// Sebelumnya route ini SELALU simulated — itu sebabnya yang ter-copy adalah
// string pendek palsu seperti "2kL...3Pw", bukan alamat wallet lengkap.

const PROXY_FEED = 'http://127.0.0.1:3001/api/dex-feed/live'

// ─── Seed token live dari proxy (sumber yang sama dengan radar) ────────────
async function fetchSeedTokens(maxMints: number): Promise<SeedToken[]> {
  try {
    const res = await fetch(PROXY_FEED, {
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = await res.json()
    const tokens = Array.isArray(data?.tokens) ? data.tokens : []
    // Prioritaskan token dengan likuiditas/volume nyata agar swap-nya ramai.
    const ranked = tokens
      .map((t: any) => ({
        mint: String(t.address || ''),
        symbol: String(t.symbol || ''),
        name: String(t.name || ''),
        liq: Number(t.liq || 0),
        vol: Number(t.vol1h || t.vol5m || 0),
      }))
      .filter((t: any) => t.mint)
      .sort((a: any, b: any) => (b.liq + b.vol) - (a.liq + a.vol))
    return ranked.slice(0, maxMints).map((t: any) => ({ mint: t.mint, symbol: t.symbol, name: t.name }))
  } catch {
    return []
  }
}

// ─── Fallback DEMO (dipakai hanya bila tidak ada provider asli) ────────────
const WALLET_POOL = [
  '7xQ...91m', '3zR...4Kp', '9wT...2Xv', '5bN...8Fc', '2aM...7Jq',
  '8kL...3Pw', '4vH...6Rt', '6jF...1Ny', '1dG...9Bm', '3pS...5Vk',
  '9tW...2Xp', '7bN...4Fc', '5aM...8Jq', '2kL...3Pw', '8vH...6Rt',
]
const DNA_PROFILES = [
  'EARLY SNIPER', 'SMART ACCUMULATOR', 'SWING TRADER', 'SCALP BOT',
  'NARRATIVE CHASER', 'LIQUIDITY PROVIDER', 'EXIT STRATEGIST', 'COPY TRADER',
]
const CATEGORIES = ['AI', 'DOG', 'CAT', 'PEPE', 'POLITICAL', 'GAMING', 'DEGEN', 'MEME']

function generateSparkline(length = 12): number[] {
  const base = 50 + Math.random() * 20
  const data: number[] = []
  let current = base
  for (let i = 0; i < length; i++) {
    current += (Math.random() - 0.5) * 15
    current = Math.max(10, Math.min(100, current))
    data.push(Math.round(current))
  }
  return data
}

function generateSimulatedWallets(count = 15): MemeWallet[] {
  return WALLET_POOL.slice(0, count).map((addr, i) => {
    const isProfit = Math.random() > 0.35
    const solValue = isProfit
      ? +(Math.random() * 120 + 10).toFixed(1)
      : -(Math.random() * 25 + 0.5).toFixed(1)
    const dna = DNA_PROFILES[Math.floor(Math.random() * DNA_PROFILES.length)]
    const confidence = Math.floor(Math.random() * 30) + 60
    const tradeCount = Math.floor(Math.random() * 200) + 20
    const winRate = Math.floor(Math.random() * 40) + 45
    const successfulTrades = Math.floor((tradeCount * winRate) / 100)
    const failedTrades = tradeCount - successfulTrades
    const avgROI = +(Math.random() * 5 + 1).toFixed(1)
    const medianROI = +(Math.random() * 3 + 0.5).toFixed(1)
    const categories = CATEGORIES.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1)
    const buyBehaviors = ['enters 2-8 min after launch', 'waits for liquidity lock', 'buys dips aggressively', 'follows whale entries']
    const sellBehaviors = ['exits before liquidity collapse', 'scales out at 2-5x', 'holds through volatility', 'sells on volume spikes']
    const scaleBehaviors = ['adds on pullbacks', 'pyramids winners', 'averages down losers', 'all-in on conviction']
    const convictionBehaviors = ['high conviction, holds 1-3d', 'low conviction, scalps 5-30m', 'medium conviction, swings 1-4h', 'follows narrative momentum']
    return {
      id: `wallet-${i + 1}`,
      address: addr, // ← placeholder pendek (DEMO). Bukan alamat asli.
      shortAddr: addr,
      label: `${dna.split(' ')[0]} #${i + 1}`,
      dna,
      confidence,
      roi30d: isProfit ? `+${solValue.toFixed(1)} SOL` : `${solValue.toFixed(1)} SOL`,
      winRate,
      avgROI,
      medianROI,
      avgHoldingTime: `${Math.floor(Math.random() * 120) + 10}m`,
      medianHoldingTime: `${Math.floor(Math.random() * 60) + 5}m`,
      avgEntryMc: `$${(Math.random() * 500 + 50).toFixed(0)}K`,
      avgExitMc: `$${(Math.random() * 800 + 100).toFixed(0)}K`,
      tradeCount,
      successfulTrades,
      failedTrades,
      preferredCategories: categories,
      preferredLaunchAge: `${Math.floor(Math.random() * 30) + 1}-${Math.floor(Math.random() * 60) + 30} min`,
      preferredLiquidityRange: `$${(Math.random() * 200 + 50).toFixed(0)}K-$${(Math.random() * 500 + 200).toFixed(0)}K`,
      avgPositionSize: `$${(Math.random() * 5 + 0.5).toFixed(1)}K`,
      buyingBehavior: buyBehaviors[Math.floor(Math.random() * buyBehaviors.length)],
      sellingBehavior: sellBehaviors[Math.floor(Math.random() * sellBehaviors.length)],
      scalingBehavior: scaleBehaviors[Math.floor(Math.random() * scaleBehaviors.length)],
      convictionBehavior: convictionBehaviors[Math.floor(Math.random() * convictionBehaviors.length)],
      smartMoneyScore: Math.floor(Math.random() * 25) + 65,
      lastActive: `${Math.floor(Math.random() * 10)}m ago`,
      isProfit,
      solValue: Math.abs(solValue),
      profitLoss: solValue,
      sparkline: generateSparkline(),
    }
  })
}

// ─── Cache ─────────────────────────────────────────────────────────────────
let cache: any = null
let cacheTs = 0
// Data asli on-chain lebih mahal → cache lebih panjang (60s). Demo tetap 15s.
const TTL_REAL = 60_000
const TTL_SIM = 15_000

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'
  const provider = activeWalletProvider()
  const ttl = provider === 'helius' ? TTL_REAL : TTL_SIM

  if (!forceRefresh && cache && cache.provider === provider && Date.now() - cacheTs < ttl) {
    return NextResponse.json({ ok: true, cached: true, ...cache })
  }

  try {
    if (provider === 'helius') {
      // ── MODE ASLI: temukan wallet dari swap on-chain token live ──
      const seeds = await fetchSeedTokens(10)
      const result = await discoverWallets(seeds, { perMint: 50, concurrency: 4, topN: 20, maxMints: 10 })

      if (result.wallets.length === 0) {
        // Tidak ada wallet yang lolos ambang (≥2 trade) pada jendela ini.
        // Kembalikan hasil kosong yang JUJUR (bukan fallback demo) agar UI
        // tidak menampilkan angka karangan saat provider asli aktif.
        const empty = {
          provider: 'helius' as const,
          simulated: false,
          wallets: [],
          total: 0,
          legs: result.legs,
          mintsQueried: result.mintsQueried,
          walletsSeen: result.walletsSeen,
          note: 'Belum ada wallet dengan ≥2 swap pada token live jendela ini. Coba refresh.',
          fetchedAt: new Date().toISOString(),
        }
        cache = empty
        cacheTs = Date.now()
        return NextResponse.json({ ok: true, cached: false, ...empty })
      }

      const wallets = result.wallets
      const payload = {
        provider: 'helius' as const,
        simulated: false,
        wallets,
        total: wallets.length,
        legs: result.legs,
        mintsQueried: result.mintsQueried,
        walletsSeen: result.walletsSeen,
        copyingCount: wallets.filter(w => w.dna === 'COPY TRADER').length,
        watchCount: 0,
        topPerformers: wallets.filter(w => w.isProfit).slice(0, 5),
        fetchedAt: new Date().toISOString(),
      }
      cache = payload
      cacheTs = Date.now()
      return NextResponse.json({ ok: true, cached: false, ...payload })
    }

    // ── MODE DEMO: tidak ada HELIUS_API_KEY ──
    await new Promise(r => setTimeout(r, 80 + Math.random() * 120))
    const wallets = generateSimulatedWallets(15)
    wallets.sort((a, b) => b.smartMoneyScore - a.smartMoneyScore)
    wallets.forEach((w, i) => { w.id = `wallet-${i + 1}` })

    const payload = {
      provider: 'simulated' as const,
      simulated: true,
      wallets,
      total: wallets.length,
      copyingCount: wallets.filter(w => w.label.includes('COPY')).length,
      watchCount: wallets.filter(w => w.label.includes('WATCH')).length,
      topPerformers: wallets.filter(w => w.isProfit).slice(0, 5),
      note: 'Data DEMO — set HELIUS_API_KEY di .env untuk wallet on-chain asli (alamat lengkap + PnL nyata).',
      fetchedAt: new Date().toISOString(),
    }
    cache = payload
    cacheTs = Date.now()
    return NextResponse.json({ ok: true, cached: false, ...payload })
  } catch (error: any) {
    console.error('/api/meme-wallets error:', error?.message ?? error)
    if (cache) return NextResponse.json({ ok: true, cached: true, stale: true, ...cache })
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch meme wallet data', provider },
      { status: 500 }
    )
  }
}
