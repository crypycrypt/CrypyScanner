"use client"

// ══════════════════════════════════════════════════════════════════════════
// WALLET TRACER — 100% REAL ON-CHAIN DATA (Solana)
// Port + enrichment of crypto-scanner Smart Money → Wallet Graph tab.
// • Canvas force graph: drag, hover tooltip, click → Node Explorer,
//   double-click → map wallet itu (recursive drill-down)
// • ⚡ TERBESAR badge on biggest edge/node (real SOL value)
// • Distribusi share per peer, real ledger (rekening koran) + CSV export
// • Real insights: net flow, first funder, CEX exposure, window, fees
// • Real pattern detection: distribusi serentak, round-number sybil,
//   bot-like frequency, concentrated flow, DEX-heavy
// NO hardcoded wallet data — everything from /api/wallet-graph/:address
// ══════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { WalletGraphResponse, WgNode, WgLedgerRow, WgTxType } from '@/lib/walletGraph'

// ─── Physics types (canvas graph) ───────────────────────────────────────
interface PhysNode extends WgNode {
  x: number
  y: number
  vx: number
  vy: number
  pulse: number
  isBiggest?: boolean
  isSmallest?: boolean
}

interface PhysEdge {
  from: string
  to: string
  sol: number
  usd: number
  dir: 'in' | 'out' | 'swap'
  txType: WgTxType
  label: string
  a: PhysNode
  b: PhysNode
  isBiggest?: boolean
  animDur?: number
  animDelay?: number
}

// ─── TX badge meta (reference TX_META) ──────────────────────────────────
const TX_META: Record<string, { icon: string; label: string; bg: string; fg: string }> = {
  buy:           { icon: '🟢', label: 'BUY',          bg: 'rgba(34,197,94,.15)',  fg: '#22c55e' },
  sell:          { icon: '🔴', label: 'SELL',         bg: 'rgba(239,68,68,.15)',  fg: '#ef4444' },
  swap:          { icon: '🔵', label: 'SWAP',         bg: 'rgba(96,165,250,.15)', fg: '#60a5fa' },
  stake:         { icon: '🟣', label: 'STAKE',        bg: 'rgba(168,85,247,.15)', fg: '#a855f7' },
  unstake:       { icon: '🟡', label: 'UNSTAKE',      bg: 'rgba(234,179,8,.15)',  fg: '#eab308' },
  deposit_lend:  { icon: '🏦', label: 'LENDING+',     bg: 'rgba(132,204,22,.15)', fg: '#84cc16' },
  withdraw_lend: { icon: '🏦', label: 'LENDING−',     bg: 'rgba(251,146,60,.15)', fg: '#fb923c' },
  deposit_cex:   { icon: '🏦', label: 'DEPOSIT CEX',  bg: 'rgba(239,68,68,.15)',  fg: '#f87171' },
  withdraw_cex:  { icon: '🏦', label: 'WITHDRAW CEX', bg: 'rgba(34,197,94,.15)',  fg: '#4ade80' },
  transfer_out:  { icon: '➡',  label: 'TRANSFER',     bg: 'rgba(239,68,68,.10)',  fg: '#fca5a5' },
  transfer_in:   { icon: '⬅',  label: 'TRANSFER',     bg: 'rgba(34,197,94,.10)',  fg: '#86efac' },
  distribute:    { icon: '📤', label: 'DISTRIBUSI',   bg: 'rgba(251,191,36,.15)', fg: '#fbbf24' },
  fee:           { icon: '⚙️', label: 'FEE',          bg: 'rgba(100,116,139,.15)',fg: '#668078' },
  debit:         { icon: '⬆',  label: 'KELUAR',       bg: 'rgba(239,68,68,.10)',  fg: '#ef4444' },
  credit:        { icon: '⬇',  label: 'MASUK',        bg: 'rgba(34,197,94,.10)',  fg: '#22c55e' },
}

const CAT_ICON: Record<string, string> = { dex: '🔄', exchange: '🏦', stake: '🥩', lending: '🏗', system: '⚙️' }
const CAT_LABEL: Record<string, string> = { dex: 'DEX', exchange: 'CEX', stake: 'STAKE', lending: 'LEND', system: 'SYS' }

// Quick presets — real well-known Solana wallets (same as reference);
// data is always fetched live, nothing pre-baked.
const PRESETS: [string, string][] = [
  ['MobS6…aDSf', 'MobS6L5HhVJtxpeafDgREsweWFh53xFoUeP9pgbaDSf'],
  ['fNrJm…RFrJ', 'fNrJmJ1aQMx1vgnGwJcLWkUCBrDy7GF7ZpVqiXuRFrJ'],
  ['4hSXP…upzD', '4hSXPtxZgXFpo6Vxq9yqxNjcBoqWN3VoaPJWonUtupzD'],
]

const PER_PAGE = 10

