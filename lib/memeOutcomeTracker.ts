// ══════════════════════════════════════════════════════════════════════════
//  MEME OUTCOME TRACKER — spec §4 (WAJIB, supaya formula bisa dikalibrasi ulang)
//
//  Stores every evaluated alert (STRONG/WATCH/WEAK/REJECT) together with its
//  market cap at first sight, then periodically re-checks the MC of the same
//  contract (hourly, up to 24h) via DexScreener to learn the real outcome.
//  After 24h the final outcome is computed: drawdown from firstMc/peak, then
//  compared against the initial `decision` to see whether the formula was
//  "right". Without this, the scoring formula is just an unvalidated guess.
//
//  State lives in a globalThis singleton (same pattern as paperTrader.ts so
//  it survives dev hot-reload) — but it is a SEPARATE store; paperTrader
//  state is never touched or reused.
// ══════════════════════════════════════════════════════════════════════════
import type { MemeAlert, MemeDecision } from './memeScanner'

// ─── §4 · Tracked outcome schema ──────────────────────────────────────────
export type TrackedOutcome = {
  contractAddress: string
  firstSeenAt: string
  firstMc: number
  decision: 'STRONG' | 'WATCH' | 'WEAK' | 'REJECT'
  score: number
  checkpoints: Array<{ at: string; mc: number }>  // filled by the cron job
  // ── extra context (not in the minimal spec type, but needed to judge the
  //    formula later without re-fetching the original alert) ──
  symbol: string
  name: string
  chain: string
  category: string
  reason: string
  /** Set once the 24h window closes: peak MC, max drawdown from peak, and
   *  whether the initial decision looks validated in hindsight. */
  finalOutcome?: {
    computedAt: string
    peakMc: number
    lastMc: number
    changeFromFirstPct: number
    drawdownFromPeakPct: number
    /** 'DOWN' = dropped ≥10% from peak (matches the historical dataset's
     *  "turun" definition); 'STABLE' otherwise; 'DEAD' = MC effectively gone. */
    result: 'STABLE' | 'DOWN' | 'DEAD'
    /** Was the initial decision directionally correct?
     *  STRONG/WATCH on STABLE = correct · WEAK/REJECT on DOWN/DEAD = correct. */
    decisionCorrect: boolean | null
  }
}

type TrackerState = {
  outcomes: Record<string, TrackedOutcome>   // keyed by contractAddress
  lastRefreshAt: string | null
  lastRefreshError: string | null
  refreshing: Promise<RefreshReport> | null
}

type RefreshReport = {
  at: string
  checked: number
  updated: number
  finalized: number
  errors: string[]
}

const TRACK_WINDOW_MS = 24 * 60 * 60 * 1000   // track each token for 24h
const MIN_CHECKPOINT_GAP_MS = 10 * 60 * 1000  // don't append checkpoints faster than every 10m
const MAX_TRACKED = 500                       // hard cap on in-memory store

// ─── globalThis singleton (same pattern as paperTrader.ts, SEPARATE state) ─
const globalKey = '__crypycryptMemeOutcomeTracker__' as const
const store = globalThis as typeof globalThis & { [globalKey]?: TrackerState }
function st(): TrackerState {
  return (store[globalKey] ??= { outcomes: {}, lastRefreshAt: null, lastRefreshError: null, refreshing: null })
}

// ─── Recording evaluated alerts ───────────────────────────────────────────
/**
 * Save an already-evaluated alert. Idempotent per contractAddress: the FIRST
 * sighting wins (firstMc/decision are the calibration baseline); later calls
 * only refresh nothing. Returns the stored record.
 */
export function trackAlert(alert: MemeAlert, decision: MemeDecision, score: number, reason: string): TrackedOutcome {
  const s = st()
  const key = alert.contractAddress
  const existing = s.outcomes[key]
  if (existing) return existing

  const rec: TrackedOutcome = {
    contractAddress: key,
    firstSeenAt: alert.timestamp || new Date().toISOString(),
    firstMc: alert.mcUsd || 0,
    decision,
    score,
    checkpoints: [],
    symbol: alert.symbol,
    name: alert.name,
    chain: alert.chain,
    category: alert.category,
    reason,
  }
  s.outcomes[key] = rec

  // Evict oldest finalized/expired records when the cap is hit
  const keys = Object.keys(s.outcomes)
  if (keys.length > MAX_TRACKED) {
    keys
      .map(k => s.outcomes[k])
      .sort((a, b) => Date.parse(a.firstSeenAt) - Date.parse(b.firstSeenAt))
      .slice(0, keys.length - MAX_TRACKED)
      .forEach(old => { delete s.outcomes[old.contractAddress] })
  }
  return rec
}

