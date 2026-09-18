"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import type { BrutalSignal, PendingOrder } from './brutalEngine'

export interface BrutalStats {
  total: number
  long: number
  short: number
  neutral: number
  execute: number
  waiting: number
  pending: number
  triggered: number
}

export interface AutoPosition {
  coinId: string
  coinSymbol: string
  side: string
  entryPrice: number
  currentPrice: number
  pnlUsd: number
  sizeUsd: number
  stopLoss: number
  tp1: number
  tp2: number
  trailActive: boolean
  tp1Hit: boolean
  tp2Hit: boolean
  // SATU SALDO: margin accounting (brutal futures pakai leverage > 1)
  leverage?: number
  marginUsd?: number
  notionalUsd?: number
  liquidationPrice?: number | null
  source?: string
}

export interface AutoTrade {
  coinId: string
  coinSymbol: string
  side: string
  entryPrice: number
  exitPrice: number
  pnlUsd: number
  /** ROE — return atas margin yang dikunci (bukan atas notional). */
  pnlPct: number
  reason: string
  openedAt?: string
  closedAt?: string
  sizeUsd?: number
  source?: string
  leverage?: number
  marginUsd?: number
}

/** Kontribusi satu sumber sinyal ke saldo bersama. */
export interface SourcePnl {
  key: string
  source: string
  realized: number
  unrealized: number
  margin: number
  trades: number
  wins: number
  losses: number
  openPositions: number
}

/** SATU dompet untuk sinyal normal + brutal futures. */
export interface Wallet {
  initialCapital: number
  balance: number
  equity: number
  usedMargin: number
  freeMargin: number
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  returnPct: number
  bySource: SourcePnl[]
}

export interface AutoTraderState {
  ok: boolean
  source: 'live' | 'file' | 'paper' | 'error'
  running: boolean
  dryRun: boolean
  circuitBreaker: boolean
  totalEquity: number
  peakEquity: number
  dailyPnl: number
  totalPnl: number
  drawdownPct: number
  consecutiveLoss: number
  marketRegime: string
  positions: AutoPosition[]
  recentTrades: AutoTrade[]
  stats: {
    totalTrades: number
    wins: number
    losses: number
    totalPnlUsd: number
    realizedPnlUsd?: number
    unrealizedPnlUsd?: number
    bestTrade: number
    worstTrade: number
  }
  config: {
    riskPct: number
    maxPositions: number
    effectiveMaxPos: number
    maxDailyLoss: number
    leverage?: number
    maxLeverage?: number
    maxNotionalX?: number
  }
  activities?: Array<{ time: string; type: string; message: string; tone?: 'good' | 'warn' | 'bad' }>
  /**
   * Vonis gerbang eksekusi per coin, hasil akhir `valid()` di paperTrader.
   * `pass:false` = coin TIDAK memenuhi kriteria eksekusi (beserta alasan persis),
   * dipakai dashboard untuk memajukan antrian scan ke coin berikutnya.
   */
  gateVerdicts?: Record<string, { pass: boolean; reason: string; at: string; signal: string; confidence: number }>
  // SATU SALDO — kas = modal + seluruh realized PnL (normal & brutal futures)
  balance?: number
  capital?: number
  wallet?: Wallet
  // BRUTAL FUTURES MODE
  brutalMode?: boolean
  brutalSignals?: BrutalSignal[]
  pendingOrders?: PendingOrder[]
  brutalStats?: BrutalStats | null
  brutalRegime?: string
  brutalScannedAt?: string
  brutalSource?: string
  signalSource?: string
}

export function useAutoTrader(pollMs = 5000) {
  const [state, setState] = useState<AutoTraderState | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/auto-trader', { cache: 'no-store' })
      const data = await res.json()
      setState(data)
    } catch {
      setState((prev) =>
        prev || {
          ok: false,
          source: 'error',
          running: false,
          dryRun: true,
          circuitBreaker: false,
          totalEquity: 0,
          peakEquity: 0,
          dailyPnl: 0,
          totalPnl: 0,
          drawdownPct: 0,
          consecutiveLoss: 0,
          marketRegime: 'unknown',
          positions: [],
          recentTrades: [],
          stats: { totalTrades: 0, wins: 0, losses: 0, totalPnlUsd: 0, bestTrade: 0, worstTrade: 0 },
          config: { riskPct: 1.5, maxPositions: 5, effectiveMaxPos: 5, maxDailyLoss: 5 },
        }
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchState()
    pollRef.current = setInterval(fetchState, pollMs)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchState, pollMs])

  const runAction = useCallback(
    async (action: 'close-all' | 'reset-circuit') => {
      setActing(action)
      try {
        const res = await fetch(`/api/auto-trader?action=${action}`, { method: 'POST' })
        await res.json()
        await fetchState()
      } catch {
        // keep last state
      } finally {
        setActing(null)
      }
    },
    [fetchState]
  )

  return { state, loading, acting, refetch: fetchState, runAction }
}
