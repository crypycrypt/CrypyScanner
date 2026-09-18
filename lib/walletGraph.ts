// ══════════════════════════════════════════════════════════════════════════
// WALLET GRAPH ENGINE — 100% real on-chain data (Solana)
// Port of crypto-scanner proxy-server.js `/api/wallet-graph/:address`
// + enrichment: real SOL price (Binance/CoinGecko), USD values, distribusi
//   share per node, v0 loadedAddresses, real pattern detection, 90s cache.
// NO hardcoded wallet data — everything is fetched live from public RPC.
// ══════════════════════════════════════════════════════════════════════════

export type WgCategory = 'system' | 'dex' | 'stake' | 'lending' | 'exchange' | 'wallet'
export type WgCounterType = 'wallet' | 'program'
export type WgTxType =
  | 'buy' | 'sell' | 'swap' | 'stake' | 'unstake'
  | 'deposit_lend' | 'withdraw_lend' | 'deposit_cex' | 'withdraw_cex'
  | 'transfer_out' | 'transfer_in' | 'distribute' | 'fee' | 'debit' | 'credit'

export interface WgNode {
  id: string
  label: string
  fullAddr: string
  isCenter: boolean
  type: 'center' | 'inflow' | 'outflow' | 'mixed'
  counterType: WgCounterType
  counterCat: WgCategory
  sentSol: number          // SOL counterparty sent TO center (inflow)
  recvSol: number          // SOL counterparty received FROM center (outflow)
  sentUsd: number
  recvUsd: number
  txCount: number
  lastTs: number
  lastAgo: string
  color: string
  r: number
  sharePct: number         // % of total absolute SOL flow (distribusi)
  rank: number             // 1 = biggest peer by total flow
}

export interface WgEdge {
  from: string
  to: string
  sol: number
  usd: number
  dir: 'in' | 'out' | 'swap'
  txType: WgTxType
  label: string
}

export interface WgLedgerRow {
  sig: string
  shortSig: string
  blockTime: number
  dateStr: string
  timeAgo: string
  status: 'success' | 'failed'
  type: 'credit' | 'debit' | 'swap'
  txType: WgTxType
  counterType: WgCounterType
  counterCat: WgCategory
  solDelta: number
  solDeltaAbs: number
  usdAbs: number
  fee: number
  balanceAfter: number
  counterAddr: string | null
  counterLabel: string
  solscanUrl: string
}

export interface WgBiggestTx {
  sol: number
  usd: number
  counterLabel: string
  counterAddr: string | null
  sig: string
  timeAgo: string
  txType: WgTxType
}

export interface WgInsights {
  totalInSol: number
  totalOutSol: number
  netSol: number
  totalInUsd: number
  totalOutUsd: number
  netUsd: number
  biggestTx: WgBiggestTx | null
  smallestTx: WgBiggestTx | null
  windowStart: number
  windowEnd: number
  windowLabel: string
  firstFunder: { label: string; addr: string | null; sol: number; timeAgo: string } | null
  cexExposure: { count: number; sol: number; labels: string[] }
  dexActivity: { count: number; sol: number }
  distributionEvents: number
  programCount: number
  walletCount: number
  topPeerConcentrationPct: number
  txPerHour: number
  totalFeesSol: number
}

export interface WgPattern {
  sev: 'high' | 'med' | 'info'
  icon: string
  text: string
}

export interface WalletGraphResponse {
  ok: boolean
  error?: string
  center: string
  shortAddr: string
  nodes: WgNode[]
  edges: WgEdge[]
  ledger: WgLedgerRow[]
  insights: WgInsights | null
  patterns: WgPattern[]
  txCount: number
  parsedTxCount: number
  solPrice: number | null
  fetchedAt: string
  _cached?: boolean
}

// ── Public Solana RPC pool (same as reference) ──────────────────────────
const SOL_RPC_NODES = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana-mainnet.rpc.extrnode.com',
]

// System programs skipped as counterparties
const SYSTEM_PROGRAMS = [
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'ComputeBudget111111111111111111111111111111',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bY8',
  'SysvarRent111111111111111111111111111111111',
  'SysvarC1ock11111111111111111111111111111111',
]