// ─── DexScreener MC fetch (self-contained; the legacy parsePair in
//     dexScreenerApi.ts expects a different response shape, so we read the
//     raw tokens endpoint directly) ────────────────────────────────────────
async function fetchCurrentMc(contractAddress: string): Promise<number | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrypyCrypt/1.0)', 'Accept': 'application/json' },
    })
    clearTimeout(timeoutId)
    if (!r.ok) return null
    const data: any = await r.json()
    const pairs: any[] = Array.isArray(data?.pairs) ? data.pairs : []
    if (!pairs.length) return null
    // Pick the deepest-liquidity pair, prefer marketCap then fdv
    const best = pairs
      .filter(p => p?.baseToken?.address?.toLowerCase() === contractAddress.toLowerCase() || p?.baseToken)
      .sort((a, b) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0]
    const mc = Number(best?.marketCap ?? best?.fdv ?? 0)
    return Number.isFinite(mc) && mc > 0 ? mc : null
  } catch {
    return null
  }
}

// ─── Final outcome computation (after the 24h window closes) ─────────────
function computeFinalOutcome(rec: TrackedOutcome): void {
  if (rec.finalOutcome) return
  const mcs = [rec.firstMc, ...rec.checkpoints.map(c => c.mc)].filter(m => Number.isFinite(m))
  if (!mcs.length) return
  const peakMc = Math.max(...mcs)
  const lastMc = mcs[mcs.length - 1]
  const changeFromFirstPct = rec.firstMc > 0 ? ((lastMc - rec.firstMc) / rec.firstMc) * 100 : 0
  const drawdownFromPeakPct = peakMc > 0 ? ((peakMc - lastMc) / peakMc) * 100 : 0

  // 'DEAD' = MC effectively gone (−95% from first sight); 'DOWN' matches the
  // historical dataset definition (turun ≥10% dari puncak)
  const result: 'STABLE' | 'DOWN' | 'DEAD' =
    rec.firstMc > 0 && lastMc <= rec.firstMc * 0.05 ? 'DEAD'
    : drawdownFromPeakPct >= 10 ? 'DOWN'
    : 'STABLE'

  // Directional correctness: STRONG/WATCH should land on STABLE;
  // WEAK/REJECT should land on DOWN/DEAD.
  const decisionCorrect =
    rec.decision === 'STRONG' || rec.decision === 'WATCH' ? result === 'STABLE'
    : result === 'DOWN' || result === 'DEAD'

  rec.finalOutcome = {
    computedAt: new Date().toISOString(),
    peakMc,
    lastMc,
    changeFromFirstPct: Math.round(changeFromFirstPct * 100) / 100,
    drawdownFromPeakPct: Math.round(drawdownFromPeakPct * 100) / 100,
    result,
    decisionCorrect,
  }
}

// ─── §4 · Cron-style refresh ──────────────────────────────────────────────
/**
 * Fetch the latest MC from DexScreener for every contractAddress whose
 * firstSeenAt is within the last 24 hours and append it to `checkpoints`.
 * Records older than 24h get their `finalOutcome` computed once. Concurrent
 * calls share a single in-flight promise (same guard style as the scanners).
 */