function fmtUsd(v: number): string {
  if (!v) return '—'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`
  return `$${v.toFixed(2)}`
}

// ─── Component ───────────────────────────────────────────────────────────
export default function WalletTracer() {
  const [address, setAddress] = useState('')
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'mapped' | 'error'>('idle')
  const [data, setData] = useState<WalletGraphResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<WgNode | null>(null)
  const [ledgerPage, setLedgerPage] = useState(0)
  const [gaugeAngle, setGaugeAngle] = useState(-80)
  const [sweepKey, setSweepKey] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const physRef = useRef<{ nodes: PhysNode[]; edges: PhysEdge[]; maxSol: number }>({ nodes: [], edges: [], maxSol: 0 })
  const animRef = useRef<number | null>(null)
  const dragRef = useRef<{ idx: number; ox: number; oy: number; start: { mx: number; my: number } | null }>({ idx: -1, ox: 0, oy: 0, start: null })
  const hovRef = useRef(-1)
  const selectedRef = useRef<WgNode | null>(null)
  const dataRef = useRef<WalletGraphResponse | null>(null)
  const scanRef = useRef<(addr?: string) => void>(() => {})

  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { dataRef.current = data }, [data])

  // ── Real scan ────────────────────────────────────────────────────────
  const runScan = useCallback(async (addr?: string) => {
    const target = (addr ?? address).trim()
    if (target.length < 30) return
    setScanState('scanning')
    setError(null)
    setSelected(null)
    setLedgerPage(0)
    try {
      const r = await fetch(`/api/wallet-graph/${encodeURIComponent(target)}`)
      const d: WalletGraphResponse = await r.json()
      if (!d?.ok) throw new Error(d?.error || 'Gagal fetch data on-chain')
      setData(d)
      setAddress(target)
      setScanState('mapped')
      setSweepKey(k => k + 1)
    } catch (e: any) {
      setError(e?.message || 'Gagal fetch — coba lagi')
      setScanState('error')
    }
  }, [address])
  useEffect(() => { scanRef.current = runScan }, [runScan])

  // Auto-map first preset on mount (live fetch, nothing hardcoded)
  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    runScan(PRESETS[0][1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Activity gauge from real metrics
  useEffect(() => {
    if (!data?.insights) { setGaugeAngle(-80); return }
    const ins = data.insights
    let score = 10
    score += Math.min(30, ins.txPerHour * 1.5)
    score += Math.min(20, ins.topPeerConcentrationPct / 5)
    score += data.patterns.filter(p => p.sev === 'high').length * 15
    score += data.patterns.filter(p => p.sev === 'med').length * 8
    score += ins.distributionEvents * 10
    score = Math.max(4, Math.min(100, score))
    const t = setTimeout(() => setGaugeAngle(-80 + (score / 100) * 160), 350)
    return () => clearTimeout(t)
  }, [data])

  // ── Canvas graph build + animation loop (reference _drawFlowGraph) ───
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || !data || scanState !== 'mapped') return

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = wrap.clientWidth || 800
    const H = 500
    canvas.width = W
    canvas.height = H

    // Physics nodes
    const nodeMap: Record<string, PhysNode> = {}
    const physNodes: PhysNode[] = data.nodes.map((n, i) => {
      const angle = n.isCenter ? 0 : ((i - 1) / Math.max(data.nodes.length - 1, 1)) * Math.PI * 2
      const dist = n.isCenter ? 0 : 170 + Math.random() * 60
      const obj: PhysNode = {
        ...n,
        x: W / 2 + (n.isCenter ? 0 : Math.cos(angle) * dist),
        y: H / 2 + (n.isCenter ? 0 : Math.sin(angle) * dist),
        vx: 0, vy: 0,
        pulse: Math.random() * Math.PI * 2,
      }
      nodeMap[n.id] = obj
      return obj
    })

    const physEdges: PhysEdge[] = data.edges
      .map(e => ({
        ...e,
        a: nodeMap[e.from],
        b: nodeMap[e.to],
        animDur: 2200 + Math.random() * 900,
        animDelay: Math.random() * 2000,
      }))
      .filter(e => e.a && e.b)

    // Biggest edge by absolute SOL
    const maxSol = Math.max(0, ...physEdges.map(e => e.sol || 0))
    physEdges.forEach(e => { e.isBiggest = maxSol > 0 && e.sol === maxSol })
    physEdges.forEach(e => {
      if (e.isBiggest) {
        if (e.b) e.b.isBiggest = true
        if (e.a && !e.a.isCenter) e.a.isBiggest = true
      }
    })

    // Smallest real transfer → ▾ TERKECIL flag (mockup style)
    const solEdges = physEdges.filter(e => e.sol > 0)
    const minSol = solEdges.length ? Math.min(...solEdges.map(e => e.sol)) : 0
    if (minSol > 0 && solEdges.length > 1) {
      solEdges.filter(e => e.sol === minSol).forEach(e => {
        const peer = e.a.isCenter ? e.b : e.a
        if (peer && !peer.isCenter && !peer.isBiggest) peer.isSmallest = true
      })
    }

    physRef.current = { nodes: physNodes, edges: physEdges, maxSol }

    const getNode = (mx: number, my: number) =>
      physNodes.findIndex(n => Math.hypot(n.x - mx, n.y - my) < n.r + 6)

    // ── Mouse interactions ──
    const onDown = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = ev.clientX - rect.left, my = ev.clientY - rect.top
      const idx = getNode(mx, my)
      if (idx >= 0) {
        dragRef.current = { idx, ox: physNodes[idx].x - mx, oy: physNodes[idx].y - my, start: { mx, my } }
      }
    }
    const onUp = (ev: MouseEvent) => {
      const d = dragRef.current
      if (d.idx >= 0) {
        const rect = canvas.getBoundingClientRect()
        const mx = ev.clientX - rect.left, my = ev.clientY - rect.top
        const moved = d.start && Math.hypot(mx - d.start.mx, my - d.start.my) < 6
        if (moved) {
          const n = physNodes[d.idx]
          if (ev.detail === 2 && !n.isCenter) {
            // double-click → map wallet itu (drill-down)
            scanRef.current(n.id)
          } else {
            setSelected(n.isCenter ? data.nodes[0] : n)
          }
        }
        dragRef.current = { idx: -1, ox: 0, oy: 0, start: null }
      }
    }
    const onMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = ev.clientX - rect.left, my = ev.clientY - rect.top
      const d = dragRef.current
      if (d.idx >= 0) {
        physNodes[d.idx].x = mx + d.ox
        physNodes[d.idx].y = my + d.oy
        physNodes[d.idx].vx = physNodes[d.idx].vy = 0
        hideTip()
        return
      }
      hovRef.current = getNode(mx, my)
      const tip = tipRef.current
      if (hovRef.current >= 0 && tip) {
        const n = physNodes[hovRef.current]
        const dirLabel = n.isCenter ? '⭐ Wallet Dicari'
          : n.type === 'inflow' ? '⬇ Mengirim SOL ke wallet ini'
          : n.type === 'outflow' ? '⬆ Menerima SOL dari wallet ini'
          : '↔ Interaksi (swap/token)'
        const typeLbl = n.isCenter ? '' : n.counterType === 'program'
          ? `<div style="font-size:10px;color:#a855f7;margin-bottom:3px">⚙️ Program / Smart Contract · ${n.counterCat || ''}</div>`
          : `<div style="font-size:10px;color:#60a5fa;margin-bottom:3px">👤 User Wallet</div>`
        tip.style.display = 'block'
        tip.style.left = Math.min(mx + 14, W - 260) + 'px'
        tip.style.top = Math.max(my - 10, 4) + 'px'
        tip.innerHTML = `
          <div style="font-weight:700;color:${n.color};margin-bottom:4px">${dirLabel}</div>
          ${typeLbl}
          ${n.isBiggest ? `<div style="color:#fbbf24;font-size:11px;font-weight:700;margin-bottom:4px">⚡ Transaksi Terbesar (${maxSol} SOL)</div>` : ''}
          <div style="font-family:monospace;font-size:10px;color:#668078;word-break:break-all;margin-bottom:6px">${n.id}</div>
          ${n.txCount ? `<div style="font-size:11px;color:#8da59c">🔄 ${n.txCount} transaksi bersama</div>` : ''}
          ${n.recvSol > 0 ? `<div style="font-size:11px;color:#ef4444">⬆ Outflow: ${n.recvSol} SOL (${fmtUsd(n.recvUsd)}) diterima</div>` : ''}
          ${n.sentSol > 0 ? `<div style="font-size:11px;color:#22c55e">⬇ Inflow: ${n.sentSol} SOL (${fmtUsd(n.sentUsd)}) dikirim</div>` : ''}
          ${!n.isCenter && n.sharePct > 0 ? `<div style="font-size:11px;color:#fbbf24">📊 Distribusi: ${n.sharePct}% dari total flow</div>` : ''}
          ${n.lastAgo && n.lastAgo !== '?' ? `<div style="font-size:10px;color:#475569;margin-top:4px">Terakhir: ${n.lastAgo}</div>` : ''}
          ${!n.isCenter ? '<div style="font-size:10px;color:#3b82f6;margin-top:5px">Click → inspect · 2×Click → map flow</div>' : ''}`
      } else hideTip()
    }
    const onLeave = () => { hovRef.current = -1; hideTip() }
    const hideTip = () => { if (tipRef.current) tipRef.current.style.display = 'none' }

    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('mouseup', onUp)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)

    // ── Mockup palette (WALLET FLOW MAP restyle) ──
    const C = {
      target: '#f2b84b', inflow: '#33d17a', outflow: '#ef5350', interact: '#28e994',
      biggest: '#ffcf5e', smallest: '#59d7c9',
    }
    const edgeColor = (e: PhysEdge) =>
      e.isBiggest ? C.biggest : e.dir === 'in' ? C.inflow : e.dir === 'out' ? C.outflow : C.interact
    const nodeColor = (n: PhysNode) =>
      n.isCenter ? C.target
        : n.counterType === 'program' ? n.color
          : n.type === 'inflow' ? C.inflow
            : n.type === 'outflow' ? C.outflow
              : C.interact

    // Curved edge geometry — quadratic bezier, same curvature as the mockup
    function curveOf(ax: number, ay: number, bx: number, by: number) {
      return { cx: (ax + bx) / 2 + (ay - by) * 0.12, cy: (ay + by) / 2 - (ax - bx) * 0.12 }
    }
    function qPoint(ax: number, ay: number, cx: number, cy: number, bx: number, by: number, k: number) {
      const m = 1 - k
      return { x: m * m * ax + 2 * m * k * cx + k * k * bx, y: m * m * ay + 2 * m * k * cy + k * k * by }
    }

    // ── Edge renderer: curved line + arrowhead + traveling glow dot(s) ──
    function drawEdge(e: PhysEdge, phase: number, state: 'normal' | 'dim' | 'hi') {
      const a = e.a, b = e.b
      const col = edgeColor(e)
      const { cx, cy } = curveOf(a.x, a.y, b.x, b.y)
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const k0 = Math.min(0.18, a.r / dist)
      const k1 = 1 - Math.min(0.18, b.r / dist)
      const span = Math.max(0.05, k1 - k0)
      const dim = state === 'dim'

      ctx!.save()
      ctx!.lineCap = 'round'

      if (e.isBiggest && !dim) {
        // gold double halo (mockup biggest edge)
        ctx!.strokeStyle = '#ffcf5e2e'; ctx!.lineWidth = 12
        ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.quadraticCurveTo(cx, cy, b.x, b.y); ctx!.stroke()
        ctx!.strokeStyle = '#ffcf5e1a'; ctx!.lineWidth = 20
        ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.quadraticCurveTo(cx, cy, b.x, b.y); ctx!.stroke()
      }

      ctx!.globalAlpha = dim ? 0.08 : state === 'hi' ? 0.95 : 0.38
      ctx!.lineWidth = e.isBiggest ? 2.2 : state === 'hi' ? 1.8 : 1.1
      ctx!.strokeStyle = col
      ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.quadraticCurveTo(cx, cy, b.x, b.y); ctx!.stroke()

      // arrowhead oriented along the curve tangent
      const tip = qPoint(a.x, a.y, cx, cy, b.x, b.y, k1)
      const pre = qPoint(a.x, a.y, cx, cy, b.x, b.y, Math.max(k0, k1 - 0.03))
      const ang = Math.atan2(tip.y - pre.y, tip.x - pre.x)
      const hl = e.isBiggest ? 12 : 7.5
      ctx!.globalAlpha = dim ? 0.12 : 1
      ctx!.fillStyle = col
      ctx!.beginPath()
      ctx!.moveTo(tip.x, tip.y)
      ctx!.lineTo(tip.x - hl * Math.cos(ang - 0.42), tip.y - hl * Math.sin(ang - 0.42))
      ctx!.lineTo(tip.x - hl * Math.cos(ang + 0.42), tip.y - hl * Math.sin(ang + 0.42))
      ctx!.closePath(); ctx!.fill()

      // traveling glow dot(s): in = peer→center, out = center→peer, swap = ping-pong
      if (!dim) {
        let k = phase
        if (e.dir === 'swap') k = phase < 0.5 ? phase * 2 : (1 - phase) * 2
        const dotList = e.isBiggest ? [k, (k + 0.4) % 1] : [k]
        dotList.forEach((kk, di) => {
          const p = qPoint(a.x, a.y, cx, cy, b.x, b.y, k0 + span * kk)
          const dr = e.isBiggest ? (di === 0 ? 4.6 : 3.2) : 3
          const glow = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, dr * 3.2)
          glow.addColorStop(0, col + 'aa'); glow.addColorStop(1, col + '00')
          ctx!.globalAlpha = 1
          ctx!.fillStyle = glow; ctx!.beginPath(); ctx!.arc(p.x, p.y, dr * 3.2, 0, Math.PI * 2); ctx!.fill()
          ctx!.fillStyle = col; ctx!.beginPath(); ctx!.arc(p.x, p.y, dr, 0, Math.PI * 2); ctx!.fill()
          ctx!.fillStyle = '#ffffffbb'; ctx!.beginPath(); ctx!.arc(p.x - dr * .3, p.y - dr * .3, dr * .35, 0, Math.PI * 2); ctx!.fill()
        })
      }

      // label — gold pill for biggest, tinted mono text otherwise
      if (e.label && dist > 70 && !dim) {
        const mid = qPoint(a.x, a.y, cx, cy, b.x, b.y, k0 + span * 0.5)
        const nx = (b.x - a.x) / dist, ny = (b.y - a.y) / dist
        const off = e.isBiggest ? 20 : 13
        const lx = mid.x - ny * off, ly = mid.y + nx * off
        ctx!.globalAlpha = 1
        ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle'
        if (e.isBiggest) {
          ctx!.font = 'bold 10px ui-monospace, SFMono-Regular, monospace'
          const tw = ctx!.measureText('⚡ ' + e.label).width + 12
          ctx!.fillStyle = '#1a1206'; ctx!.strokeStyle = C.biggest; ctx!.lineWidth = 1
          ctx!.beginPath(); ctx!.roundRect(lx - tw / 2, ly - 9, tw, 18, 9); ctx!.fill(); ctx!.stroke()
          ctx!.fillStyle = C.biggest
          ctx!.fillText('⚡ ' + e.label, lx, ly)
        } else {
          ctx!.font = '600 9.5px ui-monospace, SFMono-Regular, monospace'
          ctx!.fillStyle = col
          ctx!.fillText(e.label.slice(0, 14), lx, ly)
        }
      }
      ctx!.restore()
    }

    // hex → rgba (safe fallback for non-hex colors)
    function hexA(hex: string, a: number) {
      const h = (hex || '').replace('#', '')
      const v = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
      if (!isFinite(v)) return hex
      return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${Math.max(0, Math.min(1, a))})`
    }

    // Aurora core — orbiting color blobs + rotating light curtain + specular.
    // Caller must clip to the node shape before calling.
    function auroraBlobs(x: number, y: number, r: number, col: string, t: number, seed: number, boost = 1) {
      ctx!.save()
      ctx!.globalCompositeOperation = 'lighter'
      const blobs = [
        { c: col, spd: .00042, rad: .38, size: 1.0, a: .34 },
        { c: col, spd: -.00031, rad: .52, size: .78, a: .22 },
        { c: '#8ef3dd', spd: .00023, rad: .30, size: .62, a: .13 },
      ]
      blobs.forEach((b, bi) => {
        const ang = t * b.spd + seed + bi * 2.1
        const bx = x + Math.cos(ang) * r * b.rad
        const by = y + Math.sin(ang * 1.27) * r * b.rad
        const br = Math.max(3, r * b.size)
        const g = ctx!.createRadialGradient(bx, by, 0, bx, by, br)
        g.addColorStop(0, hexA(b.c, b.a * boost))
        g.addColorStop(.5, hexA(b.c, b.a * .35 * boost))
        g.addColorStop(1, hexA(b.c, 0))
        ctx!.fillStyle = g
        ctx!.beginPath(); ctx!.arc(bx, by, br, 0, Math.PI * 2); ctx!.fill()
      })
      // slow rotating aurora curtain
      const ca = t * .00055 + seed
      const cg = ctx!.createLinearGradient(
        x + Math.cos(ca) * r, y + Math.sin(ca) * r,
        x - Math.cos(ca) * r, y - Math.sin(ca) * r)
      cg.addColorStop(0, hexA(col, 0))
      cg.addColorStop(.5, hexA(col, .15 * boost))
      cg.addColorStop(1, hexA(col, 0))
      ctx!.fillStyle = cg
      ctx!.beginPath(); ctx!.arc(x, y, r, 0, Math.PI * 2); ctx!.fill()
      // top-left specular
      const sg = ctx!.createRadialGradient(x - r * .35, y - r * .4, 0, x - r * .35, y - r * .4, r * .95)
      sg.addColorStop(0, 'rgba(255,255,255,.10)')
      sg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx!.fillStyle = sg
      ctx!.beginPath(); ctx!.arc(x, y, r, 0, Math.PI * 2); ctx!.fill()
      ctx!.restore()
    }

    let frame = 0
    function animate() {
      if (!document.body.contains(canvas)) return
      animRef.current = requestAnimationFrame(animate)
      frame++
      ctx!.clearRect(0, 0, W, H)

      // Grid
      ctx!.strokeStyle = 'rgba(30,41,59,.2)'; ctx!.lineWidth = .8
      for (let x = 0; x < W; x += 60) { ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, H); ctx!.stroke() }
      for (let y = 0; y < H; y += 60) { ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(W, y); ctx!.stroke() }

      const dragging = dragRef.current.idx

      // Physics
      for (let i = 0; i < physNodes.length; i++) {
        const ni = physNodes[i]
        for (let j = i + 1; j < physNodes.length; j++) {
          const nj = physNodes[j]
          const dx = nj.x - ni.x, dy = nj.y - ni.y, dist = Math.sqrt(dx * dx + dy * dy) || 1
          const minD = ni.r + nj.r + 50
          if (dist < minD) {
            const f = (minD - dist) / dist * .06
            if (i !== dragging) { ni.vx -= dx * f; ni.vy -= dy * f }
            if (j !== dragging) { nj.vx += dx * f; nj.vy += dy * f }
          }
        }
        if (i !== dragging && !ni.isCenter) {
          ni.vx += (W / 2 - ni.x) * .0008; ni.vy += (H / 2 - ni.y) * .0008
          ni.x += ni.vx; ni.y += ni.vy
          ni.vx *= .86; ni.vy *= .86
          ni.x = Math.max(ni.r + 10, Math.min(W - ni.r - 10, ni.x))
          ni.y = Math.max(ni.r + 10, Math.min(H - ni.r - 10, ni.y))
        } else if (ni.isCenter) {
          ni.x = W / 2; ni.y = H / 2
        }
      }

      // Edges — mockup style: curved bezier + traveling glow dots + hover hi/dim
      const now = performance.now()
      const hovNode = hovRef.current >= 0 ? physNodes[hovRef.current] : null
      const edgeState = (e: PhysEdge): 'normal' | 'dim' | 'hi' =>
        !hovNode ? 'normal' : (e.a === hovNode || e.b === hovNode) ? 'hi' : 'dim'
      const phaseOf = (e: PhysEdge) => {
        const dur = e.animDur || 2600
        return ((now + (e.animDelay || 0)) % dur) / dur
      }
      physEdges.filter(e => !e.isBiggest).forEach(e => drawEdge(e, phaseOf(e), edgeState(e)))
      physEdges.filter(e => e.isBiggest).forEach(e => drawEdge(e, phaseOf(e), edgeState(e)))

      // Nodes — mockup style: breathing, dashed spin rings, flags, amount below
      physNodes.forEach((n, i) => {
        const hov = i === hovRef.current
        const sel = selectedRef.current?.id === n.id
        n.pulse += .05
        const col = nodeColor(n)
        const isProgram = n.counterType === 'program' && !n.isCenter

        // breathe: 0 → −4px, 3.4s ease-in-out, staggered (mockup d1/d2)
        const bDelay = (i % 3) * 1100
        const by = n.isCenter ? 0 : -2 + Math.cos(((now + bDelay) % 3400) / 3400 * Math.PI * 2) * 2
        // target pulse: scale 1 → 1.045, 2.6s
        const cScale = n.isCenter ? 1 + .045 * (.5 - .5 * Math.cos((now % 2600) / 2600 * Math.PI * 2)) : 1

        const x = n.x
        const y = n.y + by
        const r = (n.r + (hov || sel ? 3 : 0)) * cScale

        // halo ring (mockup .halo — peer opacity 0 → 1 on hover) + soft outer glow
        ctx!.save()
        ctx!.globalAlpha = n.isCenter ? .18 : (hov || sel) ? .9 : 0
        ctx!.strokeStyle = col; ctx!.lineWidth = 1
        ctx!.beginPath(); ctx!.arc(x, y, r + 8, 0, Math.PI * 2); ctx!.stroke()
        ctx!.restore()

        const glow = ctx!.createRadialGradient(x, y, r * .6, x, y, r * 2.2)
        glow.addColorStop(0, hexA(col, n.isCenter ? .22 : hov || sel ? .2 : .1))
        glow.addColorStop(1, hexA(col, 0))
        ctx!.fillStyle = glow; ctx!.beginPath(); ctx!.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx!.fill()

        // ── Target: halo + two counter-rotating dashed rings + WALLET DICARI ──
        if (n.isCenter) {
          ctx!.fillStyle = C.target + '2e'
          ctx!.beginPath(); ctx!.arc(x, y, r + 14, 0, Math.PI * 2); ctx!.fill()

          ctx!.save(); ctx!.translate(x, y); ctx!.rotate((now / 5500) * Math.PI * 2)
          ctx!.strokeStyle = C.target + 'cc'; ctx!.lineWidth = 1.4; ctx!.setLineDash([2, 6])
          ctx!.beginPath(); ctx!.arc(0, 0, r + 9, 0, Math.PI * 2); ctx!.stroke()
          ctx!.restore()

          ctx!.save(); ctx!.translate(x, y); ctx!.rotate(-(now / 3400) * Math.PI * 2)
          ctx!.strokeStyle = C.target + '80'; ctx!.lineWidth = 1.2; ctx!.setLineDash([1, 5])
          ctx!.beginPath(); ctx!.arc(0, 0, r + 15, 0, Math.PI * 2); ctx!.stroke()
          ctx!.restore()
          ctx!.setLineDash([])

          ctx!.fillStyle = '#8da59c'; ctx!.font = '500 8px ui-monospace, SFMono-Regular, monospace'
          ctx!.textAlign = 'center'; ctx!.textBaseline = 'alphabetic'
          ctx!.fillText('WALLET DICARI', x, y - r - 18)
        }

        // ── Biggest peer: gold dashed ring spinCW 4.2s + ⚡ TERBESAR flag ──
        if (n.isBiggest && !n.isCenter) {
          ctx!.save(); ctx!.translate(x, y); ctx!.rotate((now / 4200) * Math.PI * 2)
          ctx!.strokeStyle = C.biggest; ctx!.lineWidth = 1.6; ctx!.setLineDash([1, 4])
          ctx!.beginPath(); ctx!.arc(0, 0, r + 8, 0, Math.PI * 2); ctx!.stroke()
          ctx!.restore(); ctx!.setLineDash([])
          ctx!.fillStyle = C.biggest; ctx!.font = '600 7.5px ui-monospace, SFMono-Regular, monospace'
          ctx!.textAlign = 'center'; ctx!.textBaseline = 'alphabetic'
          ctx!.fillText('⚡ TERBESAR', x, y - r - 13)
        }

        // ── Smallest peer: teal dashed ring spinCCW 4.6s + ▾ TERKECIL flag ──
        if (n.isSmallest && !n.isCenter && !n.isBiggest) {
          ctx!.save(); ctx!.translate(x, y); ctx!.rotate(-(now / 4600) * Math.PI * 2)
          ctx!.strokeStyle = C.smallest; ctx!.lineWidth = 1.6; ctx!.setLineDash([1, 4])
          ctx!.beginPath(); ctx!.arc(0, 0, r + 8, 0, Math.PI * 2); ctx!.stroke()
          ctx!.restore(); ctx!.setLineDash([])
          ctx!.fillStyle = C.smallest; ctx!.font = '600 7.5px ui-monospace, SFMono-Regular, monospace'
          ctx!.textAlign = 'center'; ctx!.textBaseline = 'alphabetic'
          ctx!.fillText('▾ TERKECIL', x, y - r - 13)
        }

        if (isProgram) {
          // Diamond (program / smart contract) — plain dark fill + aurora core
          const hr = r * .82
          ctx!.save()
          ctx!.translate(x, y); ctx!.rotate(Math.PI / 4)
          ctx!.beginPath(); ctx!.rect(-hr, -hr, hr * 2, hr * 2); ctx!.clip()
          ctx!.fillStyle = '#040d09'; ctx!.fillRect(-hr * 2, -hr * 2, hr * 4, hr * 4)
          auroraBlobs(0, 0, hr * 1.3, col, now, i * 1.7, hov || sel ? 1.3 : 1)
          ctx!.restore()

          ctx!.save(); ctx!.translate(x, y); ctx!.rotate(Math.PI / 4)
          ctx!.strokeStyle = col; ctx!.lineWidth = hov || sel ? 2 : 1.4
          ctx!.beginPath(); ctx!.rect(-hr, -hr, hr * 2, hr * 2); ctx!.stroke()
          ctx!.restore()

          ctx!.fillStyle = hexA(col, .95); ctx!.font = 'bold 9px sans-serif'
          ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle'
          ctx!.fillText(CAT_ICON[n.counterCat] || '⚙', x, y)
        } else {
          // Circle (wallet) — mockup .nodeCircle: dark fill, colored rim, aurora core
          ctx!.save()
          ctx!.beginPath(); ctx!.arc(x, y, r - .7, 0, Math.PI * 2); ctx!.clip()
          ctx!.fillStyle = n.isCenter ? '#20160a' : '#040d09'
          ctx!.fillRect(x - r, y - r, r * 2, r * 2)
          auroraBlobs(x, y, r, col, now, i * 1.7, hov || sel ? 1.35 : n.isCenter ? 1.15 : 1)
          if (n.isCenter) {
            // inner dashed ring (mockup .tcircle:before — spinCCW 6s)
            ctx!.save(); ctx!.translate(x, y); ctx!.rotate(-(now / 6000) * Math.PI * 2)
            ctx!.strokeStyle = hexA(C.target, .45); ctx!.lineWidth = 1; ctx!.setLineDash([2, 4])
            ctx!.beginPath(); ctx!.arc(0, 0, Math.max(4, r - 5), 0, Math.PI * 2); ctx!.stroke()
            ctx!.restore(); ctx!.setLineDash([])
          }
          ctx!.restore()

          ctx!.strokeStyle = col
          ctx!.lineWidth = n.isCenter ? 2 : hov || sel ? 1.9 : 1.4
          ctx!.beginPath(); ctx!.arc(x, y, r, 0, Math.PI * 2); ctx!.stroke()

          // hover brightness bump (mockup filter:brightness(1.3))
          if (hov || sel) {
            ctx!.fillStyle = hexA(col, .1)
            ctx!.beginPath(); ctx!.arc(x, y, r, 0, Math.PI * 2); ctx!.fill()
          }
        }

        // TX count badge
        if (!isProgram && !n.isCenter && n.txCount) {
          ctx!.fillStyle = '#0f172a'; ctx!.strokeStyle = col + '88'; ctx!.lineWidth = 1
          ctx!.beginPath(); ctx!.arc(x + r * .7, y - r * .7, 7, 0, Math.PI * 2); ctx!.fill(); ctx!.stroke()
          ctx!.fillStyle = col; ctx!.font = 'bold 8px sans-serif'
          ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle'
          ctx!.fillText(n.txCount > 99 ? '99+' : String(n.txCount), x + r * .7, y - r * .7)
        }

        // Label + amount below node (mockup .nodeLabel y+r+13 / .nodeAmt y+r+24)
        ctx!.textAlign = 'center'; ctx!.textBaseline = 'alphabetic'
        ctx!.fillStyle = hov || sel ? '#ffffff' : '#dcebe5'
        ctx!.font = `${hov || sel ? 700 : 500} 9.5px ui-monospace, SFMono-Regular, monospace`
        ctx!.fillText(String(n.label || '').slice(0, 14), x, y + r + 13)

        if (!n.isCenter) {
          const net = (n.sentSol || 0) - (n.recvSol || 0)
          const amt = isProgram
            ? (CAT_LABEL[n.counterCat] || n.counterCat || 'PROGRAM')
            : Math.abs(net) >= 0.005
              ? `${net > 0 ? '+' : '−'}${Math.abs(net).toFixed(2)} SOL`
              : `${n.txCount || 0}× tx`
          ctx!.fillStyle = col; ctx!.font = '600 8px ui-monospace, SFMono-Regular, monospace'
          ctx!.fillText(amt, x, y + r + 24)
          if (n.sharePct >= 5) {
            const w = ctx!.measureText(amt).width
            ctx!.textAlign = 'left'; ctx!.fillStyle = hexA(C.target, .85)
            ctx!.fillText(` ${n.sharePct}%`, x + w / 2 + 3, y + r + 24)
            ctx!.textAlign = 'center'
          }
        }
      })
    }
    animate()

    const onResize = () => {
      const nw = wrap.clientWidth || 800
      canvas.width = nw
      physNodes.forEach(n => { if (n.isCenter) { n.x = nw / 2; n.y = H / 2 } })
    }
    window.addEventListener('resize', onResize)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', onResize)
    }
  }, [data, scanState])

  // ── CSV export (reference _exportLedger) ──
  const exportCsv = () => {
    if (!data?.ledger?.length) return
    const rows = ['Tanggal,Keterangan,Counterparty,Debit,Kredit,Saldo,Status,TX Hash'].concat(
      [...data.ledger].reverse().map(r =>
        `"${r.dateStr}","${r.counterLabel || ''}","${r.counterAddr || ''}",` +
        `"${r.type === 'debit' ? r.solDeltaAbs : ''}","${r.type === 'credit' ? r.solDeltaAbs : r.type === 'swap' ? 'swap' : ''}",` +
        `"${r.balanceAfter != null ? r.balanceAfter : ''}","${r.status}","${r.sig}"`
      )
    )
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ledger_${data.center.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const handleReset = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setData(null)
    setSelected(null)
    setAddress('')
    setScanState('idle')
    setError(null)
  }

  const peers = (data?.nodes || []).filter(n => !n.isCenter).slice().sort((a, b) => a.rank - b.rank)
  const ins = data?.insights
  const ledger = data?.ledger || []
  const paged = ledger.slice(ledgerPage * PER_PAGE, ledgerPage * PER_PAGE + PER_PAGE)
  const pageCount = Math.max(1, Math.ceil(ledger.length / PER_PAGE))
  const maxLedgerSol = Math.max(0, ...ledger.map(r => r.solDeltaAbs))
  const gaugeScore = Math.round(((gaugeAngle + 80) / 160) * 100)
  const gaugeLabel = gaugeScore >= 70 ? 'TINGGI' : gaugeScore >= 40 ? 'SEDANG' : 'RENDAH'
  const gaugeColor = gaugeScore >= 70 ? '#ef4444' : gaugeScore >= 40 ? '#f2b84b' : '#33d17a'

  return (
    <div className="wide-shell min-h-screen bg-[#020806] text-[#dcebe5] font-mono p-4 md:p-6">
      <div className="max-w-[1360px] mx-auto space-y-4">

        {/* ─── Top Bar ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-bold text-[#dcebe5]">
            <span className="w-2 h-2 rounded-full bg-[#f2b84b] shadow-[0_0_10px_#f2b84b] animate-pulse" />
            WALLET&nbsp;TRACER
          </div>
          <span className="text-[9px] px-2 py-1 rounded-full border border-[#1b4a34] bg-[#0a1712] text-[#33d17a] tracking-wider">
            ON-CHAIN · REAL TRANSACTION FLOW
          </span>
          {data?.solPrice ? (
            <span className="text-[9px] px-2 py-1 rounded-full border border-[#1c5c3f] bg-[#08111d] text-[#28e994] tracking-wider">
              ◎ SOL ${data.solPrice.toFixed(2)} · live
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-2 text-[10px] text-[#33d17a] border border-[#1b4a34] bg-[#0a1712] px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#33d17a] shadow-[0_0_8px_#33d17a] animate-pulse" />
            {scanState === 'mapped' ? 'LIVE MAPPED' : scanState === 'scanning' ? 'FETCHING ON-CHAIN…' : 'LIVE MONITORING'}
          </div>
        </div>

        {/* ─── Search Bar ──────────────────────────────────────────── */}
        <div className="border border-[#123a2b] bg-[#040d09] rounded-xl p-4">
          <label className="text-[10px] text-[#668078] block mb-2 tracking-wide">
            🔍 Masukkan wallet address (Solana):
          </label>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runScan() }}
              placeholder="Solana wallet address (32-44 karakter)…"
              className="flex-1 min-w-[200px] bg-[#04100c] border border-[#123a2b] text-[#dcebe5] font-mono text-sm px-3 py-2 rounded-lg outline-none focus:border-[#1c5c3f]"
              spellCheck={false}
            />
            <button
              onClick={() => runScan()}
              disabled={scanState === 'scanning'}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[#08170f] border border-[#527d28] text-[#c5ff3d] hover:shadow-[0_0_18px_rgba(197,255,61,0.25)] transition-all disabled:opacity-50"
            >
              {scanState === 'scanning' ? '⏳ Fetching…' : '🗺️ Map Flow'}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 text-xs rounded-lg border border-[#123a2b] bg-[#06130e] text-[#dcebe5] hover:border-[#1c5c3f] transition-all"
            >
              🔄 Reset
            </button>
          </div>
          <div className="flex gap-2 mt-3 items-center flex-wrap">
            <span className="text-[9px] text-[#5b756c]">Quick:</span>
            {PRESETS.map(([lbl, full]) => (
              <button
                key={full}
                onClick={() => runScan(full)}
                className="text-[10px] text-[#668078] border border-[#0d1a13] bg-[#06120e] px-3 py-1.5 rounded-full hover:text-[#28e994] hover:border-[#1c5c3f] transition-all font-mono"
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Stats Bar (reference wgStats) ───────────────────────── */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { l: 'NODES', v: String(data.nodes.length), s: `${ins?.programCount || 0} program · ${ins?.walletCount || 0} wallet`, c: '#28e994' },
              { l: 'TX DIPARSE', v: `${data.parsedTxCount}/${data.txCount}`, s: 'transaksi on-chain', c: '#a855f7' },
              { l: 'INFLOW', v: `${ins?.totalInSol ?? 0} ◎`, s: fmtUsd(ins?.totalInUsd || 0), c: '#33d17a' },
              { l: 'OUTFLOW', v: `${ins?.totalOutSol ?? 0} ◎`, s: fmtUsd(ins?.totalOutUsd || 0), c: '#ef5350' },
              { l: 'NET FLOW', v: `${(ins?.netSol ?? 0) >= 0 ? '+' : ''}${ins?.netSol ?? 0} ◎`, s: fmtUsd(Math.abs(ins?.netUsd || 0)), c: (ins?.netSol ?? 0) >= 0 ? '#33d17a' : '#ef5350' },
            ].map((s, i) => (
              <div key={i} className="border border-[#123a2b] bg-[#040d09] rounded-lg px-3 py-2">
                <div className="text-[8.5px] text-[#668078] tracking-widest">{s.l}</div>
                <div className="text-sm font-bold" style={{ color: s.c }}>{s.v}</div>
                <div className="text-[9px] text-[#5b756c]">{s.s}</div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Main Layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_0.95fr] gap-4">

          {/* Graph Panel */}
          <div className="border border-[#123a2b] rounded-xl bg-[#040d09] overflow-hidden">
            <div className="h-[42px] flex items-center gap-2 px-4 border-b border-[#123a2b] bg-gradient-to-b from-[#0d1520] to-transparent">
              <span className="text-[11px] font-bold tracking-wider">WALLET FLOW MAP</span>
              <span className="ml-auto text-[9px] text-[#668078]">
                {scanState === 'mapped' && data
                  ? `${data.nodes.length - 1} peer terhubung · ${ins?.windowLabel || ''}`
                  : scanState === 'scanning' ? 'fetching on-chain transactions…'
                  : scanState === 'error' ? 'gagal fetch data'
                  : 'menunggu input wallet'}
              </span>
            </div>

            {/* WG_CSS — mockup keyframes (style only, no layout impact) */}
            <style>{`
              @keyframes wgBreatheDot { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
              .wg-bdot { animation: wgBreatheDot 3.4s ease-in-out infinite }
              .wg-bdot.d1 { animation-delay: -1.1s }
              .wg-bdot.d2 { animation-delay: -2.2s }
              @keyframes wgSweepAcross {
                0% { left: -160px; opacity: 0 }
                15% { opacity: 1 }
                85% { opacity: 1 }
                100% { left: 100%; opacity: 0 }
              }
              .wg-sweep {
                position: absolute; top: 0; bottom: 0; width: 140px; left: -160px;
                background: linear-gradient(90deg, rgba(78,161,255,0), rgba(78,161,255,.10), rgba(78,161,255,.22), rgba(78,161,255,.10), rgba(78,161,255,0));
                pointer-events: none; z-index: 15; opacity: 0;
                animation: wgSweepAcross 1.05s ease-out forwards;
              }
            `}</style>

            {/* Legend */}
            <div className="flex gap-4 px-4 py-2 border-b border-[#0d1a13] flex-wrap">
              <span className="flex items-center gap-1.5 text-[9.5px] text-[#668078]">
                <i className="w-[7px] h-[7px] rounded-full bg-[#f2b84b] shadow-[0_0_7px_#f2b84b] wg-bdot" /> Wallet dicari
              </span>
              <span className="flex items-center gap-1.5 text-[9.5px] text-[#668078]">
                <i className="w-[7px] h-[7px] rounded-full bg-[#33d17a] shadow-[0_0_7px_#33d17a] wg-bdot d1" /> Inflow (terima SOL)
              </span>
              <span className="flex items-center gap-1.5 text-[9.5px] text-[#668078]">
                <i className="w-[7px] h-[7px] rounded-full bg-[#ef5350] shadow-[0_0_7px_#ef5350] wg-bdot d2" /> Outflow (kirim SOL)
              </span>
              <span className="flex items-center gap-1.5 text-[9.5px] text-[#668078]">
                <i className="w-[7px] h-[7px] rounded-full bg-[#28e994] shadow-[0_0_7px_#28e994] wg-bdot" /> Interaksi / swap
              </span>
              <span className="flex items-center gap-1.5 text-[9.5px] text-[#668078]">
                <i className="w-[8px] h-[8px] rotate-45 bg-[#a855f7]" /> ◆ Program: DEX
              </span>
              <span className="flex items-center gap-1.5 text-[9.5px] text-[#668078]">
                <i className="w-[8px] h-[8px] rotate-45 bg-[#f97316]" /> CEX
              </span>
              <span className="flex items-center gap-1.5 text-[9.5px] text-[#668078]">
                <i className="w-[8px] h-[8px] rotate-45 bg-[#06b6d4]" /> Stake
              </span>
              <span className="flex items-center gap-1.5 text-[9.5px] text-[#668078]">
                <i className="w-[8px] h-[8px] rotate-45 bg-[#84cc16]" /> Lending
              </span>
            </div>

            <div
              ref={wrapRef}
              className="relative h-[500px] overflow-hidden"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
                `,
                backgroundSize: '36px 36px',
              }}
            >
              {/* Status badge */}
              <div className={`absolute left-4 top-4 text-[9.5px] tracking-wider z-10 ${scanState === 'mapped' ? 'text-[#33d17a]' : 'text-[#668078]'}`}>
                STATUS · <span className={scanState === 'mapped' ? 'text-[#33d17a]' : scanState === 'error' ? 'text-[#ef5350]' : 'text-[#28e994]'}>
                  {scanState === 'mapped' ? 'MAPPED' : scanState === 'scanning' ? 'SCANNING…' : scanState === 'error' ? 'ERROR' : 'IDLE'}
                </span>
              </div>

              <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full ${scanState === 'mapped' ? '' : 'hidden'}`} />
              <div
                ref={tipRef}
                className="absolute hidden pointer-events-none z-30 rounded-lg border border-[#334155] bg-[#0f172a] p-2.5 text-[11px] text-[#dcebe5] min-w-[180px] max-w-[250px]"
                style={{ boxShadow: '0 8px 30px rgba(0,0,0,.6)' }}
              />

              {/* Sweep scan bar — replays on every successful scan (mockup) */}
              {scanState === 'mapped' && sweepKey > 0 && (
                <div key={sweepKey} className="wg-sweep" />
              )}

              {/* Overlay: idle / scanning / error */}
              {scanState !== 'mapped' && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(2,6,23,.7)]">
                  {scanState === 'scanning' ? (
                    <div className="text-center">
                      <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-[#123a2b] border-t-[#28e994] animate-spin" />
                      <div className="text-[12px] text-[#668078]">Fetching on-chain transactions…</div>
                      <div className="text-[10px] text-[#5b756c] mt-1 font-mono">Parsing {address.slice(0, 8)}… via public Solana RPC</div>
                    </div>
                  ) : scanState === 'error' ? (
                    <div className="text-center text-[#ef5350] text-[12px] px-6">
                      ❌ {error || 'Gagal fetch data on-chain'}
                      <button onClick={() => runScan()} className="block mx-auto mt-3 text-[10px] px-3 py-1.5 rounded border border-[#3a2020] bg-[#160d0d] text-[#fca5a5] hover:border-[#ef5350]">Coba lagi</button>
                    </div>
                  ) : (
                    <div className="text-center text-[#5b756c]">
                      <div className="text-5xl mb-2.5">🌐</div>
                      <div className="text-[12px] text-[#668078]">Masukkan wallet address<br />atau pilih quick preset di atas</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 py-2 border-t border-[#0d1a13] text-[9.5px] text-[#5b756c]">
              💡 Drag nodes · Hover untuk detail · Click node untuk inspect · Double-click node untuk map wallet itu
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">

            {/* Node Explorer (reference wgExplorer) */}
            <AnimatePresence>
              {selected && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="border rounded-xl bg-[#040d09] overflow-hidden"
                  style={{ borderColor: selected.color + '55' }}
                >
                  <div className="h-[38px] flex items-center gap-2 px-4 border-b border-[#0d1a13]">
                    <span className="text-[10.5px] font-bold tracking-wider" style={{ color: selected.color }}>
                      {selected.isCenter ? '⭐ NODE EXPLORER · CENTER' : '🔎 NODE EXPLORER'}
                    </span>
                    <button onClick={() => setSelected(null)} className="ml-auto text-[#668078] hover:text-[#ef5350] text-xs">✕</button>
                  </div>
                  <div className="p-3.5 space-y-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: selected.color, boxShadow: `0 0 8px ${selected.color}` }} />
                      <span className="font-bold text-[#dcebe5] truncate">{selected.label}</span>
                      {!selected.isCenter && (
                        <span className="text-[8.5px] px-1.5 py-0.5 rounded-full border shrink-0"
                          style={{
                            color: selected.counterType === 'program' ? '#a855f7' : '#60a5fa',
                            borderColor: selected.counterType === 'program' ? '#a855f754' : '#60a5fa33',
                            background: selected.counterType === 'program' ? 'rgba(168,85,247,.12)' : 'rgba(59,130,246,.08)',
                          }}>
                          {selected.counterType === 'program' ? `⚙️ ${CAT_ICON[selected.counterCat] || ''} ${CAT_LABEL[selected.counterCat] || 'PROGRAM'}` : '👤 WALLET'}
                        </span>
                      )}
                      {!selected.isCenter && selected.rank === 1 && (
                        <span className="text-[8.5px] px-1.5 py-0.5 rounded-full border border-[#fbbf2455] bg-[rgba(251,191,36,.1)] text-[#fbbf24] font-bold shrink-0">⚡ TERBESAR</span>
                      )}
                    </div>
                    <div className="font-mono text-[9px] text-[#668078] break-all">{selected.fullAddr}</div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <div className="border border-[#0d1a13] rounded-lg px-2.5 py-1.5 bg-[#06120e]">
                        <div className="text-[8px] text-[#668078] tracking-wider">TX BERSAMA</div>
                        <div className="text-[12px] font-bold text-[#dcebe5]">{selected.txCount}</div>
                      </div>
                      <div className="border border-[#0d1a13] rounded-lg px-2.5 py-1.5 bg-[#06120e]">
                        <div className="text-[8px] text-[#668078] tracking-wider">TERAKHIR</div>
                        <div className="text-[12px] font-bold text-[#dcebe5]">{selected.lastAgo}</div>
                      </div>
                      {!selected.isCenter && (
                        <>
                          <div className="border border-[#0d1a13] rounded-lg px-2.5 py-1.5 bg-[#06120e]">
                            <div className="text-[8px] text-[#33d17a] tracking-wider">⬇ INFLOW DARI NODE</div>
                            <div className="text-[12px] font-bold text-[#33d17a]">{selected.sentSol > 0 ? `+${selected.sentSol} ◎` : '—'}</div>
                            <div className="text-[8px] text-[#5b756c]">{selected.sentUsd ? fmtUsd(selected.sentUsd) : ''}</div>
                          </div>
                          <div className="border border-[#0d1a13] rounded-lg px-2.5 py-1.5 bg-[#06120e]">
                            <div className="text-[8px] text-[#ef5350] tracking-wider">⬆ OUTFLOW KE NODE</div>
                            <div className="text-[12px] font-bold text-[#ef5350]">{selected.recvSol > 0 ? `−${selected.recvSol} ◎` : '—'}</div>
                            <div className="text-[8px] text-[#5b756c]">{selected.recvUsd ? fmtUsd(selected.recvUsd) : ''}</div>
                          </div>
                          <div className="border border-[#0d1a13] rounded-lg px-2.5 py-1.5 bg-[#06120e] col-span-2">
                            <div className="text-[8px] text-[#fbbf24] tracking-wider">📊 DISTRIBUSI FLOW</div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 rounded-full bg-[#0d1a13] overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-[#f2b84b] to-[#fbbf24]" style={{ width: `${Math.min(100, selected.sharePct)}%` }} />
                              </div>
                              <span className="text-[11px] font-bold text-[#fbbf24]">{selected.sharePct}%</span>
                              <span className="text-[8.5px] text-[#668078]">rank #{selected.rank}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1.5">
                      {!selected.isCenter && (
                        <button
                          onClick={() => runScan(selected.fullAddr)}
                          className="flex-1 text-[10px] font-bold px-3 py-2 rounded-lg bg-[#08170f] border border-[#527d28] text-[#c5ff3d] hover:shadow-[0_0_14px_rgba(197,255,61,0.3)] transition-all"
                        >
                          🗺️ Map wallet ini
                        </button>
                      )}
                      <a
                        href={`https://solscan.io/account/${selected.fullAddr}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 text-center text-[10px] px-3 py-2 rounded-lg border border-[#123a2b] bg-[#06130e] text-[#668078] hover:text-[#28e994] hover:border-[#1c5c3f] transition-all"
                      >
                        🔗 View on Solscan
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Insights */}
            <div className="border border-[#123a2b] rounded-xl bg-[#040d09] overflow-hidden">
              <div className="h-[38px] flex items-center gap-2 px-4 border-b border-[#123a2b]">
                <span className="text-[10.5px] font-bold tracking-wider">INSIGHTS</span>
                {ins && <span className="ml-auto text-[8.5px] text-[#5b756c]">{ins.windowLabel} · real on-chain</span>}
              </div>
              <div className="p-3.5">
                {ins ? (
                  <div className="grid grid-cols-2 gap-2">
                    {/* Activity gauge (derived from real metrics) */}
                    <div className="col-span-2 border border-[#0d1a13] rounded-lg bg-[#06120e] px-3 py-2.5 flex items-center gap-3">
                      <div className="relative w-[74px] h-[42px] shrink-0">
                        <svg viewBox="0 0 74 42" className="w-full h-full">
                          <path d="M 7 38 A 30 30 0 0 1 67 38" fill="none" stroke="#123a2b" strokeWidth="6" strokeLinecap="round" />
                          <path d="M 7 38 A 30 30 0 0 1 67 38" fill="none" stroke={gaugeColor} strokeWidth="6" strokeLinecap="round"
                            strokeDasharray={`${(gaugeScore / 100) * 94.2} 94.2`} opacity="0.85" />
                          <line x1="37" y1="38" x2="37" y2="14" stroke={gaugeColor} strokeWidth="2" strokeLinecap="round"
                            style={{ transform: `rotate(${gaugeAngle}deg)`, transformOrigin: '37px 38px', transition: 'transform 1s cubic-bezier(.34,1.56,.64,1)' }} />
                          <circle cx="37" cy="38" r="3" fill={gaugeColor} />
                        </svg>
                      </div>
                      <div>
                        <div className="text-[8px] text-[#668078] tracking-widest">ACTIVITY SCORE</div>
                        <div className="text-sm font-bold" style={{ color: gaugeColor }}>{gaugeLabel} · {gaugeScore}</div>
                        <div className="text-[8.5px] text-[#5b756c]">{ins.txPerHour} tx/jam · {ins.programCount} program · {ins.walletCount} wallet peer</div>
                      </div>
                    </div>

                    {[
                      { l: 'NET FLOW', v: `${ins.netSol >= 0 ? '+' : ''}${ins.netSol} ◎`, s: `in ${ins.totalInSol} · out ${ins.totalOutSol} (${fmtUsd(Math.abs(ins.netUsd))})`, c: ins.netSol >= 0 ? '#33d17a' : '#ef5350' },
                      { l: 'TX TERBESAR', v: ins.biggestTx ? `${ins.biggestTx.sol} ◎` : '—', s: ins.biggestTx ? `${ins.biggestTx.counterLabel} · ${ins.biggestTx.timeAgo} · ${fmtUsd(ins.biggestTx.usd)}` : '', c: '#fbbf24' },
                      { l: 'TX TERKECIL', v: ins.smallestTx ? `${ins.smallestTx.sol} ◎` : '—', s: ins.smallestTx ? `${ins.smallestTx.counterLabel} · ${ins.smallestTx.timeAgo}` : '', c: '#5eead4' },
                      { l: 'FIRST FUNDER', v: ins.firstFunder ? ins.firstFunder.label : '—', s: ins.firstFunder ? `+${ins.firstFunder.sol} ◎ · ${ins.firstFunder.timeAgo}` : 'tidak ada credit di window', c: '#dcebe5' },
                      { l: 'CEX EXPOSURE', v: ins.cexExposure.count ? `${ins.cexExposure.count} tx` : '—', s: ins.cexExposure.count ? `${ins.cexExposure.labels.join(', ')} · ${ins.cexExposure.sol} ◎` : 'tidak ada interaksi CEX dikenal', c: '#f97316' },
                      { l: 'TOTAL FEES', v: `${ins.totalFeesSol} ◎`, s: `${ins.distributionEvents} event distribusi`, c: '#668078' },
                    ].map((card, i) => (
                      <div key={i} className="border border-[#0d1a13] rounded-lg bg-[#06120e] px-3 py-2">
                        <div className="text-[8px] text-[#668078] tracking-widest">{card.l}</div>
                        <div className="text-[12.5px] font-bold truncate" style={{ color: card.c }}>{card.v}</div>
                        <div className="text-[8.5px] text-[#5b756c] truncate">{card.s}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10.5px] text-[#5b756c] py-6 text-center">
                    {scanState === 'scanning' ? 'Menghitung insights dari data on-chain…' : 'Map sebuah wallet untuk melihat insights'}
                  </div>
                )}

                {/* Real patterns */}
                {data && data.patterns.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {data.patterns.map((p, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className={`flex items-center gap-2 text-[10px] px-2.5 py-1.5 rounded-lg border ${
                          p.sev === 'high' ? 'border-[#3a2020] bg-[#160d0d] text-[#fca5a5]'
                          : p.sev === 'med' ? 'border-[#3a3020] bg-[#16130d] text-[#fcd34d]'
                          : 'border-[#123a2b] bg-[#06120e] text-[#668078]'
                        }`}
                      >
                        <span>{p.icon}</span><span>{p.text}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Distribusi panel (enrichment) */}
            {peers.length > 0 && (
              <div className="border border-[#123a2b] rounded-xl bg-[#040d09] overflow-hidden">
                <div className="h-[38px] flex items-center gap-2 px-4 border-b border-[#123a2b]">
                  <span className="text-[10.5px] font-bold tracking-wider">📊 DISTRIBUSI FLOW</span>
                  <span className="ml-auto text-[8.5px] text-[#5b756c]">% dari total volume SOL</span>
                </div>
                <div className="p-3 space-y-1.5">
                  {peers.slice(0, 6).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelected(n)}
                      onDoubleClick={() => runScan(n.id)}
                      className="w-full flex items-center gap-2 group"
                    >
                      <span className="w-[86px] shrink-0 text-left text-[9.5px] font-mono truncate group-hover:text-[#28e994] transition-colors" style={{ color: n.color }}>
                        {n.rank === 1 ? '⚡ ' : ''}{n.label.slice(0, 12)}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-[#0a1a14] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(2, Math.min(100, n.sharePct))}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${n.color}88, ${n.color})` }}
                        />
                      </div>
                      <span className="w-[42px] text-right text-[9.5px] font-bold text-[#dcebe5]">{n.sharePct}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live ledger feed (real rows, framer-motion) */}
            {ledger.length > 0 && (
              <div className="border border-[#123a2b] rounded-xl bg-[#040d09] overflow-hidden">
                <div className="h-[38px] flex items-center gap-2 px-4 border-b border-[#123a2b]">
                  <span className="text-[10.5px] font-bold tracking-wider">LEDGER FEED</span>
                  <span className="ml-auto text-[8.5px] text-[#5b756c]">{ledger.length} tx terakhir · live</span>
                </div>
                <div className="p-2 space-y-1.5 max-h-[240px] overflow-hidden">
                  <AnimatePresence initial={false}>
                    {ledger.slice(0, 6).map((r) => {
                      const m = TX_META[r.txType] || TX_META.debit
                      return (
                        <motion.div
                          key={r.sig}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-lg bg-[#06120e] border border-[#0a1a14]"
                        >
                          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold shrink-0" style={{ background: m.bg, color: m.fg }}>
                            {m.icon} {m.label}
                          </span>
                          <span className="font-mono text-[#668078] truncate">{r.counterLabel}</span>
                          <span className={`ml-auto font-bold shrink-0 ${r.solDelta > 0 ? 'text-[#33d17a]' : r.solDelta < 0 ? 'text-[#ef5350]' : 'text-[#28e994]'}`}>
                            {r.solDelta > 0 ? '+' : r.solDelta < 0 ? '−' : ''}{r.solDeltaAbs > 0 ? r.solDeltaAbs : 'swap'} ◎
                          </span>
                          <span className="text-[8px] text-[#5b756c] shrink-0">{r.timeAgo}</span>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Rekening Koran (ledger table) ─────────────────────────── */}
        {ledger.length > 0 && (
          <div className="border border-[#123a2b] rounded-xl bg-[#040d09] overflow-hidden">
            <div className="h-[42px] flex items-center gap-2 px-4 border-b border-[#123a2b]">
              <span className="text-[11px] font-bold tracking-wider">💳 REKENING KORAN — MUTASI TRANSAKSI</span>
              <span className="text-[9px] text-[#5b756c]">{ledger.length} transaksi terakhir · saldo real dari pre/post balance</span>
              <button
                onClick={exportCsv}
                className="ml-auto text-[9.5px] px-2.5 py-1 rounded border border-[#1c5c3f] bg-[rgba(59,130,246,.08)] text-[#28e994] hover:bg-[rgba(59,130,246,.16)] transition-all"
              >
                ⬇ Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] min-w-[860px]">
                <thead>
                  <tr className="border-b border-[#123a2b] text-[8.5px] text-[#668078] uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-left">Tanggal</th>
                    <th className="py-2.5 px-3 text-center">Jenis TX</th>
                    <th className="py-2.5 px-3 text-left">Ke / Dari</th>
                    <th className="py-2.5 px-3 text-right text-[#ef5350]">Debit ◎</th>
                    <th className="py-2.5 px-3 text-right text-[#33d17a]">Kredit ◎</th>
                    <th className="py-2.5 px-3 text-right">Saldo ◎</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r, i) => {
                    const m = TX_META[r.txType] || TX_META.debit
                    const isBig = maxLedgerSol > 0 && r.solDeltaAbs === maxLedgerSol
                    return (
                      <tr
                        key={r.sig}
                        className={`border-b border-[#0a1a14] transition-colors hover:bg-[#071510] ${isBig ? 'bg-[rgba(251,191,36,.05)]' : i % 2 === 0 ? 'bg-[#06120e]' : ''}`}
                        style={isBig ? { borderLeft: '2px solid #fbbf24' } : undefined}
                      >
                        <td className={`py-2.5 px-3 font-mono text-[9.5px] whitespace-nowrap ${isBig ? 'text-[#fbbf24]' : 'text-[#668078]'}`}>{r.dateStr}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8.5px] font-bold border"
                            style={{ background: m.bg, color: m.fg, borderColor: m.fg + '33' }}>
                            {m.icon} {m.label}
                          </span>
                          {isBig && <div className="text-[7.5px] text-[#fbbf24] font-bold mt-0.5">⚡ Terbesar</div>}
                        </td>
                        <td className="py-2.5 px-3 max-w-[220px]">
                          <button
                            className="text-left group"
                            onClick={() => {
                              const node = (data?.nodes || []).find(n => n.id === r.counterAddr)
                              if (node) setSelected(node)
                            }}
                            onDoubleClick={() => r.counterAddr && runScan(r.counterAddr)}
                            title={r.counterAddr || ''}
                          >
                            <span className={`text-[10.5px] font-semibold group-hover:text-[#28e994] transition-colors ${isBig ? 'text-[#fde68a]' : 'text-[#dcebe5]'}`}>
                              {r.counterLabel}
                            </span>
                            {r.counterType === 'program' ? (
                              <span className="ml-1.5 text-[8px] px-1.5 rounded-full border border-[#a855f754] bg-[rgba(168,85,247,.12)] text-[#a855f7]">
                                {CAT_ICON[r.counterCat] || '⚙'} Program
                              </span>
                            ) : r.counterAddr ? (
                              <span className="ml-1.5 text-[8px] px-1.5 rounded-full border border-[#60a5fa33] bg-[rgba(59,130,246,.08)] text-[#60a5fa]">👤 Wallet</span>
                            ) : null}
                          </button>
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-semibold ${isBig && r.type === 'debit' ? 'text-[#fbbf24] text-[12px]' : 'text-[#ef5350]'}`}>
                          {r.type === 'debit' ? `${r.solDeltaAbs} ◎` : '—'}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-semibold ${isBig && r.type === 'credit' ? 'text-[#fbbf24] text-[12px]' : 'text-[#33d17a]'}`}>
                          {r.type === 'credit' ? `${r.solDeltaAbs} ◎` : r.type === 'swap' ? 'swap' : '—'}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono ${isBig ? 'text-[#fde68a]' : 'text-[#8da59c]'}`}>{r.balanceAfter} ◎</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold ${r.status === 'success' ? 'bg-[rgba(34,197,94,.12)] text-[#22c55e]' : 'bg-[rgba(239,68,68,.12)] text-[#ef4444]'}`}>
                            {r.status === 'success' ? '✓ OK' : '✗ Fail'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <a href={r.solscanUrl} target="_blank" rel="noreferrer" className={`text-[11px] no-underline ${isBig ? 'text-[#fbbf24]' : 'text-[#5b756c] hover:text-[#28e994]'}`} title="Lihat di Solscan">🔗</a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-[#0d1a13]">
                <button onClick={() => setLedgerPage(p => Math.max(0, p - 1))} disabled={ledgerPage === 0}
                  className="text-[9.5px] px-2.5 py-1 rounded border border-[#123a2b] bg-[#06130e] text-[#668078] hover:text-[#28e994] disabled:opacity-30">← Prev</button>
                <span className="text-[9px] text-[#5b756c]">{ledgerPage + 1} / {pageCount}</span>
                <button onClick={() => setLedgerPage(p => Math.min(pageCount - 1, p + 1))} disabled={ledgerPage >= pageCount - 1}
                  className="text-[9.5px] px-2.5 py-1 rounded border border-[#123a2b] bg-[#06130e] text-[#668078] hover:text-[#28e994] disabled:opacity-30">Next →</button>
              </div>
            )}
          </div>
        )}

        {/* ─── Peers table ───────────────────────────────────────────── */}
        {peers.length > 0 && (
          <div className="border border-[#123a2b] rounded-xl bg-[#040d09] overflow-hidden">
            <div className="h-[42px] flex items-center gap-2 px-4 border-b border-[#123a2b]">
              <span className="text-[11px] font-bold tracking-wider">📋 {peers.length} WALLET BERINTERAKSI</span>
              <span className="ml-auto text-[9px] text-[#5b756c]">
                click → inspect · double-click → map flow
                {data?._cached ? ' · 🗄 cached' : ''} · dianalisis {data?.parsedTxCount || 0}/{data?.txCount || 0} TX
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] min-w-[760px]">
                <thead>
                  <tr className="border-b border-[#123a2b] text-[8.5px] text-[#668078] uppercase tracking-wider">
                    <th className="py-2 px-3 text-center w-8">#</th>
                    <th className="py-2 px-3 text-left">Wallet / Program</th>
                    <th className="py-2 px-3 text-right">TX</th>
                    <th className="py-2 px-3 text-right text-[#33d17a]">⬇ Inflow</th>
                    <th className="py-2 px-3 text-right text-[#ef5350]">⬆ Outflow</th>
                    <th className="py-2 px-3 text-right">Distribusi</th>
                    <th className="py-2 px-3 text-right">Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {peers.map((n, i) => {
                    const dirIcon = n.type === 'inflow' ? '⬇' : n.type === 'outflow' ? '⬆' : '↔'
                    const dirCol = n.type === 'inflow' ? '#22c55e' : n.type === 'outflow' ? '#ef4444' : '#60a5fa'
                    return (
                      <tr
                        key={n.id}
                        onClick={() => setSelected(n)}
                        onDoubleClick={() => runScan(n.id)}
                        className={`border-b border-[#0a1a14] cursor-pointer transition-colors hover:bg-[#071510] ${selected?.id === n.id ? 'bg-[rgba(78,161,255,.06)]' : i % 2 === 0 ? 'bg-[#06120e]' : ''}`}
                      >
                        <td className="py-2.5 px-3 text-center text-[9px] text-[#5b756c]">{n.rank || i + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span style={{ color: dirCol }}>{dirIcon}</span>
                            <span className="font-mono text-[10.5px] text-[#dcebe5]">{n.id.slice(0, 8)}…{n.id.slice(-5)}</span>
                            {n.counterType === 'program' && (
                              <span className="text-[8px] px-1.5 rounded-full border" style={{ color: n.color, borderColor: n.color + '54', background: n.color + '18' }}>
                                {CAT_ICON[n.counterCat] || '⚙'} {CAT_LABEL[n.counterCat] || 'PROG'}
                              </span>
                            )}
                            {n.rank === 1 && <span className="text-[8px] px-1.5 rounded-full border border-[#fbbf2455] bg-[rgba(251,191,36,.1)] text-[#fbbf24] font-bold">⚡ TERBESAR</span>}
                          </div>
                          <div className="text-[9px] text-[#5b756c] mt-0.5">{n.label}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[12px]" style={{ color: dirCol }}>{n.txCount}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#22c55e]">{n.sentSol > 0 ? `+${n.sentSol} ◎` : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#ef4444]">{n.recvSol > 0 ? `−${n.recvSol} ◎` : '—'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-14 h-1.5 rounded-full bg-[#0d1a13] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, n.sharePct)}%`, background: n.color }} />
                            </div>
                            <span className="text-[9.5px] font-bold text-[#fbbf24] w-9 text-right">{n.sharePct}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[9.5px] text-[#5b756c]">{n.lastAgo}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 text-right text-[8.5px] text-[#5b756c] border-t border-[#0d1a13]">
              {data?._cached ? '🗄 Cached · ' : ''}Data real-time dari Solana public RPC · harga SOL live {data?.solPrice ? `$${data.solPrice.toFixed(2)}` : 'n/a'} · {data ? new Date(data.fetchedAt).toLocaleTimeString('id-ID') : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
