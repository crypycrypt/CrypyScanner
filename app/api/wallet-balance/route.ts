import { NextRequest, NextResponse } from 'next/server'
import { getSolPriceUsd } from '../../../lib/meme/enrich'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public Solana RPC — reads a wallet's native SOL balance. No API key, no
// wallet connect/signing: the user pastes a public address and we read
// what's already public on-chain. SPL token holdings are out of scope for
// now (would need a price lookup per token mint); this is native SOL only.
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com'

const cache = new Map<string, { data: any; ts: number }>()
const CACHE_DURATION = 20_000

function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

export async function GET(request: NextRequest) {
  const address = (request.nextUrl.searchParams.get('address') || '').trim()

  if (!address || !isValidSolanaAddress(address)) {
    return NextResponse.json({ ok: false, error: 'Alamat wallet Solana tidak valid' }, { status: 400 })
  }

  const cacheKey = `wallet-balance-${address}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_DURATION) {
    return NextResponse.json({ ok: true, cached: true, ...cached.data })
  }

  try {
    const [rpcRes, solPriceUsd] = await Promise.all([
      fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
        signal: AbortSignal.timeout(8_000),
      }),
      getSolPriceUsd(),
    ])

    if (!rpcRes.ok) throw new Error(`Solana RPC HTTP ${rpcRes.status}`)
    const rpcJson = await rpcRes.json()
    if (rpcJson.error) throw new Error(rpcJson.error?.message || 'Solana RPC error')

    const lamports = Number(rpcJson?.result?.value ?? 0)
    const solBalance = lamports / 1_000_000_000
    const balanceUsd = solBalance * solPriceUsd

    const data = { address, solBalance, solPriceUsd, balanceUsd, fetchedAt: new Date().toISOString() }
    cache.set(cacheKey, { data, ts: Date.now() })

    return NextResponse.json({ ok: true, cached: false, ...data })
  } catch (error: any) {
    console.error('/api/wallet-balance error:', error?.message ?? error)
    if (cached) return NextResponse.json({ ok: true, cached: true, stale: true, ...cached.data })
    return NextResponse.json({ ok: false, error: error?.message || 'Gagal membaca balance wallet' }, { status: 500 })
  }
}