// ── Known Solana programs / exchanges (entity labels — reference map) ──
const KNOWN_ADDRS: Record<string, { label: string; cat: WgCategory }> = {
  // System
  '11111111111111111111111111111111':             { label: 'System Program',       cat: 'system'   },
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA':  { label: 'Token Program',        cat: 'system'   },
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bY8': { label: 'Assoc. Token Program', cat: 'system'   },
  'ComputeBudget111111111111111111111111111111':  { label: 'Compute Budget',       cat: 'system'   },
  'SysvarRent111111111111111111111111111111111':  { label: 'Sysvar Rent',          cat: 'system'   },
  'SysvarC1ock11111111111111111111111111111111':  { label: 'Sysvar Clock',         cat: 'system'   },
  // DEX / AMM
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': { label: 'Raydium AMM',          cat: 'dex'      },
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': { label: 'Raydium CLMM',         cat: 'dex'      },
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc':  { label: 'Orca Whirlpool',       cat: 'dex'      },
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': { label: 'Orca',                 cat: 'dex'      },
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB':  { label: 'Jupiter v4',           cat: 'dex'      },
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4':  { label: 'Jupiter v6',           cat: 'dex'      },
  'JUP2jxvXaqu7NQY1GmNF4m1vodwdXNffhVi9hCKPw2y':  { label: 'Jupiter v2',           cat: 'dex'      },
  'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX':  { label: 'Serum DEX v3',         cat: 'dex'      },
  'EUqojwWA2rd19FZrzeBncJsm38Jm1hEhE3zsmX3bRc2o': { label: 'Serum DEX v2',         cat: 'dex'      },
  'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr':  { label: 'Orca v1',              cat: 'dex'      },
  'MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky':  { label: 'Mercurial',            cat: 'dex'      },
  'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ':  { label: 'Saber',                cat: 'dex'      },
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P':  { label: 'Pump.fun',             cat: 'dex'      },
  'BSfD6SHZigAfDWSjzD5Q41jw8LmKwtmjskPH9XW1mrRW': { label: 'Drift',                cat: 'dex'      },
  'opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb':  { label: 'OpenBook',             cat: 'dex'      },
  'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY':  { label: 'Phoenix DEX',          cat: 'dex'      },
  'Cm4L6yHwguFoQRUgCqamgadebuxC123zEmVCRuFHvajP': { label: 'Pump.fun Program',     cat: 'dex'      },
  'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1': { label: 'Pump.fun Fee Vault',   cat: 'dex'      },
  'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA':{ label: 'PumpSwap AMM',         cat: 'dex'      },
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo':{ label: 'Meteora DLMM',         cat: 'dex'      },
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB':{ label: 'Meteora Dyn AMM',      cat: 'dex'      },
  // Token infra
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb':  { label: 'Token-2022 Program',   cat: 'system'   },
  'So11111111111111111111111111111111111111112':  { label: 'Wrapped SOL',          cat: 'system'   },
  // Staking / LST
  'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD':  { label: 'Marinade',             cat: 'stake'    },
  'SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy':  { label: 'Stake Pool',           cat: 'stake'    },
  'CrX7kMhLC3cSsXJdT7JDgqrRVWGnUpX3gfEfxxPQwnt':  { label: 'Lido',                 cat: 'stake'    },
  // Lending
  'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo':  { label: 'Solend',               cat: 'lending'  },
  'Port7uDYB3wkvBkLH4aQTh6pj6Xza9sCXKVHB3BHb4':   { label: 'Port Finance',         cat: 'lending'  },
  'MFv2hWf31Z9kbCa1snEPdcgp168vLs2YNgGuX2By4XD':  { label: 'Marginfi',             cat: 'lending'  },
  // CEX hot wallets (best-effort)
  'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2': { label: 'Binance Hot Wallet',   cat: 'exchange' },
  'U6V3dBzS8RoF8jh3sqvB6T3h7tGnEhWsPJaLZQnYSj':   { label: 'OKX',                  cat: 'exchange' },
  '5tzFkiKscXHK5ZXCGbkqZKLCNJzD5GhFDpFMDeikk4R':  { label: 'Kraken',               cat: 'exchange' },
  '2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm': { label: 'Coinbase',             cat: 'exchange' },
  'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS': { label: 'Bybit',                cat: 'exchange' },
}

