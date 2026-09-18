// API route to serve auto-trader state from crypto-scanner
// Live status server: 127.0.0.1:3002/trader/state (started by auto-trader.js)
// Fallback: read futures-trader-state.json / auto-trader-state.json from source dir
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const SOURCE_DIR = '/Users/radityakusuma/Documents/crypto-scanner'
const STATUS_URLS = [
  'http://127.0.0.1:3002/trader/state',
  'http://127.0.0.1:3001/trader/state',
]

interface PositionInfo {
  coinId: string
  coinSymbol: string
  side: string
  entryPrice: number
  currentPrice?: number
  pnlUsd: number
  sizeUsd: number
  stopLoss?: number
  tp1?: number
  tp2?: number
  trailActive?: boolean
  tp1Hit?: boolean
  tp2Hit?: boolean
}

interface TraderState {
  ok: boolean
  source: 'live' | 'file' | 'error'
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
  positions: PositionInfo[]
  recentTrades: any[]
  stats: {
    totalTrades: number
    wins: number
    losses: number
    totalPnlUsd: number
    bestTrade: number
    worstTrade: number
  }
  config: {
    riskPct: number
    maxPositions: number
    effectiveMaxPos: number
    maxDailyLoss: number
    leverage?: number
  }
}

async function fetchLiveState(): Promise<TraderState | null> {
  for (const url of STATUS_URLS) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2500)
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
      clearTimeout(timeout)
      if (!res.ok) continue
      const raw = await res.json()
      if (!raw || typeof raw !== 'object') continue

      const stats = raw.stats || {}
      const config = raw.config || {}
      const drawdownPct =
        typeof raw.drawdownPct === 'number'
          ? raw.drawdownPct
          : raw.peakEquity > 0
            ? ((raw.peakEquity - raw.totalEquity) / raw.peakEquity) * 100
            : 0

      return {
        ok: true,
        source: 'live',
        running: !!raw.running,
        dryRun: raw.dryRun !== false,
        circuitBreaker: !!raw.circuitBreaker,
        totalEquity: Number(raw.totalEquity) || 0,
        peakEquity: Number(raw.peakEquity) || 0,
        dailyPnl: Number(raw.dailyPnl) || 0,
        totalPnl: Number(raw.totalPnl ?? stats.totalPnlUsd) || 0,
        drawdownPct: Number(drawdownPct) || 0,
        consecutiveLoss: Number(raw.consecutiveLoss) || 0,
        marketRegime: raw.marketRegime || 'unknown',
        positions: Array.isArray(raw.positions)
          ? raw.positions.map((p: any) => ({
              coinId: p.coinId,
              coinSymbol: p.coinSymbol,
              side: p.side,
              entryPrice: Number(p.entryPrice) || 0,
              currentPrice: Number(p.currentPrice) || Number(p.entryPrice) || 0,
              pnlUsd: Number(p.pnlUsd) || 0,
              sizeUsd: Number(p.sizeUsd) || 0,
              stopLoss: Number(p.stopLoss) || 0,
              tp1: Number(p.tp1) || 0,
              tp2: Number(p.tp2) || 0,
              trailActive: !!p.trailActive,
              tp1Hit: !!p.tp1Hit,
              tp2Hit: !!p.tp2Hit,
            }))
          : [],
        recentTrades: Array.isArray(raw.recentTrades) ? raw.recentTrades : [],
        stats: {
          totalTrades: Number(stats.totalTrades) || 0,
          wins: Number(stats.wins) || 0,
          losses: Number(stats.losses) || 0,
          totalPnlUsd: Number(stats.totalPnlUsd) || 0,
          bestTrade: Number(stats.bestTrade) || 0,
          worstTrade: Number(stats.worstTrade) || 0,
        },
        config: {
          riskPct: Number(config.riskPct) || 1.5,
          maxPositions: Number(config.maxPositions) || 5,
          effectiveMaxPos: Number(config.effectiveMaxPos) || Number(config.maxPositions) || 5,
          maxDailyLoss: Number(config.maxDailyLoss) || 5,
          leverage: config.leverage ? Number(config.leverage) : undefined,
        },
      }
    } catch {
      // try next URL
    }
  }
  return null
}