export async function refreshOutcomes(): Promise<RefreshReport> {
  const s = st()
  if (s.refreshing) return s.refreshing
  s.refreshing = (async () => {
    const report: RefreshReport = { at: new Date().toISOString(), checked: 0, updated: 0, finalized: 0, errors: [] }
    try {
      const now = Date.now()
      const records = Object.values(s.outcomes)
      // 1) Active window (<24h): fetch + append checkpoint
      const active = records.filter(r => !r.finalOutcome && now - Date.parse(r.firstSeenAt) < TRACK_WINDOW_MS)
      for (const rec of active) {
        report.checked++
        const last = rec.checkpoints[rec.checkpoints.length - 1]
        if (last && now - Date.parse(last.at) < MIN_CHECKPOINT_GAP_MS) continue
        const mc = await fetchCurrentMc(rec.contractAddress)
        if (mc == null) { report.errors.push(`${rec.symbol}: MC tidak tersedia`); continue }
        rec.checkpoints.push({ at: new Date().toISOString(), mc })
        report.updated++
        await new Promise(res => setTimeout(res, 250)) // be polite to the public API
      }
      // 2) Expired window (≥24h, no final yet): compute final outcome
      for (const rec of records) {
        if (!rec.finalOutcome && now - Date.parse(rec.firstSeenAt) >= TRACK_WINDOW_MS) {
          computeFinalOutcome(rec)
          if (rec.finalOutcome) report.finalized++
        }
      }
      s.lastRefreshAt = report.at
      s.lastRefreshError = report.errors.length ? report.errors.slice(0, 5).join('; ') : null
    } catch (err: any) {
      s.lastRefreshError = String(err?.message || err)
      report.errors.push(s.lastRefreshError)
    } finally {
      s.refreshing = null
    }
    return report
  })()
  return s.refreshing
}

// ─── Heartbeat (hourly cron, one timer per process — paperTrader pattern) ─
const hbKey = '__crypycryptMemeOutcomeHeartbeat__' as const
const hbStore = globalThis as typeof globalThis & { [hbKey]?: ReturnType<typeof setInterval> }
export function startMemeOutcomeHeartbeat(): void {
  if (hbStore[hbKey]) return
  hbStore[hbKey] = setInterval(() => { void refreshOutcomes() }, 60 * 60 * 1000)
  // Don't hold the Node process open just for this timer
  ;(hbStore[hbKey] as any)?.unref?.()
}

// ─── Snapshot for the dashboard ───────────────────────────────────────────
export type TrackerSnapshot = {
  lastRefreshAt: string | null
  lastRefreshError: string | null
  total: number
  active: number
  finalized: number
  byDecision: Record<MemeDecision, number>
  /** Calibration hit-rate over finalized outcomes, per decision bucket. */
  accuracy: { decision: MemeDecision; total: number; correct: number; pct: number | null }[]
  outcomes: TrackedOutcome[]
}

export function getTrackerSnapshot(): TrackerSnapshot {
  const s = st()
  const list = Object.values(s.outcomes).sort((a, b) => Date.parse(b.firstSeenAt) - Date.parse(a.firstSeenAt))
  const byDecision: Record<MemeDecision, number> = { STRONG: 0, WATCH: 0, WEAK: 0, REJECT: 0 }
  const accMap: Record<MemeDecision, { total: number; correct: number }> = {
    STRONG: { total: 0, correct: 0 }, WATCH: { total: 0, correct: 0 },
    WEAK: { total: 0, correct: 0 }, REJECT: { total: 0, correct: 0 },
  }
  let finalized = 0
  for (const r of list) {
    byDecision[r.decision] = (byDecision[r.decision] || 0) + 1
    if (r.finalOutcome) {
      finalized++
      accMap[r.decision].total++
      if (r.finalOutcome.decisionCorrect) accMap[r.decision].correct++
    }
  }
  return {
    lastRefreshAt: s.lastRefreshAt,
    lastRefreshError: s.lastRefreshError,
    total: list.length,
    active: list.length - finalized,
    finalized,
    byDecision,
    accuracy: (Object.keys(accMap) as MemeDecision[]).map(d => ({
      decision: d,
      total: accMap[d].total,
      correct: accMap[d].correct,
      pct: accMap[d].total ? Math.round((accMap[d].correct / accMap[d].total) * 100) : null,
    })),
    outcomes: list,
  }
}

/** Drop a tracked record (manual cleanup from the dashboard). */
export function forgetOutcome(contractAddress: string): boolean {
  const s = st()
  if (s.outcomes[contractAddress]) { delete s.outcomes[contractAddress]; return true }
  return false
}