// ── Helpers ──────────────────────────────────────────────────────────────
function timeAgo(unixTs: number): string {
  if (!unixTs) return '?'
  const sec = Math.floor(Date.now() / 1000 - unixTs)
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function shortA(addr: string): string {
  return addr.slice(0, 5) + '…' + addr.slice(-4)
}

async function rpcCall(method: string, params: unknown[], timeoutMs = 12000): Promise<any> {
  for (const url of SOL_RPC_NODES) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!r.ok) continue
      const d: any = await r.json()
      if (d.error) continue
      return d.result
    } catch { /* try next node */ }
  }
  return null
}

// Classify a tx based on SOL delta + counterparty category (reference logic)
function classifyTxType(delta: number, counterCat: WgCategory, counterType: WgCounterType): WgTxType {
  const abs = Math.abs(delta)
  if (abs < 0.000001) return 'swap'
  switch (counterCat) {
    case 'dex':      return delta < 0 ? 'buy'          : 'sell'
    case 'stake':    return delta < 0 ? 'stake'        : 'unstake'
    case 'lending':  return delta < 0 ? 'deposit_lend' : 'withdraw_lend'
    case 'exchange': return delta < 0 ? 'deposit_cex'  : 'withdraw_cex'
    case 'system':   return 'fee'
    default:         return counterType === 'wallet'
      ? (delta < 0 ? 'transfer_out' : 'transfer_in')
      : (delta < 0 ? 'debit' : 'credit')
  }
}

// ── Real SOL price (Binance → CoinGecko fallback, 60s cache) ────────────
let priceCache: { ts: number; price: number | null } = { ts: 0, price: null }

export async function getSolPrice(): Promise<number | null> {
  if (priceCache.price && Date.now() - priceCache.ts < 60_000) return priceCache.price
  let price: number | null = null
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT', { signal: AbortSignal.timeout(6000) })
    const d: any = await r.json()
    const p = parseFloat(d?.price)
    if (p > 0) price = p
  } catch { /* fallback below */ }
  if (!price) {
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', { signal: AbortSignal.timeout(6000) })
      const d: any = await r.json()
      const p = parseFloat(d?.solana?.usd)
      if (p > 0) price = p
    } catch { /* no price */ }
  }
  if (price) priceCache = { ts: Date.now(), price }
  return price
}

// ── Graph cache (90s TTL, same as reference) ────────────────────────────
const graphCache = new Map<string, { ts: number; data: WalletGraphResponse }>()
const GRAPH_TTL = 90_000

interface CounterStats {
  sentSol: number
  recvSol: number
  txCount: number
  lastTs: number
}

