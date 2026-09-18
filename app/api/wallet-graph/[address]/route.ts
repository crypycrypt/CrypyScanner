// ══════════════════════════════════════════════════════════════════════════
// GET /api/wallet-graph/:address
// Real on-chain wallet flow graph (Solana) — port of crypto-scanner
// proxy-server.js `/api/wallet-graph/:address`. No hardcoded wallet data.
// ══════════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { buildWalletGraph } from '@/lib/walletGraph'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  const addr = (address || '').trim()
  if (!addr || addr.length < 30) {
    return NextResponse.json({ ok: false, error: 'Invalid address' }, { status: 400 })
  }

  const limitParam = request.nextUrl.searchParams.get('limit')
  const sigLimit = Math.min(50, Math.max(10, parseInt(limitParam || '25', 10) || 25))

  try {
    const data = await buildWalletGraph(addr, sigLimit)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to build wallet graph' }, { status: 500 })
  }
}