function readFileState(): TraderState | null {
  const candidates = [
    path.join(SOURCE_DIR, 'auto-trader-state.json'),
    path.join(SOURCE_DIR, 'futures-trader-state.json'),
  ]
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'))
      if (!raw || typeof raw !== 'object') continue

      // auto-trader-state.json uses `trades` + `positions` object; futures uses flat equity
      const isFlat = typeof raw.equity === 'number'
      const totalEquity = isFlat ? raw.equity : Number(raw.totalEquity) || 0
      const peakEquity = isFlat ? raw.peakEquity : Number(raw.peakEquity) || totalEquity
      const stats = raw.stats || {}
      const trades = Array.isArray(raw.trades) ? raw.trades : []
      const positions = Array.isArray(raw.positions)
        ? raw.positions
        : Object.values(raw.positions || {})

      const drawdownPct = peakEquity > 0 ? ((peakEquity - totalEquity) / peakEquity) * 100 : 0

      return {
        ok: true,
        source: 'file',
        running: !!raw.running,
        dryRun: raw.dryRun !== false,
        circuitBreaker: !!raw.circuitBreaker,
        totalEquity,
        peakEquity,
        dailyPnl: Number(raw.dailyPnl) || 0,
        totalPnl: Number(raw.totalPnl ?? stats.totalPnlUsd) || 0,
        drawdownPct,
        consecutiveLoss: Number(raw.consecutiveLoss) || 0,
        marketRegime: raw.marketRegime || 'unknown',
        positions: positions.map((p: any) => ({
          coinId: p.coinId,
          coinSymbol: p.coinSymbol,
          side: p.side,
          entryPrice: Number(p.entryPrice) || 0,
          currentPrice: Number(p.currentPrice) || Number(p.entryPrice) || 0,
          pnlUsd: Number(p.pnlUsd) || 0,
          sizeUsd: Number(p.sizeUsd) || 0,
          stopLoss: Number(p.stopLoss) || 0,
          tp1: Number(p.tp1) || 0,
          tp2: Number(p.tp2) || 0,
          trailActive: !!p.trailActive,
          tp1Hit: !!p.tp1Hit,
          tp2Hit: !!p.tp2Hit,
        })),
        recentTrades: trades.slice(0, 20),
        stats: {
          totalTrades: Number(raw.totalTrades ?? stats.totalTrades) || 0,
          wins: Number(raw.wins ?? stats.wins) || 0,
          losses: Number(raw.losses ?? stats.losses) || 0,
          totalPnlUsd: Number(stats.totalPnlUsd) || 0,
          bestTrade: Number(stats.bestTrade) || 0,
          worstTrade: Number(stats.worstTrade) || 0,
        },
        config: raw.config
          ? {
              riskPct: Number(raw.config.riskPct) || 1.5,
              maxPositions: Number(raw.config.maxPositions) || 5,
              effectiveMaxPos: Number(raw.config.effectiveMaxPos) || Number(raw.config.maxPositions) || 5,
              maxDailyLoss: Number(raw.config.maxDailyLoss) || 5,
              leverage: raw.config.leverage ? Number(raw.config.leverage) : undefined,
            }
          : { riskPct: 1.5, maxPositions: 5, effectiveMaxPos: 5, maxDailyLoss: 5 },
      }
    } catch {
      // try next file
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const live = await fetchLiveState()
  if (live) return NextResponse.json(live)

  const file = readFileState()
  if (file) return NextResponse.json(file)

  return NextResponse.json({
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
  } as TraderState)
}

export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action')
  const endpoints: Record<string, string> = {
    'close-all': '/trader/close-all',
    'reset-circuit': '/trader/reset-circuit',
  }
  const pathName = endpoints[action || '']
  if (!pathName) {
    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
  }

  let lastError = 'Trader server unreachable'
  for (const base of ['http://127.0.0.1:3002', 'http://127.0.0.1:3001']) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(`${base}${pathName}`, {
        method: 'POST',
        signal: controller.signal,
        cache: 'no-store',
      })
      clearTimeout(timeout)
      const body = await res.json().catch(() => ({}))
      return NextResponse.json({ ok: res.ok, ...body })
    } catch (e: any) {
      lastError = e?.message || lastError
    }
  }

  return NextResponse.json({ ok: false, error: lastError }, { status: 502 })
}