// ── Main pipeline ────────────────────────────────────────────────────────
export async function buildWalletGraph(address: string, sigLimit = 25): Promise<WalletGraphResponse> {
  const addr = address.trim()
  if (!addr || addr.length < 30) {
    return { ok: false, error: 'Invalid address', center: addr, shortAddr: addr, nodes: [], edges: [], ledger: [], insights: null, patterns: [], txCount: 0, parsedTxCount: 0, solPrice: null, fetchedAt: new Date().toISOString() }
  }

  const cacheKey = `${addr}:${sigLimit}`
  const hit = graphCache.get(cacheKey)
  if (hit && Date.now() - hit.ts < GRAPH_TTL) return { ...hit.data, _cached: true }

  const solPrice = await getSolPrice()
  const usd = (sol: number) => (solPrice ? +(sol * solPrice).toFixed(2) : 0)

  // 1. Last N confirmed signatures
  const sigs: any[] = await rpcCall('getSignaturesForAddress', [addr, { limit: sigLimit, commitment: 'confirmed' }], 15000) || []
  if (!sigs.length) {
    const empty: WalletGraphResponse = {
      ok: true, center: addr, shortAddr: shortA(addr), nodes: [], edges: [], ledger: [],
      insights: null, patterns: [], txCount: 0, parsedTxCount: 0, solPrice,
      fetchedAt: new Date().toISOString(),
    }
    return empty
  }

  // 2. Parse each transaction (accounts + SOL flow from pre/post balances)
  const PARSE_MAX = Math.min(sigs.length, 20)
  const txResults: any[] = await Promise.all(
    sigs.slice(0, PARSE_MAX).map((s: any) =>
      rpcCall('getTransaction', [s.signature, { encoding: 'json', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }], 10000)
        .catch(() => null)
    )
  )

  const counterMap: Record<string, CounterStats> = {}

  // Extract full account list incl. v0 address-table lookups (enrichment)
  const accountsOf = (tx: any): string[] => {
    const keys: string[] = (tx?.transaction?.message?.accountKeys || []).map((a: any) => (typeof a === 'string' ? a : a.pubkey))
    const loadedW: string[] = tx?.meta?.loadedAddresses?.writable || []
    const loadedR: string[] = tx?.meta?.loadedAddresses?.readonly || []
    return [...keys, ...loadedW, ...loadedR]
  }

  txResults.forEach((tx: any, i: number) => {
    if (!tx?.meta || !tx.transaction) return
    const sig = sigs[i]
    const blockTime: number = sig.blockTime || 0
    const accounts = accountsOf(tx)
    const pre: number[] = tx.meta.preBalances || []
    const post: number[] = tx.meta.postBalances || []

    const centerIdx = accounts.findIndex(a => a === addr)
    if (centerIdx < 0) return
    const centerDelta = (post[centerIdx] - pre[centerIdx]) / 1e9

    accounts.forEach((counterAddr, j) => {
      if (counterAddr === addr) return
      if (SYSTEM_PROGRAMS.includes(counterAddr)) return
      if (j >= pre.length || j >= post.length) return

      const counterDelta = (post[j] - pre[j]) / 1e9
      if (!counterMap[counterAddr]) counterMap[counterAddr] = { sentSol: 0, recvSol: 0, txCount: 0, lastTs: 0 }
      counterMap[counterAddr].txCount++
      if (blockTime > counterMap[counterAddr].lastTs) counterMap[counterAddr].lastTs = blockTime

      // Direction: center lost SOL & counter gained → outflow to counter
      if (centerDelta < -0.0001 && counterDelta > 0.0001) {
        counterMap[counterAddr].recvSol += Math.abs(counterDelta)
      } else if (centerDelta > 0.0001 && counterDelta < -0.0001) {
        counterMap[counterAddr].sentSol += Math.abs(counterDelta)
      }
    })
  })

  // 3. Build nodes — top 14 counterparties by txCount (reference behavior)
  const topCounters = Object.entries(counterMap)
    .sort((a, b) => b[1].txCount - a[1].txCount)
    .slice(0, 14)

  // Total absolute flow for distribusi share
  const totalFlowSol = topCounters.reduce((s, [, st]) => s + st.sentSol + st.recvSol, 0)
  const byFlow = [...topCounters].sort((a, b) => (b[1].sentSol + b[1].recvSol) - (a[1].sentSol + a[1].recvSol))
  const rankOf = new Map<string, number>()
  byFlow.forEach(([cAddr], idx) => rankOf.set(cAddr, idx + 1))

  const nodes: WgNode[] = [{
    id: addr,
    label: shortA(addr),
    fullAddr: addr,
    isCenter: true,
    type: 'center',
    counterType: 'wallet',
    counterCat: 'wallet',
    sentSol: 0, recvSol: 0, sentUsd: 0, recvUsd: 0,
    txCount: sigs.length,
    lastTs: sigs[0]?.blockTime || 0,
    lastAgo: sigs[0]?.blockTime ? timeAgo(sigs[0].blockTime) : '?',
    color: '#f59e0b',
    r: 38,
    sharePct: 0,
    rank: 0,
  }]

  const edges: WgEdge[] = []
  for (const [cAddr, stats] of topCounters) {
    const known = KNOWN_ADDRS[cAddr]
    const counterCat: WgCategory = known?.cat || 'wallet'
    const counterType: WgCounterType = known && known.cat !== 'wallet' ? 'program' : 'wallet'
    const label = known ? known.label : shortA(cAddr)
    const type: WgNode['type'] = stats.recvSol > stats.sentSol ? 'outflow'
      : stats.sentSol > stats.recvSol ? 'inflow' : 'mixed'

    const nodeColor = counterType === 'program'
      ? (counterCat === 'dex' ? '#a855f7' : counterCat === 'exchange' ? '#f97316' : counterCat === 'stake' ? '#06b6d4' : counterCat === 'lending' ? '#84cc16' : '#94a3b8')
      : (type === 'outflow' ? '#ef4444' : type === 'inflow' ? '#22c55e' : '#60a5fa')

    const flowSol = stats.sentSol + stats.recvSol
    nodes.push({
      id: cAddr, label, fullAddr: cAddr, isCenter: false,
      type, counterType, counterCat,
      sentSol: +stats.sentSol.toFixed(4),
      recvSol: +stats.recvSol.toFixed(4),
      sentUsd: usd(stats.sentSol),
      recvUsd: usd(stats.recvSol),
      txCount: stats.txCount,
      lastTs: stats.lastTs,
      lastAgo: stats.lastTs ? timeAgo(stats.lastTs) : '?',
      color: nodeColor,
      r: Math.max(14, Math.min(32, 10 + stats.txCount * 2.5)),
      sharePct: totalFlowSol > 0 ? +((flowSol / totalFlowSol) * 100).toFixed(1) : 0,
      rank: rankOf.get(cAddr) || 0,
    })

    if (stats.recvSol > 0.001) {
      const txType = classifyTxType(-stats.recvSol, counterCat, counterType)
      edges.push({ from: addr, to: cAddr, sol: +stats.recvSol.toFixed(4), usd: usd(stats.recvSol), dir: 'out', txType, label: `−${stats.recvSol.toFixed(2)} SOL` })
    }
    if (stats.sentSol > 0.001) {
      const txType = classifyTxType(+stats.sentSol, counterCat, counterType)
      edges.push({ from: cAddr, to: addr, sol: +stats.sentSol.toFixed(4), usd: usd(stats.sentSol), dir: 'in', txType, label: `+${stats.sentSol.toFixed(2)} SOL` })
    }
    if (stats.recvSol <= 0.001 && stats.sentSol <= 0.001 && stats.txCount > 0) {
      edges.push({ from: addr, to: cAddr, sol: 0, usd: 0, dir: 'swap', txType: 'swap', label: `${stats.txCount}× swap` })
    }
  }

  // 4. Per-tx ledger (rekening koran)
  const ledger: WgLedgerRow[] = []
  txResults.forEach((tx: any, i: number) => {
    if (!tx?.meta || !tx.transaction) return
    const sig = sigs[i]
    if (!sig) return
    const accounts = accountsOf(tx)
    const pre: number[] = tx.meta.preBalances || []
    const post: number[] = tx.meta.postBalances || []
    const centerIdx = accounts.findIndex(a => a === addr)
    if (centerIdx < 0) return

    const preSol = pre[centerIdx] / 1e9
    const postSol = post[centerIdx] / 1e9
    const delta = postSol - preSol
    const fee = (tx.meta.fee || 0) / 1e9

    // Main counterparty = biggest absolute SOL change (non-center, non-system)
    let counterAddr: string | null = null
    let counterDelta = 0
    accounts.forEach((a, j) => {
      if (a === addr) return
      if (SYSTEM_PROGRAMS.includes(a)) return
      if (j >= pre.length || j >= post.length) return
      const d = Math.abs((post[j] - pre[j]) / 1e9)
      if (d > counterDelta) { counterDelta = d; counterAddr = a }
    })

    const known = counterAddr ? KNOWN_ADDRS[counterAddr] : null
    const counterCat: WgCategory = known?.cat || 'wallet'
    const counterType: WgCounterType = known && known.cat !== 'wallet' ? 'program' : 'wallet'
    const counterLabel = known
      ? known.label
      : counterAddr ? shortA(counterAddr) : 'Protocol/Fee'

    const baseType: WgLedgerRow['type'] = Math.abs(delta) < 0.000001 ? 'swap' : delta > 0 ? 'credit' : 'debit'
    const txType = classifyTxType(delta, counterCat, counterType)

    ledger.push({
      sig: sig.signature,
      shortSig: sig.signature.slice(0, 8) + '…' + sig.signature.slice(-5),
      blockTime: sig.blockTime || 0,
      dateStr: sig.blockTime
        ? new Date(sig.blockTime * 1000).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—',
      timeAgo: sig.blockTime ? timeAgo(sig.blockTime) : '?',
      status: sig.err ? 'failed' : 'success',
      type: baseType,
      txType,
      counterType,
      counterCat,
      solDelta: +delta.toFixed(6),
      solDeltaAbs: +Math.abs(delta).toFixed(6),
      usdAbs: usd(Math.abs(delta)),
      fee: +fee.toFixed(6),
      balanceAfter: +postSol.toFixed(6),
      counterAddr,
      counterLabel,
      solscanUrl: `https://solscan.io/tx/${sig.signature}`,
    })
  })

  // Distribusi detection: 3+ transfer_out at same blockTime → distribute
  const blockTimeCounts: Record<number, number> = {}
  ledger.forEach(r => {
    if (r.txType === 'transfer_out' && r.blockTime) blockTimeCounts[r.blockTime] = (blockTimeCounts[r.blockTime] || 0) + 1
  })
  let distributionEvents = 0
  ledger.forEach(r => {
    if (r.txType === 'transfer_out' && r.blockTime && blockTimeCounts[r.blockTime] >= 3) {
      r.txType = 'distribute'
    }
  })
  distributionEvents = Object.values(blockTimeCounts).filter(c => c >= 3).length

  // Chronological sort for running balance, then newest-first for display
  ledger.sort((a, b) => a.blockTime - b.blockTime)
  const ledgerDesc = [...ledger].reverse()

  // 5. Insights — all derived from real parsed data
  const movements = ledger.filter(r => r.solDeltaAbs > 0.000001 && r.status === 'success')
  const totalInSol = movements.filter(r => r.solDelta > 0).reduce((s, r) => s + r.solDeltaAbs, 0)
  const totalOutSol = movements.filter(r => r.solDelta < 0).reduce((s, r) => s + r.solDeltaAbs, 0)
  const biggest = movements.length ? movements.reduce((a, b) => (b.solDeltaAbs > a.solDeltaAbs ? b : a)) : null
  const smallest = movements.length ? movements.reduce((a, b) => (b.solDeltaAbs < a.solDeltaAbs ? b : a)) : null
  const windowStart = ledger.length ? ledger[0].blockTime : 0
  const windowEnd = ledger.length ? ledger[ledger.length - 1].blockTime : 0
  const windowHours = windowEnd > windowStart ? (windowEnd - windowStart) / 3600 : 0
  const firstCredit = ledger.find(r => r.solDelta > 0.000001 && r.status === 'success')

  const toBiggestTx = (r: WgLedgerRow | null): WgBiggestTx | null => r ? {
    sol: r.solDeltaAbs, usd: r.usdAbs, counterLabel: r.counterLabel, counterAddr: r.counterAddr,
    sig: r.sig, timeAgo: r.timeAgo, txType: r.txType,
  } : null

  const cexPeers = nodes.filter(n => !n.isCenter && n.counterCat === 'exchange')
  const dexPeers = nodes.filter(n => !n.isCenter && n.counterCat === 'dex')
  const peerNodes = nodes.filter(n => !n.isCenter)
  const topPeerFlow = peerNodes.length
    ? Math.max(...peerNodes.map(n => n.sentSol + n.recvSol))
    : 0

  const insights: WgInsights = {
    totalInSol: +totalInSol.toFixed(4),
    totalOutSol: +totalOutSol.toFixed(4),
    netSol: +(totalInSol - totalOutSol).toFixed(4),
    totalInUsd: usd(totalInSol),
    totalOutUsd: usd(totalOutSol),
    netUsd: usd(totalInSol - totalOutSol),
    biggestTx: toBiggestTx(biggest),
    smallestTx: toBiggestTx(smallest),
    windowStart,
    windowEnd,
    windowLabel: windowHours >= 24
      ? `${(windowHours / 24).toFixed(1)} hari terakhir`
      : windowHours >= 1 ? `${windowHours.toFixed(1)} jam terakhir` : `${Math.max(1, Math.round(windowHours * 60))} menit terakhir`,
    firstFunder: firstCredit ? {
      label: firstCredit.counterLabel, addr: firstCredit.counterAddr,
      sol: firstCredit.solDeltaAbs, timeAgo: firstCredit.timeAgo,
    } : null,
    cexExposure: {
      count: cexPeers.reduce((s, n) => s + n.txCount, 0),
      sol: +(cexPeers.reduce((s, n) => s + n.sentSol + n.recvSol, 0)).toFixed(4),
      labels: cexPeers.map(n => n.label),
    },
    dexActivity: {
      count: dexPeers.reduce((s, n) => s + n.txCount, 0),
      sol: +(dexPeers.reduce((s, n) => s + n.sentSol + n.recvSol, 0)).toFixed(4),
    },
    distributionEvents,
    programCount: peerNodes.filter(n => n.counterType === 'program').length,
    walletCount: peerNodes.filter(n => n.counterType === 'wallet').length,
    topPeerConcentrationPct: totalFlowSol > 0 ? +((topPeerFlow / totalFlowSol) * 100).toFixed(1) : 0,
    txPerHour: windowHours > 0 ? +(ledger.length / windowHours).toFixed(1) : ledger.length,
    totalFeesSol: +ledger.reduce((s, r) => s + r.fee, 0).toFixed(6),
  }

  // 6. Real pattern detection
  const patterns: WgPattern[] = []
  if (distributionEvents > 0) {
    const distCount = ledger.filter(r => r.txType === 'distribute').length
    patterns.push({ sev: 'high', icon: '📤', text: `Distribusi Terdeteksi · ${distCount} transfer keluar serentak (${distributionEvents} event)` })
  }
  // Identical-amount clusters (sybil/airdrop hint)
  const amtGroups: Record<string, number> = {}
  movements.filter(r => ['transfer_in', 'transfer_out', 'distribute'].includes(r.txType))
    .forEach(r => { const k = r.solDeltaAbs.toFixed(4); amtGroups[k] = (amtGroups[k] || 0) + 1 })
  const identical = Object.entries(amtGroups).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1])[0]
  if (identical) {
    patterns.push({ sev: 'med', icon: '🔁', text: `Round-Number Distribusi · ${identical[1]}× transfer identik ${identical[0]} ◎ — possible sybil/airdrop` })
  }
  if (insights.cexExposure.count > 0) {
    patterns.push({ sev: 'info', icon: '🏦', text: `Exchange Exposure · ${insights.cexExposure.labels.join(', ')} (${insights.cexExposure.count} tx)` })
  }
  if (insights.txPerHour >= 10) {
    patterns.push({ sev: 'med', icon: '⏱', text: `Aktivitas Bot-like · ${insights.txPerHour} tx/jam dalam window` })
  }
  const totalPeerTx = peerNodes.reduce((s, n) => s + n.txCount, 0)
  if (totalPeerTx > 0 && insights.dexActivity.count / totalPeerTx > 0.5) {
    patterns.push({ sev: 'info', icon: '🔄', text: `DEX-heavy · ${Math.round((insights.dexActivity.count / totalPeerTx) * 100)}% interaksi via DEX/AMM` })
  }
  if (insights.topPeerConcentrationPct >= 60 && peerNodes.length > 1) {
    const top = peerNodes.find(n => (n.sentSol + n.recvSol) === topPeerFlow)
    patterns.push({ sev: 'med', icon: '🎯', text: `Flow Terkonsentrasi · ${insights.topPeerConcentrationPct}% volume ke/dari ${top?.label || '1 peer'}` })
  }

  const result: WalletGraphResponse = {
    ok: true,
    center: addr,
    shortAddr: shortA(addr),
    nodes,
    edges,
    ledger: ledgerDesc,
    insights,
    patterns,
    txCount: sigs.length,
    parsedTxCount: txResults.filter(Boolean).length,
    solPrice,
    fetchedAt: new Date().toISOString(),
  }
  graphCache.set(cacheKey, { ts: Date.now(), data: result })
  return result
}
