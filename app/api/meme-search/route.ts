import { NextRequest, NextResponse } from 'next/server'
// Satu sumber kebenaran dengan radar (/api/meme-tokens): kurva bonding,
// gerbang holder RugCheck 25%, aturan bucket, dan skoring deterministik
// semuanya diimpor dari lib/meme/enrich.ts — tidak ada duplikasi rumus.
import {
  fetchJson,
  mapLimit,
  getSolPriceUsd,
  fetchHolderStats,
  holderCache,
  BUCKET_RULES,
  assignBucket,
  applyHolderRisk,
  mapDexScreenerPair,
  isSolanaMint,
  DEXSCREENER_SEARCH,
  DEXSCREENER_TOKENS,
} from '../../../lib/meme/enrich'

// ─── Pencarian coin (fitur "cari coin lalu analisa" di menu Meme's) ───────
// Sumber: DexScreener public API.
//   • Query teks  → /latest/dex/search?q=<nama|simbol>
//   • Alamat mint → /latest/dex/tokens/<mint>  (pencarian presisi by contract)
// Hanya pair chain Solana yang diambil. Per mint dipilih pair dengan
// likuiditas terbesar (pair utama). Hasil dipetakan ke kontrak MemeToken
// yang sama dengan radar sehingga modal analisa (Chart / Info & Analysis /
// Forensik / AI Analyst) bisa langsung dipakai.
//
// Enrichment RugCheck dibatasi MAX_ENRICH token teratas (konkurensi 4,
// cache 3 menit per mint di lib) supaya latency pencarian tetap rendah;
// sisanya tetap dinilai bucket-nya dengan holderGate UNKNOWN (jujur —
// tidak mengarang data holder).

const MAX_ENRICH = 8
const searchCache = new Map<string, { data: any; ts: number }>()
const SEARCH_TTL = 20_000 // 20 detik — cukup untuk debounce UI, tetap live

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const q = String(sp.get('q') || '').trim()
  const limit = Math.min(parseInt(sp.get('limit') || '12', 10) || 12, 25)

  if (q.length < 2) {
    return NextResponse.json(
      { ok: false, error: 'Query minimal 2 karakter (nama, simbol, atau alamat mint)' },
      { status: 400 }
    )
  }

  const cacheKey = `search-${q.toLowerCase()}-${limit}`
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < SEARCH_TTL) {
    return NextResponse.json({ ok: true, cached: true, ...cached.data })
  }

  try {
    // 1) Ambil pair dari DexScreener — by mint kalau query berupa alamat
    const url = isSolanaMint(q)
      ? `${DEXSCREENER_TOKENS}/${q}`
      : `${DEXSCREENER_SEARCH}?q=${encodeURIComponent(q)}`
    const data = await fetchJson(url, 10_000)
    const pairs: any[] = Array.isArray(data?.pairs) ? data.pairs : []

    // 2) Hanya Solana, dedup per mint → pair dengan likuiditas terbesar
    const byMint = new Map<string, any>()
    for (const p of pairs) {
      if (p?.chainId !== 'solana') continue
      const mint = String(p?.baseToken?.address || '')
      if (!mint) continue
      const prev = byMint.get(mint)
      const liq = Number(p?.liquidity?.usd || 0)
      if (!prev || liq > Number(prev?.liquidity?.usd || 0)) byMint.set(mint, p)
    }

    // 3) Harga SOL untuk kurva bonding, lalu map ke kontrak MemeToken
    const solUsd = await getSolPriceUsd()
    const mapped = [...byMint.values()]
      .map((p: any) => mapDexScreenerPair(p, solUsd))
      .sort((a: any, b: any) => b.liquidity - a.liquidity)
      .slice(0, limit)

    // 4) Enrichment holder RugCheck untuk MAX_ENRICH token teratas
    const toEnrich = mapped.slice(0, MAX_ENRICH)
    const enriched = await mapLimit(toEnrich, 4, async (tk: any) => {
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

    // Token di luar kuota enrich tetap dinilai bucket-nya (tanpa data holder)
    const rest = mapped.slice(MAX_ENRICH).map((tk: any) => {
      const { bucket, reason } = assignBucket({
        mcap: tk.mcap,
        bondingProgress: tk.bondingProgress,
        bondingStage: tk.bondingStage,
        vol5m: tk.vol5m,
        txns5m: tk.txns5m,
        top10HolderPct: 0,
        holderGate: 'UNKNOWN',
      })
      return { ...tk, holderGate: 'UNKNOWN', holderDataAge: -1, bucket, bucketReason: reason }
    })

    const result = {
      query: q,
      tokens: [...enriched, ...rest],
      total: byMint.size,
      solPriceUsd: solUsd,
      holderGateMaxPct: BUCKET_RULES.maxTop10Pct,
      fetchedAt: new Date().toISOString(),
    }
    searchCache.set(cacheKey, { data: result, ts: Date.now() })
    return NextResponse.json({ ok: true, cached: false, ...result })
  } catch (error: any) {
    console.error('/api/meme-search error:', error?.message ?? error)
    if (cached) return NextResponse.json({ ok: true, cached: true, stale: true, ...cached.data })
    return NextResponse.json(
      { ok: false, error: error?.message || 'Pencarian gagal' },
      { status: 500 }
    )
  }
}
