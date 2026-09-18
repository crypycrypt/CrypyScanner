"use client"

import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, FormEvent } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { MemeToken, MemeWallet } from '../../lib/meme/types'
import { scanMemeToken, estimateAlertFromToken } from '../../lib/memeScanner'
import { usePaperTrader } from '../../lib/usePaperTrader'
import CoinIcon from '../ui/CoinIcon'
import RadarShowcaseCard from './RadarShowcaseCard'

// ══════════════════════════════════════════════════════════════════
// MEME COMMAND CENTER
// Single unified page merging: Scanner (Radar), DEX Sniper (Early
// Entry / Momentum Rider), Wallet Tracker, Narrative Radar, Money
// Flow and Risk Scanner. Token detail is a shared modal with
// Chart / Info & Analysis / Forensik ("Should I Ape?") / AI Analyst
// tabs — inspired by the legacy crypto-scanner DEX Analyzer +
// DEX Sniper + DEX Forensics tools.
// ══════════════════════════════════════════════════════════════════

type Section = 'radar' | 'sniper' | 'wallets' | 'narrative' | 'flow' | 'risk' | 'tradingbot'
type SniperMode = 'early' | 'momentum'

// ─── Fetchers ────────────────────────────────────────────────────
async function fetchMemeTokens(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`/api/meme-tokens?${qs}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
async function fetchMemeWallets(): Promise<any> {
  const res = await fetch('/api/meme-wallets')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
async function fetchNarratives(): Promise<any> {
  const res = await fetch('/api/meme-narratives')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
async function fetchMoneyFlow(): Promise<any> {
  const res = await fetch('/api/meme-money-flow')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
async function fetchRiskData(): Promise<any> {
  const res = await fetch('/api/meme-risk')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// ─── Format helpers ──────────────────────────────────────────────
function formatPrice(v: number): string {
  if (!v) return '$0.0000'
  if (v < 0.000001) return `$${v.toExponential(2)}`
  if (v < 0.01) return `$${v.toFixed(6)}`
  if (v < 1) return `$${v.toFixed(4)}`
  return `$${v.toFixed(2)}`
}
function formatNumber(v: number): string {
  if (!v) return '$0'
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}
function formatAge(minutes: number): string {
  if (!minutes) return '—'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
}

// ─── Copy to clipboard ───────────────────────────────────────────
// Tombol salin alamat wallet. Memakai Clipboard API dengan fallback
// execCommand untuk konteks non-secure (http://IP-lokal). stopPropagation
// supaya klik tombol tidak ikut membuka modal baris wallet.
function CopyButton({ value, label, disabled, disabledTitle }: { value: string; label?: string; disabled?: boolean; disabledTitle?: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async (e: any) => {
    e.stopPropagation()
    if (disabled) return
    const text = String(value || '')
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* abaikan */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={disabled}
      className={`meme-copy${copied ? ' done' : ''}${disabled ? ' opacity-40 cursor-not-allowed' : ''}`}
      title={disabled ? (disabledTitle || 'Nonaktif') : `Salin ${label || 'alamat'}`}
    >
      {copied ? '✓ TERSALIN' : '⧉ SALIN'}
    </button>
  )
}

// ─── Badges ──────────────────────────────────────────────────────
function SignalBadge({ signal }: { signal: string }) {
  const cls = ({
    'STRONG BUY': 'meme-signal-strong-buy',
    'CONDITIONAL BUY': 'meme-signal-conditional-buy',
    WATCH: 'meme-signal-watch',
    WAIT: 'meme-signal-wait',
    AVOID: 'meme-signal-avoid',
    'EXIT WATCH': 'meme-signal-exit-watch',
  } as Record<string, string>)[signal] || 'meme-signal-wait'
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{signal}</span>
}
function RiskBadge({ score }: { score: number }) {
  let level: string; let color: string
  if (score >= 70) { level = 'CRITICAL'; color = 'meme-risk-critical' }
  else if (score >= 50) { level = 'HIGH'; color = 'meme-risk-high' }
  else if (score >= 30) { level = 'MEDIUM'; color = 'meme-risk-medium' }
  else { level = 'LOW'; color = 'meme-risk-low' }
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${color}`}>{level} ({score})</span>
}
function NarrativeBadge({ narrative }: { narrative: string }) {
  const cls = ({
    PEPE: 'meme-narrative-pepe', DOG: 'meme-narrative-dog', CAT: 'meme-narrative-cat',
    AI: 'meme-narrative-ai', POLITICAL: 'meme-narrative-political', GAMING: 'meme-narrative-gaming',
    FOOD: 'meme-narrative-food', ART: 'meme-narrative-art', MUSIC: 'meme-narrative-music', MEME: 'meme-narrative-meme',
  } as Record<string, string>)[narrative] || 'meme-narrative-meme'
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{narrative}</span>
}

// ─── Quality scanner badge (lib/memeScanner: hard veto → skor 0-100) ──
// STRONG ≥65 · WATCH 45-64 · WEAK <45 (lolos veto, risiko tinggi) ·
// REJECT = kena hard veto (creator >3000 launch, LP <$5K, bundle >60%,
// organic <25%, TH1 >30%) — skor tidak dihitung.
const QUALITY_META: Record<string, { color: string; bg: string }> = {
  STRONG: { color: '#22e58a', bg: 'rgba(34,229,138,.12)' },
  WATCH: { color: '#ffc85b', bg: 'rgba(255,200,91,.12)' },
  WEAK: { color: '#ff9d4d', bg: 'rgba(255,157,77,.12)' },
  REJECT: { color: '#ff5d69', bg: 'rgba(255,93,105,.12)' },
}
function QualityBadge({ decision, score, reason }: { decision: string; score: number; reason?: string }) {
  const m = QUALITY_META[decision] || QUALITY_META.WEAK
  return (
    <span
      className="px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap"
      style={{ color: m.color, background: m.bg, border: `1px solid ${m.color}44` }}
      title={reason || decision}
    >
      {decision}{decision !== 'REJECT' ? ` · ${score}` : ''}
    </span>
  )
}

// ─── Sniper scoring (adapted from legacy dex-sniper.js) ─────────
function computeSniperScore(t: MemeToken): number {
  const buyRatio = (parseFloat(t.buySellRatio || '50') || 50) / 100
  const score = t.aiScore * 0.4 + t.entryQuality * 0.3 + buyRatio * 100 * 0.2 + (100 - t.riskScore) * 0.1
  return Math.max(0, Math.min(100, Math.round(score)))
}
function sniperBucket(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'HOT', color: '#ff5d69' }
  if (score >= 55) return { label: 'WATCH', color: '#ffc85b' }
  if (score >= 35) return { label: 'SETUP', color: '#55aaff' }
  return { label: 'COLD', color: '#648176' }
}

// ─── Ape score / verdict (adapted from legacy dex-forensics.js) ─
function computeApeScore(t: MemeToken): number {
  const base = (100 - t.riskScore) * 0.06 + t.aiScore * 0.04
  return Math.max(1, Math.min(10, Math.round(base)))
}
function apeVerdict(score: number): { verdict: string; zone: string; color: string } {
  if (score >= 8) return { verdict: 'APE SEKARANG', zone: 'AMAN', color: '#22e58a' }
  if (score >= 6) return { verdict: 'BOLEH APE', zone: 'MULAI MATANG', color: '#ffc85b' }
  if (score >= 4) return { verdict: 'TUNGGU DULU', zone: 'PVP', color: '#fb923c' }
  return { verdict: 'JANGAN APE DULU', zone: 'BAHAYA', color: '#ff5d69' }
}

// ─── APE Meter — canvas gauge ────────────────────────────────────
function ApeMeter({ score }: { score: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    const cx = W / 2, cy = H - 8, radius = Math.min(W / 2, H) - 16
    const zones = [
      { from: 0, to: 3, color: '#ff5d69' },
      { from: 3, to: 5, color: '#fb923c' },
      { from: 5, to: 7, color: '#ffc85b' },
      { from: 7, to: 10, color: '#22e58a' },
    ]
    const startAngle = Math.PI
    const totalAngle = Math.PI
    zones.forEach(z => {
      const a0 = startAngle + (z.from / 10) * totalAngle
      const a1 = startAngle + (z.to / 10) * totalAngle
      ctx.beginPath()
      ctx.arc(cx, cy, radius, a0, a1)
      ctx.lineWidth = 14
      ctx.strokeStyle = z.color
      ctx.lineCap = 'butt'
      ctx.stroke()
    })
    const scoreAngle = startAngle + (score / 10) * totalAngle
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(scoreAngle) * (radius - 4), cy + Math.sin(scoreAngle) * (radius - 4))
    ctx.lineWidth = 3
    ctx.strokeStyle = '#e2e8f0'
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#e2e8f0'
    ctx.fill()
  }, [score])
  return <canvas ref={canvasRef} width={200} height={110} className="mx-auto" />
}

// ─── Shared Token Detail Modal (Chart / Info&Analysis / Forensik / AI Analyst) ─
function TokenDetailModal({ token, onClose }: { token: MemeToken | null; onClose: () => void }) {
  const [tab, setTab] = useState<'Chart' | 'Info & Analysis' | 'Forensik' | 'AI Analyst'>('Info & Analysis')
  useEffect(() => { if (token) setTab('Info & Analysis') }, [token])
  if (!token) return null

  const ape = computeApeScore(token)
  const verdict = apeVerdict(ape)
  const buyRatio = parseFloat(token.buySellRatio || '50') || 50
  const volLiqRatio = token.liquidity > 0 ? (token.volume24h / token.liquidity).toFixed(2) : '—'

  const riskChecks: { label: string; level: string }[] = [
    { label: 'Liquidity', level: token.riskLevels.liquidity },
    { label: 'Holder Concentration', level: token.riskLevels.holder },
    { label: 'Deployer Volatility', level: token.riskLevels.deployer },
    { label: 'Exit Cluster', level: token.riskLevels.exit },
    { label: 'Bot / Bundled Activity', level: token.riskLevels.cluster },
  ]
  const riskColor = (l: string) => l === 'CRITICAL' ? '#ff5d69' : l === 'HIGH' ? '#fb923c' : l === 'MEDIUM' ? '#ffc85b' : '#22e58a'
  const riskIcon = (l: string) => l === 'CRITICAL' ? '⛔ GAGAL' : l === 'HIGH' ? '⚠️ WASPADA' : l === 'MEDIUM' ? '🟡 WASPADA' : '✅ AMAN'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#06140e] border border-[#173b2b] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-[#0d2119] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <CoinIcon symbol={token.symbol} size={36} />
            <div>
              <h3 className="font-bold text-[#baff38] text-lg leading-tight">{token.symbol} — {token.name}</h3>
              <div className="text-[#648176] text-xs">{formatPrice(token.price)} · {token.priceChange1h >= 0 ? '+' : ''}{token.priceChange1h.toFixed(1)}% (1h)</div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#648176] hover:text-[#d8eee5]">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-[#0d2119] overflow-x-auto px-2">
          {(['Chart', 'Info & Analysis', 'Forensik', 'AI Analyst'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-2.5 text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0"
              style={{ color: tab === t ? '#baff38' : '#648176', borderBottom: tab === t ? '2px solid #baff38' : '2px solid transparent' }}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'Chart' && (
            <div className="space-y-3">
              {/* Chart live INLINE — embed DexScreener. Sudah diverifikasi iframe-safe:
                  HTTP 200 tanpa header x-frame-options / content-security-policy,
                  jadi tidak perlu lagi placeholder "Buka Chart →". */}
              <iframe
                key={token.pairAddress || token.address}
                className="meme-cc-chart"
                src={`https://dexscreener.com/solana/${token.pairAddress || token.address}?embed=1&loadChart=true&chartTheme=dark&theme=dark`}
                title={`Live chart ${token.symbol}`}
                loading="lazy"
                allowFullScreen
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#648176]">DexScreener inline · pair {(token.pairAddress || token.address).slice(0, 10)}…</span>
                <a href={token.dexUrl} target="_blank" rel="noopener noreferrer" className="text-[#55aaff] hover:underline">Buka halaman penuh →</a>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[['1H', token.priceChange1h], ['24H', token.priceChange24h], ['7D', token.priceChange7d]].map(([lbl, val]) => (
                  <div key={lbl as string} className="bg-[#030c08] border border-[#173b2b] rounded p-2.5 text-center">
                    <div className="text-[#56766a] text-[10px]">{lbl}</div>
                    <div className="font-bold" style={{ color: Number(val) >= 0 ? '#22e58a' : '#ff5d69' }}>
                      {Number(val) >= 0 ? '+' : ''}{Number(val).toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'Info & Analysis' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {[
                  ['Price', formatPrice(token.price)], ['Liquidity', formatNumber(token.liquidity)],
                  ['Volume 24H', formatNumber(token.volume24h)], ['Volume 1H', formatNumber(token.volume1h)],
                  ['Buys 1H', String(token.buys1h)], ['Sells 1H', String(token.sells1h)],
                  ['Age', formatAge(token.age)], ['Narrative', token.narrative],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#030c08] border border-[#173b2b] rounded p-2.5">
                    <div className="text-[#56766a] text-[10px] uppercase">{k}</div>
                    <div className="font-bold text-[#d8eee5] mt-0.5 truncate">{v}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[#baff38] font-bold mb-2 text-sm">AI SCORE BREAKDOWN ({token.aiScore}/100)</h4>
                  <div className="space-y-1">
                    {Object.entries(token.aiBreakdown).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-[#648176] text-xs">{key.replace(/_/g, ' ')}</span>
                        <span className="text-[#d8eee5] text-xs">+{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[#55aaff] font-bold mb-2 text-sm">ENTRY / EXIT</h4>
                  <div className="text-xs space-y-1 mb-3">
                    <div className="flex justify-between"><span className="text-[#648176]">Entry Quality</span><span className="text-[#22e58a]">{token.entryQuality}/100 ({token.entryPhase})</span></div>
                    <div className="flex justify-between"><span className="text-[#648176]">Exit Pressure</span><span className="text-[#ff5d69]">{token.exitPressure}/100 ({token.exitLevel})</span></div>
                  </div>
                  {token.entryReasons.map((r, i) => <div key={i} className="text-xs text-[#d8eee5]">✓ {r}</div>)}
                  {token.exitReasons.map((r, i) => <div key={i} className="text-xs text-[#ff5d69]">⚠ {r}</div>)}
                </div>
              </div>
            </div>
          )}

          {tab === 'Forensik' && (
            <div className="space-y-4">
              <div className="bg-[#030c08] border rounded-lg p-4 text-center" style={{ borderColor: verdict.color }}>
                <div className="text-[#56766a] text-xs mb-1">SHOULD I APE?</div>
                <div className="text-xl font-black" style={{ color: verdict.color }}>{verdict.verdict}</div>
                <div className="text-xs text-[#648176] mt-1">Zone: {verdict.zone} · Score {ape}/10</div>
              </div>
              <ApeMeter score={ape} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {[
                  ['Harga', formatPrice(token.price)], ['Umur Live', formatAge(token.age)],
                  ['Likuiditas', formatNumber(token.liquidity)], ['Vol 24H', formatNumber(token.volume24h)],
                  ['Buy/Sell 1H', `${token.buys1h}/${token.sells1h}`], ['Buy Ratio', `${buyRatio.toFixed(0)}%`],
                  ['Vol/Liq Ratio', volLiqRatio], ['Risk Score', `${token.riskScore}/100`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#030c08] border border-[#173b2b] rounded p-2.5">
                    <div className="text-[#56766a] text-[10px] uppercase">{k}</div>
                    <div className="font-bold text-[#d8eee5] mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-[#d8eee5] font-bold mb-2 text-sm">RISK CHECKS</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {riskChecks.map(rc => (
                    <div key={rc.label} className="flex items-center justify-between bg-[#030c08] border border-[#173b2b] rounded p-2.5 text-xs">
                      <span className="text-[#648176]">{rc.label}</span>
                      <span className="font-bold" style={{ color: riskColor(rc.level) }}>{riskIcon(rc.level)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {token.riskFlags.length > 0 && (
                <div>
                  <h4 className="text-[#ff5d69] font-bold mb-2 text-sm">FLAGS</h4>
                  {token.riskFlags.map((f, i) => <div key={i} className="text-xs text-[#ff5d69]">⚠ {f}</div>)}
                </div>
              )}
              <div className="flex gap-3 pt-2 border-t border-[#0d2119]">
                <a href={token.dexUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#55aaff] hover:underline">DexScreener →</a>
                <a href={`https://solscan.io/token/${token.address}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#55aaff] hover:underline">Solscan →</a>
              </div>
            </div>
          )}

          {tab === 'AI Analyst' && (
            <div className="space-y-3 text-xs">
              <div className="bg-[rgba(186,255,56,0.06)] border border-[rgba(186,255,56,0.15)] rounded-lg p-3">
                <div className="font-bold text-[#baff38] mb-1">🤖 AI Summary</div>
                <div className="text-[#d8eee5]">
                  {token.aiScore >= 75
                    ? `${token.symbol} menunjukkan sinyal kuat (AI Score ${token.aiScore}/100) dengan buy ratio ${buyRatio.toFixed(0)}%. Fase entry: ${token.entryPhase}. Narrative ${token.narrative} sedang aktif.`
                    : token.riskScore >= 50
                    ? `${token.symbol} memiliki risiko signifikan (Risk ${token.riskScore}/100). Perhatikan flag: ${token.riskFlags[0] || 'volatilitas tinggi'}. Disarankan menunggu konfirmasi.`
                    : `${token.symbol} dalam fase konsolidasi. AI Score ${token.aiScore}/100, Risk ${token.riskScore}/100. Pantau volume dan buy pressure sebelum entry.`}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <SignalBadge signal={token.aiSignal} />
                <RiskBadge score={token.riskScore} />
                <NarrativeBadge narrative={token.narrative} />
              </div>
              <div>
                <div className="text-[#56766a] mb-1">SNIPER SCORE</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-[#10271d] rounded"><div className="h-full rounded bg-[#baff38]" style={{ width: `${computeSniperScore(token)}%` }} /></div>
                  <span className="font-bold text-[#baff38]">{computeSniperScore(token)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Bucket radar — aturan dihitung SERVER-SIDE dari data live
// (mcap + kurva bonding pump.fun + RugCheck). Tidak ada daftar coin
// yang dihardcoded; label & deskripsi di bawah hanyalah tampilan
// dari aturan yang sama dengan BUCKET_RULES di app/api/meme-tokens.
const BUCKET_META: Record<string, { label: string; cls: string; desc: string }> = {
  NEW_BONDING: { label: 'NEW BONDING', cls: 'meme-bucket-new', desc: 'Progress kurva ≥ 15% · mcap masih ≤ $10k' },
  BONDING_RADAR: { label: 'BONDING RADAR', cls: 'meme-bucket-radar', desc: 'Progress kurva 35–99% · mcap ≥ $10k' },
  MOMENTUM: { label: 'MOMENTUM', cls: 'meme-bucket-mom', desc: 'Mcap ≥ $10k + ada gerak volume (vol5m ≥ $500 & ≥ 5 txns)' },
  NONE: { label: 'OFF RADAR', cls: 'meme-bucket-none', desc: 'Tidak lolos aturan bucket ATAU top-10 holder > 25% (terlalu terkonsentrasi)' },
}

function BucketBadge({ bucket }: { bucket: string }) {
  const m = BUCKET_META[bucket] || BUCKET_META.NONE
  return <span className={`meme-bucket ${m.cls}`}>{m.label}</span>
}

// ═══════════════════════ COIN SEARCH ═══════════════════════════
// Pencarian coin on-demand (nama / simbol / alamat mint) lewat
// /api/meme-search → DexScreener search. Hasil dipetakan ke kontrak
// MemeToken yang sama dengan radar (kurva bonding + gerbang holder
// RugCheck 25% + bucket), sehingga klik baris langsung membuka modal
// analisa yang sama: Chart / Info & Analysis / Forensik / AI Analyst.
function CoinSearch({ onSelect }: { onSelect: (t: MemeToken) => void }) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)

  // Debounce 450ms — jangan menembak API publik tiap ketikan
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 450)
    return () => clearTimeout(id)
  }, [q])

  const searchQuery = useQuery({
    queryKey: ['meme-search', debounced],
    queryFn: async () => {
      const res = await fetch(`/api/meme-search?q=${encodeURIComponent(debounced)}&limit=12`)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      return res.json()
    },
    enabled: open && debounced.length >= 2,
    staleTime: 20_000,
  })

  const results: MemeToken[] = searchQuery.data?.tokens || []
  const active = open && debounced.length >= 2

  return (
    <div className="meme-panel">
      <div className="head">
        <span>CARI COIN · ANALISA ON-DEMAND</span>
        <span className="muted">nama / simbol / alamat mint · DexScreener + kurva pump.fun + RugCheck (tanpa hardcode)</span>
      </div>
      <div className="meme-search-bar">
        <input
          value={q}
          onChange={(e: any) => { setQ(e.target.value); setOpen(true) }}
          placeholder="Cari coin… contoh: GRND, bonk, atau tempel alamat mint Solana"
          className="meme-search-input"
          spellCheck={false}
        />
        {q && (
          <button className="meme-btn" onClick={() => { setQ(''); setDebounced(''); setOpen(false) }}>✕ CLEAR</button>
        )}
      </div>
      {active && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-[#0d2119]">
              <th className="text-left py-2 text-[#56766a] font-bold">TOKEN</th>
              <th className="text-left py-2 text-[#56766a] font-bold">BUCKET</th>
              <th className="text-left py-2 text-[#56766a] font-bold">PRICE</th>
              <th className="text-left py-2 text-[#56766a] font-bold">MCAP</th>
              <th className="text-left py-2 text-[#56766a] font-bold">LIQ</th>
              <th className="text-left py-2 text-[#56766a] font-bold">VOL 24H</th>
              <th className="text-left py-2 text-[#56766a] font-bold">TOP-10</th>
              <th className="text-left py-2 text-[#56766a] font-bold">AI</th>
              <th className="text-left py-2 text-[#56766a] font-bold">RISK</th>
              <th className="text-left py-2 text-[#56766a] font-bold">SIGNAL</th>
              <th className="text-left py-2 text-[#56766a] font-bold">ANALISA</th>
            </tr></thead>
            <tbody>
              {searchQuery.isLoading ? (
                <tr><td colSpan={11} className="py-6 text-center text-[#475569]"><span className="g-spinner lg"></span> Mencari “{debounced}”…</td></tr>
              ) : searchQuery.error ? (
                <tr><td colSpan={11} className="py-6 text-center text-[#f87171]">Pencarian gagal. <button onClick={() => searchQuery.refetch()} className="underline">Coba lagi</button></td></tr>
              ) : results.length === 0 ? (
                <tr><td colSpan={11} className="py-6 text-center text-[#475569]">Tidak ada pair Solana untuk “{debounced}”. Coba simbol lain atau tempel alamat mint.</td></tr>
              ) : results.map((token: MemeToken) => (
                <tr key={token.pairAddress || token.address} className="border-b border-[#0d2119] hover:bg-[#07160f] cursor-pointer transition-colors" onClick={() => onSelect(token)} title={token.bucketReason}>
                  <td className="py-2"><div className="flex items-center gap-2"><span className="font-bold text-[#baff38]">{token.symbol}</span><span className="text-[#648176] max-w-[160px] truncate">{token.name}</span>{token.isBoosted && <span className="text-[9px] text-[#ffc94d]">BOOST</span>}</div></td>
                  <td className="py-2"><BucketBadge bucket={token.bucket} /></td>
                  <td className="py-2"><span className={token.priceChange1h >= 0 ? 'text-green' : 'text-red'}>{token.priceChange1h >= 0 ? '+' : ''}{token.priceChange1h.toFixed(1)}%</span><div className="text-[#648176] text-xs">{formatPrice(token.price)}</div></td>
                  <td className="py-2 text-[#d8eee5]">{token.mcap ? formatNumber(token.mcap) : '—'}</td>
                  <td className="py-2 text-[#d8eee5]">{formatNumber(token.liquidity)}</td>
                  <td className="py-2 text-[#d8eee5]">{formatNumber(token.volume24h)}</td>
                  <td className="py-2">
                    <span className="font-bold" style={{ color: token.holderGate === 'FAIL' ? '#ff5d69' : token.holderGate === 'PASS' ? '#22e58a' : '#648176' }}>
                      {token.holderGate === 'UNKNOWN' ? '—' : `${(token.top10HolderPct || 0).toFixed(1)}%`}
                    </span>
                    {token.holderGate === 'FAIL' && <div className="text-[9px] text-[#ff5d69]">GATE FAIL</div>}
                  </td>
                  <td className="py-2"><span className="font-bold text-[#baff38]">{token.aiScore}</span></td>
                  <td className="py-2"><RiskBadge score={token.riskScore} /></td>
                  <td className="py-2"><SignalBadge signal={token.aiSignal} /></td>
                  <td className="py-2"><button className="meme-btn" onClick={(e: any) => { e.stopPropagation(); onSelect(token) }}>ANALISA →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// SOL price card with a live-accumulated curve — same visual language as
// Dashboard's "EQUITY / PNL CURVE" (area chart, gradient fill, green/red by
// trend), but fed by the SOL price already flowing through this page's own
// polling instead of a new external history fetch.
function SolPriceChart({ solUsd, history }: { solUsd: number; history: { t: number; price: number }[] }) {
  // Sebelum ada ≥2 titik nyata, gambar garis datar di harga saat ini (bukan
  // placeholder teks) — tetap jujur (nilainya harga real, cuma diulang jadi
  // 2 titik biar ada garis) dan terasa seperti chart yang benar-benar hidup,
  // bukan kotak kosong menunggu data.
  const hasRealCurve = history.length > 1
  const points = hasRealCurve || !solUsd
    ? history
    : history.length === 1
      ? [{ t: history[0].t - 60_000, price: history[0].price }, history[0]]
      : [{ t: Date.now() - 60_000, price: solUsd }, { t: Date.now(), price: solUsd }]
  const data = points.map((p) => ({
    label: new Date(p.t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    price: p.price,
  }))
  const first = points[0]?.price ?? solUsd
  const last = points[points.length - 1]?.price ?? solUsd
  const color = last >= first ? '#22e58a' : '#ff5d69'
  const prices = points.map((p) => p.price)
  const domain: [number, number] | undefined = prices.length
    ? [Math.min(...prices) * 0.999 || 0, (Math.max(...prices) * 1.001) || 1]
    : undefined

  return (
    <div className="meme-cc-kpi meme-cc-kpi-chart">
      <div className="meme-cc-kpi-chart-head">
        <div>
          <label>SOL PRICE · BASIS KURVA</label>
          <b className="good">{solUsd ? `$${solUsd.toFixed(2)}` : '—'}</b>
        </div>
        <span className="meme-cc-kpi-chart-hint">{hasRealCurve ? `${history.length} titik · live` : 'Mengumpulkan data…'}</span>
      </div>
      {data.length > 1 ? (
        <ResponsiveContainer width="100%" height={90}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="meme-sol-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <YAxis domain={domain} hide />
            <Tooltip
              contentStyle={{ background: '#06140e', border: '1px solid #123a2b', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#648176' }}
              itemStyle={{ color }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'SOL']}
            />
            <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2} fill="url(#meme-sol-gradient)" isAnimationActive={hasRealCurve} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="meme-cc-kpi-chart-empty">Menunggu harga SOL pertama…</div>
      )}
    </div>
  )
}

// Balance card — baca native SOL balance dari address publik yang di-input
// user (bukan wallet-connect/signing), lalu dinilai dalam USD pakai harga SOL
// yang sama. Kurvanya "nilai portofolio" (bukan realized PNL — itu butuh
// menelusuri seluruh histori transaksi on-chain, di luar cakupan saat ini),
// diakumulasi live persis seperti SolPriceChart.
function WalletBalanceCard() {
  const [address, setAddress] = useState('DM3my1HYwmkSRLp9FduCmgRAR9Wv7CUEf5UZvU8taZhi')
  const [inputValue, setInputValue] = useState(address)
  const [history, setHistory] = useState<{ t: number; value: number }[]>([])

  const isValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)

  const { data, isLoading, error } = useQuery({
    queryKey: ['wallet-balance', address],
    queryFn: async () => {
      const res = await fetch(`/api/wallet-balance?address=${encodeURIComponent(address)}`)
      const json = await res.json()
      if (!res.ok || json.ok === false) throw new Error(json.error || 'Gagal membaca balance')
      return json as { solBalance: number; solPriceUsd: number; balanceUsd: number }
    },
    enabled: isValid,
    refetchInterval: 20_000,
    retry: 1,
  })

  useEffect(() => {
    setHistory([])
  }, [address])

  useEffect(() => {
    if (!data || !(data.balanceUsd >= 0)) return
    setHistory((prev) => {
      if (prev.length && prev[prev.length - 1].value === data.balanceUsd) return prev
      const next = [...prev, { t: Date.now(), value: data.balanceUsd }]
      return next.length > 60 ? next.slice(next.length - 60) : next
    })
  }, [data])

  const hasRealCurve = history.length > 1
  const points = hasRealCurve
    ? history
    : history.length === 1
      ? [{ t: history[0].t - 60_000, value: history[0].value }, history[0]]
      : data
        ? [{ t: Date.now() - 60_000, value: data.balanceUsd }, { t: Date.now(), value: data.balanceUsd }]
        : []
  const chartData = points.map((p) => ({
    label: new Date(p.t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    value: p.value,
  }))
  const first = points[0]?.value ?? 0
  const last = points[points.length - 1]?.value ?? 0
  const color = last >= first ? '#22e58a' : '#ff5d69'
  const values = points.map((p) => p.value)
  const domain: [number, number] | undefined = values.length
    ? [(Math.min(...values) * 0.999) || 0, (Math.max(...values) * 1.001) || 1]
    : undefined

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(inputValue.trim())) setAddress(inputValue.trim())
  }

  return (
    <div className="meme-cc-kpi meme-cc-kpi-chart">
      <div className="meme-cc-kpi-chart-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <label>BALANCE · WALLET SAYA</label>
          <b className="good">{data ? `$${data.balanceUsd.toFixed(2)}` : isLoading ? '…' : '—'}</b>
          {data && <span className="meme-cc-wallet-sub">{data.solBalance.toFixed(4)} SOL</span>}
        </div>
        <span className="meme-cc-kpi-chart-hint">{error ? 'Gagal baca wallet' : hasRealCurve ? `${history.length} titik · live` : 'Mengumpulkan data…'}</span>
      </div>
      <form onSubmit={handleSubmit} className="meme-cc-wallet-input-row">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Paste alamat wallet Solana…"
          className="meme-cc-wallet-input"
          spellCheck={false}
        />
        <button type="submit" className="meme-cc-wallet-submit">Cek</button>
      </form>
      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="meme-wallet-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <YAxis domain={domain} hide />
            <Tooltip
              contentStyle={{ background: '#06140e', border: '1px solid #123a2b', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#648176' }}
              itemStyle={{ color }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Balance']}
            />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#meme-wallet-gradient)" isAnimationActive={hasRealCurve} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="meme-cc-kpi-chart-empty">
          {!isValid ? 'Masukkan alamat wallet Solana yang valid.' : error ? String((error as Error).message) : 'Membaca balance…'}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════ RADAR SECTION ═══════════════════════════
function RadarSection({ tokens, meta, isLoading, error, onSelect, sortBy, setSortBy, narrativeFilter, setNarrativeFilter, minLiquidity, setMinLiquidity, bucketFilter, setBucketFilter, page, pageSize, total, totalPages, setPage, setPageSize, refetch }: any) {
  const counts: Record<string, number> = meta?.bucketCounts || {}
  const solUsd: number = meta?.solPriceUsd || 0
  // Kurva SOL price — diakumulasi live dari solUsd yang sudah mengalir lewat
  // polling /api/meme-tokens (bukan fetch histori eksternal baru), satu titik
  // baru dicatat tiap kali harga berubah dari titik terakhir. Grafik dimulai
  // kosong dan terisi selama tab dibuka — bukan data dummy.
  const [solHistory, setSolHistory] = useState<{ t: number; price: number }[]>([])
  useEffect(() => {
    if (!(solUsd > 0)) return
    setSolHistory((prev) => {
      if (prev.length && prev[prev.length - 1].price === solUsd) return prev
      const next = [...prev, { t: Date.now(), price: solUsd }]
      return next.length > 60 ? next.slice(next.length - 60) : next
    })
  }, [solUsd])
  const gateMax: number = meta?.holderGateMaxPct ?? 25
  const coverage: number = meta?.holderCoverage ?? 0
  const pv = meta?.pumpFunVolume || { tokens: 0, vol5m: 0, vol24h: 0, txns5m: 0 }

  // ─── QUALITY SCANNER (spec meme-scanner) ─────────────────────────────
  // Setiap token radar dipetakan ke MemeAlert (estimateAlertFromToken) lalu
  // dinilai dengan pipeline yang sama persis: HARD VETO dulu, baru skor
  // 0-100. Field yang tidak ada di feed radar (creatorLaunches, KOL, TH1-5)
  // diisi proxy/netral dan ditandai `estimatedFields` — jujur soal estimasi.
  const verdicts = useMemo(() => {
    const m: Record<string, ReturnType<typeof scanMemeToken>> = {}
    ;(tokens || []).forEach((t: MemeToken) => { m[t.address] = scanMemeToken(t) })
    return m
  }, [tokens])
  const [scanFilter, setScanFilter] = useState('all')
  const scanCounts = useMemo(() => {
    const c: Record<string, number> = { STRONG: 0, WATCH: 0, WEAK: 0, REJECT: 0 }
    Object.values(verdicts).forEach(v => { c[v.decision] = (c[v.decision] || 0) + 1 })
    return c
  }, [verdicts])

  // Kirim batch alert ke tracker outcome (server-side, idempotent per
  // contractAddress — first sighting menang sebagai baseline kalibrasi).
  // Debounce 2s supaya tidak menembak API tiap render/refetch 30s.
  useEffect(() => {
    if (!tokens?.length) return
    const alerts = tokens.map((t: MemeToken) => estimateAlertFromToken(t).alert)
    const id = setTimeout(() => {
      fetch('/api/meme-scanner?action=evaluate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts }),
      }).catch(() => { /* tracker offline bukan fatal untuk radar */ })
    }, 2000)
    return () => clearTimeout(id)
  }, [tokens])

  // Snapshot outcome tracker (§4): berapa token terlacak, berapa sudah
  // final ≥24h, dan akurasi keputusan per bucket — bahan rekalibrasi formula.
  const trackerQuery = useQuery({
    queryKey: ['meme-scanner-tracker'],
    queryFn: async () => {
      const res = await fetch('/api/meme-scanner')
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      return res.json()
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const tracker = trackerQuery.data
  const [refreshingOutcomes, setRefreshingOutcomes] = useState(false)
  const forceRefreshOutcomes = async () => {
    setRefreshingOutcomes(true)
    try {
      await fetch('/api/meme-scanner?action=refresh', { method: 'POST' })
      await trackerQuery.refetch()
    } catch { /* abaikan */ }
    setRefreshingOutcomes(false)
  }

  const visibleTokens: MemeToken[] = scanFilter === 'all'
    ? tokens
    : (tokens || []).filter((t: MemeToken) => verdicts[t.address]?.decision === scanFilter)

  const chips = [
    { key: 'all', label: 'ALL', cnt: meta?.total ?? tokens.length },
    { key: 'NEW_BONDING', label: 'NEW BONDING', cnt: counts.NEW_BONDING || 0 },
    { key: 'BONDING_RADAR', label: 'BONDING RADAR', cnt: counts.BONDING_RADAR || 0 },
    { key: 'MOMENTUM', label: 'MOMENTUM', cnt: counts.MOMENTUM || 0 },
    { key: 'NONE', label: 'OFF RADAR', cnt: counts.NONE || 0 },
  ]
  return (
    <>
      {/* Kiri: kartu showcase dekoratif (pajangan saja, tanpa data live).
          Kanan: KPI strip — semua angka berasal dari API live (feed + kurva
          + RugCheck), bertumpuk 3 tier: SOL PRICE sendirian di atas,
          kelompok bonding di tengah, sisanya di bawah. */}
      <div className="meme-cc-metric-row">
        <RadarShowcaseCard />
        <div className="meme-cc-metric-grid">
          <div className="meme-cc-metric-top meme-cc-metric-top-split">
            <SolPriceChart solUsd={solUsd} history={solHistory} />
            <WalletBalanceCard />
          </div>
          <div className="meme-cc-metric-mid">
            <div className="meme-cc-kpi" title={`Volume agregat ${pv.tokens} token yang MASIH di kurva bonding pump.fun (dexId=pumpfun) · ${pv.txns5m} txns/5m`}>
              <label>VOL PUMP.FUN · {pv.tokens} TOKEN BONDING</label>
              <b className="lime">{formatNumber(pv.vol5m)}</b>
              <small>5m · 24h {formatNumber(pv.vol24h)} · {pv.txns5m} txns</small>
            </div>
            <div className="meme-cc-kpi"><label>NEW BONDING · ≥15% & ≤$10K</label><b className="lime">{counts.NEW_BONDING || 0}</b></div>
            <div className="meme-cc-kpi"><label>BONDING RADAR · 35–99% & ≥$10K</label><b className="good">{counts.BONDING_RADAR || 0}</b></div>
          </div>
          <div className="meme-cc-metric-bottom">
            <div className="meme-cc-kpi"><label>MOMENTUM · ≥$10K + VOL GERAK</label><b className="warn">{counts.MOMENTUM || 0}</b></div>
            <div className="meme-cc-kpi"><label>GERBANG TOP-10 HOLDER</label><b className="lime">≤ {gateMax}%</b></div>
            <div className="meme-cc-kpi"><label>CAKUPAN DATA HOLDER</label><b>{coverage} token</b></div>
          </div>
        </div>
      </div>

      {/* Chip filter bucket — filter server-side, jumlah dihitung dari seluruh feed */}
      <div className="meme-cc-chips">
        {chips.map(c => (
          <button key={c.key} className={`meme-cc-chip ${bucketFilter === c.key ? 'active' : ''}`} onClick={() => setBucketFilter(c.key)} title={BUCKET_META[c.key]?.desc || 'Semua token (tunduk pada filter min-liq)'}>
            {c.label}<span className="cnt">{c.cnt}</span>
          </button>
        ))}
      </div>

      {/* ─── QUALITY SCANNER PANEL (spec meme-scanner §2-§4) ───────────────
          Hard veto → skor 0-100 untuk SEMUA token radar. Chip di kanan
          memfilter tabel berdasarkan verdict. Panel bawah = outcome tracker:
          setiap verdict disimpan server-side dan MC-nya di-recheck via
          DexScreener (tiap jam, sampai 24h) untuk memvalidasi formula. */}
      <div className="meme-panel">
        <div className="head">
          <span>QUALITY SCANNER · HARD VETO → SKOR 0-100</span>
          <span className="muted">{'veto: creator >3000 launch · LP <$5K · bundle >60% · organic <25% · TH1 >30% — field tanpa data feed diisi proxy/netral (est.)'}</span>
        </div>
        <div className="meme-cc-chips">
          {[
            { key: 'all', label: 'SEMUA', cnt: meta?.total ?? tokens.length, color: undefined },
            { key: 'STRONG', label: 'STRONG ≥65', cnt: scanCounts.STRONG || 0, color: QUALITY_META.STRONG.color },
            { key: 'WATCH', label: 'WATCH 45-64', cnt: scanCounts.WATCH || 0, color: QUALITY_META.WATCH.color },
            { key: 'WEAK', label: 'WEAK <45', cnt: scanCounts.WEAK || 0, color: QUALITY_META.WEAK.color },
            { key: 'REJECT', label: 'REJECT (VETO)', cnt: scanCounts.REJECT || 0, color: QUALITY_META.REJECT.color },
          ].map(c => (
            <button
              key={c.key}
              className={`meme-cc-chip ${scanFilter === c.key ? 'active' : ''}`}
              onClick={() => setScanFilter(c.key)}
              style={c.color && scanFilter !== c.key ? { color: c.color } : undefined}
              title={c.key === 'all' ? 'Tampilkan semua token' : `Filter tabel radar: hanya ${c.label}`}
            >
              {c.label}<span className="cnt">{c.cnt}</span>
            </button>
          ))}
        </div>
        {/* Outcome tracker (§4) — kalibrasi formula dari hasil nyata */}
        <div className="flex gap-3 items-center flex-wrap text-[10px] text-[#648176] mt-2">
          <span className="font-bold text-[#56766a]">OUTCOME TRACKER (24H):</span>
          {tracker ? (
            <>
              <span>{tracker.total} terlacak · {tracker.active} aktif · <b className="text-[#d8eee5]">{tracker.finalized} final</b></span>
              {(tracker.accuracy || []).filter((a: any) => a.total > 0).map((a: any) => (
                <span key={a.decision} style={{ color: QUALITY_META[a.decision]?.color }}>
                  {a.decision}: {a.correct}/{a.total} benar{a.pct != null ? ` (${a.pct}%)` : ''}
                </span>
              ))}
              {tracker.finalized === 0 && <span>belum ada outcome final — butuh ≥24 jam sejak token pertama terlacak</span>}
              <span className="muted">refresh MC terakhir: {tracker.lastRefreshAt ? new Date(tracker.lastRefreshAt).toLocaleTimeString('en-GB', { hour12: false }) : '—'}</span>
            </>
          ) : <span>memuat snapshot tracker…</span>}
          <button className="meme-btn" onClick={forceRefreshOutcomes} disabled={refreshingOutcomes} title="Paksa re-check MC semua token terlacak via DexScreener sekarang">
            {refreshingOutcomes ? 'REFRESHING…' : '↻ RE-CHECK MC'}
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <select value={sortBy} onChange={(e: any) => setSortBy(e.target.value)} className="meme-select">
          <option value="ai_score">Sort: AI Score</option>
          <option value="risk_score">Sort: Risk Score</option>
          <option value="mcap">Sort: Market Cap</option>
          <option value="progress">Sort: Bonding Progress</option>
          <option value="top10">Sort: Top-10 Holder (teraman)</option>
          <option value="volume">Sort: Volume</option>
          <option value="liquidity">Sort: Liquidity</option>
          <option value="price_change">Sort: Price Change</option>
          <option value="newest">Sort: Newest</option>
          <option value="exit_pressure">Sort: Exit Pressure</option>
        </select>
        <select value={narrativeFilter} onChange={(e: any) => setNarrativeFilter(e.target.value)} className="meme-select">
          <option value="all">All Narratives</option>
          <option value="PEPE">PEPE</option><option value="DOG">DOG</option><option value="CAT">CAT</option>
          <option value="AI">AI</option><option value="POLITICAL">POLITICAL</option><option value="GAMING">GAMING</option>
        </select>
        <select value={minLiquidity} onChange={(e: any) => setMinLiquidity(Number(e.target.value))} className="meme-select" disabled={bucketFilter !== 'all'} title={bucketFilter !== 'all' ? 'Nonaktif saat bucket dipilih — token bonding secara alami liq < $10k' : 'Filter likuiditas minimum'}>
          <option value={5000}>Min Liq $5K</option><option value={10000}>Min Liq $10K</option><option value={25000}>Min Liq $25K</option>
          <option value={50000}>Min Liq $50K</option><option value={100000}>Min Liq $100K</option>
        </select>
        <button onClick={() => refetch()} className="meme-btn">REFRESH</button>
        {bucketFilter !== 'all' && (
          <span className="meme-cc-note">min-liq nonaktif saat bucket aktif — token di kurva bonding secara alami liq di bawah $10k; gerbang holder ≤ {gateMax}% yang menyaring</span>
        )}
      </div>
      <div className="meme-panel">
        <div className="head">
          <span>LIVE MEME TOKEN RADAR · SOLANA{bucketFilter !== 'all' ? ` · ${BUCKET_META[bucketFilter]?.label || bucketFilter}` : ''}</span>
          <span className="muted">{meta?.total ?? tokens.length} token · halaman {page}/{totalPages} · sumber: feed live + suplemen DexScreener (profiles/boosts) + kurva pump.fun + RugCheck{meta?.sourceCounts ? ` · proxy ${meta.sourceCounts.proxyFeed} + suplemen ${meta.sourceCounts.dexscreenerSupplement}` : ''} (tanpa daftar hardcode)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-[#0d2119]">
              <th className="text-left py-2 px-2 text-[#56766a] font-bold">TOKEN</th>
              <th className="text-left py-2 text-[#56766a] font-bold">BUCKET</th>
              <th className="text-left py-2 text-[#56766a] font-bold">PRICE</th>
              <th className="text-left py-2 text-[#56766a] font-bold">MCAP</th>
              <th className="text-left py-2 text-[#56766a] font-bold">BONDING</th>
              <th className="text-left py-2 text-[#56766a] font-bold">TOP-10</th>
              <th className="text-left py-2 text-[#56766a] font-bold">LIQ</th>
              <th className="text-left py-2 text-[#56766a] font-bold">VOL 24H</th>
              <th className="text-left py-2 text-[#56766a] font-bold">BUY/SELL</th>
              <th className="text-left py-2 text-[#56766a] font-bold">AI</th>
              <th className="text-left py-2 text-[#56766a] font-bold">RISK</th>
              <th className="text-left py-2 text-[#56766a] font-bold">SIGNAL</th>
              <th className="text-left py-2 text-[#56766a] font-bold">SCANNER</th>
              <th className="text-left py-2 text-[#56766a] font-bold">AGE</th>
              <th className="text-left py-2 text-[#56766a] font-bold">GMGN</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={15} className="py-8 text-center text-[#475569]"><span className="g-spinner lg"></span> Loading meme tokens...</td></tr>
              ) : error ? (
                <tr><td colSpan={15} className="py-8 text-center text-[#f87171]">Error loading data. <button onClick={() => refetch()} className="underline">Retry</button></td></tr>
              ) : visibleTokens.length === 0 ? (
                <tr><td colSpan={15} className="py-8 text-center text-[#475569]">Tidak ada token di bucket/filter ini. Pilih bucket atau verdict lain, atau REFRESH.</td></tr>
              ) : visibleTokens.map((token: MemeToken) => (
                <tr key={token.pairAddress || token.address} className="border-b border-[#0d2119] hover:bg-[#07160f] cursor-pointer transition-colors" onClick={() => onSelect(token)} title={token.bucketReason}>
                  <td className="py-2 px-2"><div className="flex items-center gap-2"><span className="font-bold text-[#baff38]">{token.symbol}</span><span className="text-[#648176] max-w-[140px] truncate">{token.name}</span></div></td>
                  <td className="py-2"><BucketBadge bucket={token.bucket} /></td>
                  <td className="py-2"><span className={token.priceChange1h >= 0 ? 'text-green' : 'text-red'}>{token.priceChange1h >= 0 ? '+' : ''}{token.priceChange1h.toFixed(1)}%</span><div className="text-[#648176] text-xs">{formatPrice(token.price)}</div></td>
                  <td className="py-2 text-[#d8eee5]">{token.mcap ? formatNumber(token.mcap) : '—'}</td>
                  <td className="py-2">
                    {token.bondingStage === 'GRADUATED' ? <span className="text-[#648176] text-[10px]">GRADUATED</span>
                      : token.bondingStage === 'BONDING' ? (
                        <div className="flex items-center gap-2" title={`${(token.bondingRaisedSol || 0).toFixed(1)}/85 SOL terkumpul di kurva`}>
                          <div className="meme-cc-bar"><i style={{ width: `${Math.min(100, Math.max(0, token.bondingProgress || 0))}%` }} /></div>
                          <span className="text-[10px]">{(token.bondingProgress || 0).toFixed(0)}%</span>
                        </div>)
                      : <span className="text-[#648176]">—</span>}
                  </td>
                  <td className="py-2" title={token.holderGate === 'UNKNOWN' ? 'Data holder RugCheck tidak tersedia' : `Raw ${(token.top10RawPct || 0).toFixed(1)}% (termasuk vault AMM/LP) · gerbang ≤ ${gateMax}%`}>
                    <span className="font-bold" style={{ color: token.holderGate === 'FAIL' ? '#ff5d69' : token.holderGate === 'PASS' ? '#22e58a' : '#648176' }}>
                      {token.holderGate === 'UNKNOWN' ? '—' : `${(token.top10HolderPct || 0).toFixed(1)}%`}
                    </span>
                    {token.holderGate === 'FAIL' && <div className="text-[9px] text-[#ff5d69]">GATE FAIL</div>}
                  </td>
                  <td className="py-2 text-[#d8eee5]">{formatNumber(token.liquidity)}</td>
                  <td className="py-2 text-[#d8eee5]">{formatNumber(token.volume24h)}</td>
                  <td className="py-2"><span className="text-green">B:{token.buys1h}</span> <span className="text-red">S:{token.sells1h}</span></td>
                  <td className="py-2"><div className="flex items-center gap-2"><span className="font-bold text-[#baff38]">{token.aiScore}</span><div className="w-12 h-1.5 bg-[#10271d] rounded"><div className="h-full rounded bg-[#baff38]" style={{ width: `${token.aiScore}%` }} /></div></div></td>
                  <td className="py-2"><RiskBadge score={token.riskScore} /></td>
                  <td className="py-2"><SignalBadge signal={token.aiSignal} /></td>
                  <td className="py-2">
                    {verdicts[token.address] && (
                      <QualityBadge
                        decision={verdicts[token.address].decision}
                        score={verdicts[token.address].score}
                        reason={`${verdicts[token.address].reason}${verdicts[token.address].estimatedFields?.length ? ` · field estimasi: ${verdicts[token.address].estimatedFields.join(', ')}` : ''}`}
                      />
                    )}
                  </td>
                  <td className="py-2 text-[#648176]">{formatAge(token.age)}</td>
                  <td className="py-2">
                    <a
                      href={`https://gmgn.ai/sol/token/${token.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="meme-btn meme-btn-sm"
                      title={`Buka ${token.symbol} di GMGN`}
                    >
                      GMGN ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* PAGINATION — SELALU tampil (dulu disembunyikan saat totalPages ≤ 1,
            inilah sebabnya user tidak pernah melihat pagination ketika feed
            proxy hanya meloloskan ±14 token). total = seluruh token yang lolos
            filter (bukan yang dikirim), page di-reset otomatis saat filter atau
            ukuran halaman berubah (lihat useEffect di parent). */}
        <div className="flex items-center justify-between gap-3 mt-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#648176]">
              Halaman {page} / {totalPages} · {total} token total{total > 0 ? ` · menampilkan ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}` : ''}
            </span>
            <select
              value={pageSize}
              onChange={(e: any) => setPageSize(Number(e.target.value))}
              className="meme-select"
              title="Jumlah baris per halaman"
            >
              <option value={25}>25 / hal</option>
              <option value={50}>50 / hal</option>
              <option value={100}>100 / hal</option>
            </select>
          </div>
          <div className="flex gap-1">
            <button
              className="meme-btn meme-btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              title="Ke halaman 1"
            >« Awal</button>
            <button
              className="meme-btn meme-btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p: number) => Math.max(1, p - 1))}
              title="Halaman sebelumnya"
            >‹ Seblm</button>
            <button
              className="meme-btn meme-btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
              title="Halaman berikutnya"
            >Selanjut ›</button>
            <button
              className="meme-btn meme-btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              title="Ke halaman akhir"
            >Akhir »</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════ SNIPER SECTION ═══════════════════════════
function SniperSection({ tokens, isLoading, mode, setMode, onSelect, refetch }: any) {
  const candidates: MemeToken[] = useMemo(() => {
    let list: MemeToken[] = tokens
    if (mode === 'early') {
      list = list.filter(t => t.entryPhase === 'EARLY' || t.age < 240)
      list = [...list].sort((a, b) => b.entryQuality - a.entryQuality || b.aiScore - a.aiScore)
    } else {
      list = list.filter(t => t.priceChange1h > 3 && t.volumeAcceleration > 1)
      list = [...list].sort((a, b) => b.priceChange1h - a.priceChange1h || b.aiScore - a.aiScore)
    }
    return list.slice(0, 24)
  }, [tokens, mode])

  const counts = useMemo(() => {
    const c = { hot: 0, watch: 0, setup: 0 }
    candidates.forEach(t => {
      const b = sniperBucket(computeSniperScore(t)).label
      if (b === 'HOT') c.hot++
      else if (b === 'WATCH') c.watch++
      else if (b === 'SETUP') c.setup++
    })
    return c
  }, [candidates])

  return (
    <>
      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <div className="flex gap-1">
          <button onClick={() => setMode('early')} className="meme-btn" style={{ color: mode === 'early' ? '#baff38' : undefined, borderColor: mode === 'early' ? '#607c2b' : undefined }}>⚡ EARLY ENTRY</button>
          <button onClick={() => setMode('momentum')} className="meme-btn" style={{ color: mode === 'momentum' ? '#baff38' : undefined, borderColor: mode === 'momentum' ? '#607c2b' : undefined }}>🚀 MOMENTUM RIDER</button>
        </div>
        <button onClick={() => refetch()} className="meme-btn">REFRESH</button>
      </div>

      <div className="meme-panel mb-4">
        <div className="head">
          <span>{mode === 'early' ? 'EARLY ENTRY MODE' : 'MOMENTUM RIDER MODE'}</span>
          <span className="muted">{mode === 'early' ? 'Deteksi akumulasi smart money sebelum harga bergerak' : 'Ikuti token yang sedang breakout dengan volume tinggi'}</span>
        </div>
        <div className="p-3 grid grid-cols-3 gap-3 text-center">
          <div><div className="text-lg font-bold text-[#ff5d69]">{counts.hot}</div><div className="text-[10px] text-[#648176]">HOT</div></div>
          <div><div className="text-lg font-bold text-[#ffc85b]">{counts.watch}</div><div className="text-[10px] text-[#648176]">WATCH</div></div>
          <div><div className="text-lg font-bold text-[#55aaff]">{counts.setup}</div><div className="text-[10px] text-[#648176]">SETUP</div></div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-[#475569]"><span className="g-spinner lg"></span> Scanning...</div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-8 text-[#475569]">Tidak ada kandidat untuk mode ini saat ini.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {candidates.map(t => {
            const score = computeSniperScore(t)
            const bucket = sniperBucket(score)
            const buyRatio = parseFloat(t.buySellRatio || '50') || 50
            return (
              <div key={t.pairAddress || t.address} onClick={() => onSelect(t)}
                className="bg-[#06140e] border border-[#173b2b] rounded p-3 cursor-pointer hover:border-[#baff38] transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <CoinIcon symbol={t.symbol} size={24} />
                    <div>
                      <div className="font-bold text-[#baff38] text-sm">{t.symbol}</div>
                      <div className="text-[10px] text-[#648176]">{formatPrice(t.price)}</div>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ color: bucket.color, background: bucket.color + '22' }}>{bucket.label}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-2 bg-[#10271d] rounded"><div className="h-full rounded" style={{ width: `${score}%`, background: bucket.color }} /></div>
                  <span className="text-xs font-bold" style={{ color: bucket.color }}>{score}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px] text-[#648176] mb-2">
                  <div>LIQ<div className="text-[#d8eee5] font-semibold">{formatNumber(t.liquidity)}</div></div>
                  <div>AGE<div className="text-[#d8eee5] font-semibold">{formatAge(t.age)}</div></div>
                  <div>1H<div className={t.priceChange1h >= 0 ? 'text-green font-semibold' : 'text-red font-semibold'}>{t.priceChange1h >= 0 ? '+' : ''}{t.priceChange1h.toFixed(1)}%</div></div>
                </div>
                <div className="h-1.5 bg-[#10271d] rounded overflow-hidden flex mb-2">
                  <div className="h-full bg-[#22e58a]" style={{ width: `${buyRatio}%` }} />
                  <div className="h-full bg-[#ff5d69]" style={{ width: `${100 - buyRatio}%` }} />
                </div>
                <div className="flex gap-2">
                  <a href={t.dexUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex-1 text-center text-[10px] py-1 rounded bg-[rgba(85,170,255,0.12)] text-[#55aaff] font-bold">CHART</a>
                  <a href={`https://jup.ag/swap/SOL-${t.address}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex-1 text-center text-[10px] py-1 rounded bg-[rgba(186,255,56,0.12)] text-[#baff38] font-bold">BUY</a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ═══════════════════════ WALLETS SECTION ═══════════════════════════
function WalletsSection({ data, isLoading, error, refetch }: any) {
  const [selectedWallet, setSelectedWallet] = useState<MemeWallet | null>(null)
  const wallets: MemeWallet[] = data?.wallets || []
  // provider 'helius' = data on-chain ASLI (alamat lengkap + PnL nyata);
  // 'simulated' = demo tanpa API key. Banner di bawah memberi tahu user.
  const provider = data?.provider || 'simulated'
  const isLive = provider === 'helius'
  return (
    <>
      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <button onClick={() => refetch()} className="meme-btn">REFRESH</button>
        {isLive ? (
          <span className="px-2 py-1 rounded text-[11px] font-bold bg-[#06251a] text-[#22e58a] border border-[#173b2b]">
            ● LIVE ON-CHAIN · HELIUS
            {typeof data?.total === 'number' ? ` · ${data.total} wallet` : ''}
            {typeof data?.legs === 'number' ? ` · ${data.legs} swap` : ''}
            {typeof data?.mintsQueried === 'number' ? ` · ${data.mintsQueried} mint` : ''}
          </span>
        ) : (
          <span className="px-2 py-1 rounded text-[11px] font-bold bg-[#2a1f06] text-[#f0b429] border border-[#3b2f10]">
            ● DEMO / SIMULATED — set HELIUS_API_KEY untuk wallet on-chain asli
          </span>
        )}
        {data?.note ? <span className="text-[#648176] text-[11px]">{data.note}</span> : null}
      </div>
      <div className="meme-panel">
        <div className="head"><span>SMART WALLET RADAR</span><span className="muted">Behavioral Edge</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-[#0d2119]">
              <th className="text-left py-2 text-[#56766a] font-bold">WALLET</th>
              <th className="text-left py-2 text-[#56766a] font-bold">DNA</th>
              <th className="text-left py-2 text-[#56766a] font-bold">SCORE</th>
              <th className="text-left py-2 text-[#56766a] font-bold">P&L (SOL)</th>
              <th className="text-left py-2 text-[#56766a] font-bold">WIN RATE</th>
              <th className="text-left py-2 text-[#56766a] font-bold">TRADES</th>
              <th className="text-left py-2 text-[#56766a] font-bold">CATEGORY</th>
              <th className="text-left py-2 text-[#56766a] font-bold">LAST ACTIVE</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="py-8 text-center text-[#475569]"><span className="g-spinner lg"></span> Loading wallets...</td></tr>
              ) : error ? (
                <tr><td colSpan={8} className="py-8 text-center text-[#f87171]">Error loading data.</td></tr>
              ) : wallets.map(wallet => (
                <tr key={wallet.id} className="border-b border-[#0d2119] hover:bg-[#07160f] cursor-pointer" onClick={() => setSelectedWallet(wallet)}>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-bold text-[#baff38]" title={wallet.address}>{wallet.shortAddr}</div>
                        <div className="text-[#648176] text-xs">{wallet.label}</div>
                      </div>
                      {/* Mode DEMO: address = placeholder pendek palsu (mis. "4vH...6Rt"),
                          bukan wallet on-chain asli — tombol SALIN dinonaktifkan agar
                          tidak menyesatkan. Dengan HELIUS_API_KEY, address = alamat
                          Solana LENGKAP dan tombol aktif kembali. */}
                      <CopyButton
                        value={wallet.address}
                        label="alamat wallet"
                        disabled={!isLive}
                        disabledTitle="Mode DEMO — alamat hanya placeholder, bukan wallet asli. Set HELIUS_API_KEY di .env untuk alamat on-chain lengkap."
                      />
                    </div>
                  </td>
                  <td className="py-2"><span className="px-2 py-0.5 rounded text-xs font-bold bg-[#0c2a4a] text-[#38bdf8] border border-[#0369a1]">{wallet.dna}</span></td>
                  <td className="py-2"><div className="flex items-center gap-2"><span className="font-bold text-[#baff38]">{wallet.smartMoneyScore}</span><div className="w-12 h-1.5 bg-[#10271d] rounded"><div className="h-full rounded bg-[#baff38]" style={{ width: `${wallet.smartMoneyScore}%` }} /></div></div></td>
                  <td className="py-2"><span className={wallet.isProfit ? 'text-green' : 'text-red'}>{wallet.roi30d}</span></td>
                  <td className="py-2 text-[#d8eee5]">{wallet.winRate}%</td>
                  <td className="py-2 text-[#d8eee5]">{wallet.tradeCount}</td>
                  <td className="py-2"><div className="flex flex-wrap gap-1">{wallet.preferredCategories.map(cat => <span key={cat} className="px-1.5 py-0.5 rounded text-xs bg-[#06140e] text-[#648176]">{cat}</span>)}</div></td>
                  <td className="py-2 text-[#648176]">{wallet.lastActive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedWallet && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#06140e] border border-[#173b2b] rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-[#0d2119] flex justify-between items-center gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-[#baff38] text-lg">WALLET DNA: {selectedWallet.dna}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-[#648176] text-xs truncate max-w-[420px]" title={selectedWallet.address}>{selectedWallet.address}</code>
                  <CopyButton
                    value={selectedWallet.address}
                    label="alamat wallet"
                    disabled={!isLive}
                    disabledTitle="Mode DEMO — alamat hanya placeholder, bukan wallet asli. Set HELIUS_API_KEY di .env untuk alamat on-chain lengkap."
                  />
                </div>
              </div>
              <button onClick={() => setSelectedWallet(null)} className="text-[#648176] hover:text-[#d8eee5] shrink-0">✕</button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-[#030c08] border border-[#173b2b] rounded p-3"><div className="text-[#56766a] text-xs">SMART MONEY SCORE</div><div className="text-2xl font-bold text-[#baff38]">{selectedWallet.smartMoneyScore}/100</div></div>
                <div className="bg-[#030c08] border border-[#173b2b] rounded p-3"><div className="text-[#56766a] text-xs">P&L (SOL)</div><div className="text-2xl font-bold text-[#d8eee5]">{selectedWallet.roi30d}</div></div>
                <div className="bg-[#030c08] border border-[#173b2b] rounded p-3"><div className="text-[#56766a] text-xs">WIN RATE</div><div className="text-2xl font-bold text-[#22e58a]">{selectedWallet.winRate}%</div></div>
                <div className="bg-[#030c08] border border-[#173b2b] rounded p-3"><div className="text-[#56766a] text-xs">TRADES</div><div className="text-2xl font-bold text-[#d8eee5]">{selectedWallet.tradeCount}</div></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[#baff38] font-bold mb-3 text-sm">BEHAVIORAL PROFILE</h4>
                  <div className="space-y-2 text-xs">
                    {[['Buying', selectedWallet.buyingBehavior], ['Selling', selectedWallet.sellingBehavior], ['Scaling', selectedWallet.scalingBehavior], ['Conviction', selectedWallet.convictionBehavior], ['Avg Entry MC', selectedWallet.avgEntryMc], ['Avg Exit MC', selectedWallet.avgExitMc]].map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1 border-b border-[#0d2119]"><span className="text-[#648176]">{k}</span><span className="text-[#d8eee5]">{v}</span></div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[#baff38] font-bold mb-3 text-sm">RECENT TRADES</h4>
                  <div className="space-y-2">
                    {selectedWallet.recentTrades?.map(trade => (
                      <div key={trade.id} className="border-b border-[#0d2119] pb-2">
                        <div className="flex justify-between"><span className="font-bold text-[#baff38]">{trade.token}</span><span className={trade.isWin ? 'text-green' : 'text-red'}>{trade.roi > 0 ? '+' : ''}{trade.roi}x</span></div>
                      </div>
                    )) || <div className="text-xs text-[#648176]">No recent trades</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ═══════════════════════ NARRATIVE SECTION ═══════════════════════════
function getStateColor(state: string): string {
  switch (state) {
    case 'EARLY': return 'text-[#55aaff]'
    case 'ACCELERATING': return 'text-[#baff38]'
    case 'PEAKING': return 'text-[#ffc85b]'
    case 'DECLINING': return 'text-[#ff5d69]'
    default: return 'text-[#648176]'
  }
}
function NarrativeSection({ data, isLoading, error, refetch }: any) {
  const [selectedNarrative, setSelectedNarrative] = useState<any>(null)
  const narratives = data?.narratives || []
  const trending = data?.trending || []
  return (
    <>
      <div className="flex gap-3 mb-4 items-center"><button onClick={() => refetch()} className="meme-btn">REFRESH</button></div>
      <div className="meme-panel mb-4">
        <div className="head"><span>NARRATIVE VELOCITY MATRIX</span><span className="muted">{narratives.length} categories tracked</span></div>
        <div className="p-4">
          {isLoading ? <div className="text-center py-8 text-[#475569]"><span className="g-spinner lg"></span> Loading...</div>
          : error ? <div className="text-center py-8 text-[#f87171]">Error loading data.</div>
          : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {narratives.map((n: any) => (
                <div key={n.name} className="bg-[#06140e] border border-[#173b2b] rounded p-4 cursor-pointer hover:border-[#baff38] transition-colors" onClick={() => setSelectedNarrative(n)}>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: n.color }} /><span className="font-bold text-[#d8eee5]">{n.name}</span></div>
                    <span className={`text-xs font-bold ${getStateColor(n.state)}`}>{n.state}</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-[#648176]">Velocity</span><span className="text-[#d8eee5]">{n.velocity}</span></div>
                    <div className="flex justify-between"><span className="text-[#648176]">Tokens Launched</span><span className="text-[#d8eee5]">{n.tokensLaunched}</span></div>
                    <div className="flex justify-between"><span className="text-[#648176]">Volume Growth</span><span className={n.volumeGrowth >= 0 ? 'text-green' : 'text-red'}>{n.volumeGrowth >= 0 ? '+' : ''}{n.volumeGrowth}%</span></div>
                  </div>
                  <div className="mt-3 h-2 bg-[#10271d] rounded"><div className="h-full rounded" style={{ width: `${Math.min(100, n.velocity / 2)}%`, background: n.color }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="meme-panel">
        <div className="head"><span>TRENDING (COINGECKO)</span><span className="muted">Top searched tokens</span></div>
        <div className="p-4 space-y-2">
          {trending.map((t: any, i: number) => (
            <div key={t.id || i} className="flex items-center gap-3">
              <span className="text-[#648176] text-xs w-5">#{i + 1}</span>
              {t.thumb && <img src={t.thumb} alt={t.symbol} className="w-5 h-5 rounded" />}
              <span className="font-bold text-[#d8eee5]">{t.symbol?.toUpperCase()}</span>
              <span className="text-[#648176] text-xs">{t.name}</span>
              <span className="text-[#baff38] text-xs ml-auto">Score: {t.score}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedNarrative && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#06140e] border border-[#173b2b] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-[#0d2119] flex justify-between items-center">
              <h3 className="font-bold text-[#baff38] text-lg">{selectedNarrative.name} Narrative</h3>
              <button onClick={() => setSelectedNarrative(null)} className="text-[#648176] hover:text-[#d8eee5]">✕</button>
            </div>
            <div className="p-4">
              <h4 className="text-[#baff38] font-bold mb-2 text-sm">RELATED TOKENS</h4>
              <div className="space-y-2">
                {selectedNarrative.tokens?.map((t: any) => (
                  <div key={t.address} className="flex justify-between items-center py-2 border-b border-[#0d2119]">
                    <div><span className="font-bold text-[#baff38]">{t.symbol}</span><span className="text-[#648176] text-xs ml-2">{t.name}</span></div>
                    <div className={t.priceChange24h >= 0 ? 'text-green' : 'text-red'}>{t.priceChange24h >= 0 ? '+' : ''}{t.priceChange24h.toFixed(1)}%</div>
                  </div>
                )) || <div className="text-xs text-[#648176]">No tokens found</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ═══════════════════════ FLOW SECTION ═══════════════════════════
function FlowBar({ label, amount, direction, velocity, color }: any) {
  const barWidth = Math.min(100, Math.max(5, (amount / 50000) * 100))
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1"><span className="text-[#648176] text-xs">{label}</span><span className={`text-xs font-bold ${direction === 'in' ? 'text-green' : 'text-red'}`}>{direction === 'in' ? '+' : '-'}{formatNumber(amount)}</span></div>
      <div className="h-4 bg-[#10271d] rounded overflow-hidden"><div className="h-full rounded transition-all duration-500" style={{ width: `${barWidth}%`, background: color, boxShadow: `0 0 10px ${color}` }} /></div>
      <div className="text-[#648176] text-xs mt-1">Velocity: {velocity}%</div>
    </div>
  )
}
function FlowSection({ data, isLoading, error, refetch }: any) {
  const buckets = data?.buckets || []
  const events = data?.events || []
  return (
    <>
      <div className="flex gap-3 mb-4 items-center"><button onClick={() => refetch()} className="meme-btn">REFRESH</button></div>
      <div className="meme-panel mb-4">
        <div className="head"><span>MONEY FLOW DASHBOARD</span><span className="muted">Real-time flow analysis</span></div>
        <div className="p-4">
          {isLoading ? <div className="text-center py-8 text-[#475569]"><span className="g-spinner lg"></span> Loading...</div>
          : error ? <div className="text-center py-8 text-[#f87171]">Error loading data.</div>
          : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-[#baff38] font-bold mb-3 text-sm">FLOW BUCKETS</h4>
                <div className="space-y-3">{buckets.map((b: any) => <FlowBar key={b.type} {...b} />)}</div>
              </div>
              <div>
                <h4 className="text-[#baff38] font-bold mb-3 text-sm">LIVE FLOW EVENTS</h4>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {events.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-2 py-2 border-b border-[#0d2119]">
                      <span className="text-[#648176] text-xs w-16">{new Date(e.timestamp).toLocaleTimeString('en-GB', { hour12: false })}</span>
                      <span className="px-1.5 py-0.5 rounded text-xs font-bold text-[#baff38] bg-[#0c2a4a]">{e.type.replace('_', ' ')}</span>
                      <span className="font-bold text-[#d8eee5]">{e.token}</span>
                      <span className={`ml-auto text-xs ${e.direction === 'in' ? 'text-green' : 'text-red'}`}>{e.direction === 'in' ? '+' : '-'}{formatNumber(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ═══════════════════════ RISK SECTION ═══════════════════════════
function RiskSection({ data, isLoading, error, refetch }: any) {
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const events = data?.events || []
  const tokenRisks = data?.tokenRisks || []
  const summary = data?.riskSummary || { critical: 0, high: 0, medium: 0, low: 0 }
  return (
    <>
      <div className="flex gap-3 mb-4 items-center"><button onClick={() => refetch()} className="meme-btn">REFRESH</button></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-[#030c08] border border-[#2a0c0c] rounded p-3 text-center"><div className="text-[#ff5d69] text-2xl font-bold">{summary.critical}</div><div className="text-[#648176] text-xs">CRITICAL</div></div>
        <div className="bg-[#030c08] border border-[#7c3a0c] rounded p-3 text-center"><div className="text-[#fb923c] text-2xl font-bold">{summary.high}</div><div className="text-[#648176] text-xs">HIGH</div></div>
        <div className="bg-[#030c08] border border-[#7c7c0c] rounded p-3 text-center"><div className="text-[#ffc85b] text-2xl font-bold">{summary.medium}</div><div className="text-[#648176] text-xs">MEDIUM</div></div>
        <div className="bg-[#030c08] border border-[#0c7c3a] rounded p-3 text-center"><div className="text-[#22e58a] text-2xl font-bold">{summary.low}</div><div className="text-[#648176] text-xs">LOW</div></div>
      </div>
      <div className="meme-panel mb-4">
        <div className="head"><span>LIVE RISK EVENTS</span><span className="muted">{events.length} active</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-[#0d2119]">
              <th className="text-left py-2 text-[#56766a] font-bold">TIME</th><th className="text-left py-2 text-[#56766a] font-bold">TOKEN</th>
              <th className="text-left py-2 text-[#56766a] font-bold">TYPE</th><th className="text-left py-2 text-[#56766a] font-bold">SEVERITY</th>
              <th className="text-left py-2 text-[#56766a] font-bold">DESCRIPTION</th>
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={5} className="py-8 text-center text-[#475569]"><span className="g-spinner lg"></span> Loading...</td></tr>
              : error ? <tr><td colSpan={5} className="py-8 text-center text-[#f87171]">Error loading data.</td></tr>
              : events.length === 0 ? <tr><td colSpan={5} className="py-8 text-center text-[#475569]">No risk events detected.</td></tr>
              : events.map((e: any) => (
                <tr key={e.id} className="border-b border-[#0d2119] hover:bg-[#07160f] cursor-pointer" onClick={() => setSelectedEvent(e)}>
                  <td className="py-2 text-[#648176]">{new Date(e.detectedAt).toLocaleTimeString('en-GB', { hour12: false })}</td>
                  <td className="py-2"><span className="font-bold text-[#baff38]">{e.token}</span></td>
                  <td className="py-2 text-[#d8eee5]">{e.type.replace(/_/g, ' ')}</td>
                  <td className="py-2"><span className={`px-2 py-0.5 rounded text-xs font-bold ${e.severity === 'CRITICAL' ? 'text-[#ff5d69] bg-[#2a0c0c]' : e.severity === 'HIGH' ? 'text-[#fb923c] bg-[#2a130c]' : e.severity === 'MEDIUM' ? 'text-[#ffc85b] bg-[#1a1a0c]' : 'text-[#22e58a] bg-[#0c2a1a]'}`}>{e.severity}</span></td>
                  <td className="py-2 text-[#d8eee5]">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="meme-panel">
        <div className="head"><span>TOKEN RISK SCORES</span><span className="muted">Highest risk first</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-[#0d2119]">
              <th className="text-left py-2 text-[#56766a] font-bold">TOKEN</th><th className="text-left py-2 text-[#56766a] font-bold">PRICE</th>
              <th className="text-left py-2 text-[#56766a] font-bold">LIQUIDITY</th><th className="text-left py-2 text-[#56766a] font-bold">RISK</th><th className="text-left py-2 text-[#56766a] font-bold">FLAGS</th>
            </tr></thead>
            <tbody>
              {tokenRisks.slice(0, 20).map((t: any) => (
                <tr key={t.address} className="border-b border-[#0d2119] hover:bg-[#07160f]">
                  <td className="py-2"><span className="font-bold text-[#baff38]">{t.symbol}</span></td>
                  <td className="py-2 text-[#d8eee5]">${t.price.toFixed(6)}</td>
                  <td className="py-2 text-[#d8eee5]">{formatNumber(t.liquidity)}</td>
                  <td className="py-2"><span className="font-bold" style={{ color: t.riskScore >= 70 ? '#ff5d69' : t.riskScore >= 50 ? '#fb923c' : t.riskScore >= 30 ? '#ffc85b' : '#22e58a' }}>{t.riskScore}</span></td>
                  <td className="py-2"><div className="flex flex-wrap gap-1">{t.riskFlags.slice(0, 2).map((flag: string, i: number) => <span key={i} className="px-1.5 py-0.5 rounded text-xs bg-[#2a0c0c] text-[#ff5d69]">{flag}</span>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#06140e] border border-[#173b2b] rounded-lg max-w-2xl w-full">
            <div className="p-4 border-b border-[#0d2119] flex justify-between items-center">
              <h3 className="font-bold text-[#ff5d69] text-lg">Risk Event Detail</h3>
              <button onClick={() => setSelectedEvent(null)} className="text-[#648176] hover:text-[#d8eee5]">✕</button>
            </div>
            <div className="p-4">
              <div className="mb-2"><span className="text-[#56766a] text-xs">TOKEN</span><div className="text-xl font-bold text-[#baff38]">{selectedEvent.token}</div></div>
              <div className="mb-2"><span className="text-[#56766a] text-xs">DESCRIPTION</span><div className="text-[#d8eee5]">{selectedEvent.description}</div></div>
              <div><span className="text-[#56766a] text-xs">DETAILS</span><div className="text-[#d8eee5]">{selectedEvent.details}</div></div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}




// ═══════════════════════════ MAIN COMPONENT ═══════════════════════════
export default function MemeCommandCenter() {
  const [section, setSection] = useState<Section>('radar')
  const [sniperMode, setSniperMode] = useState<SniperMode>('early')
  const [selectedToken, setSelectedToken] = useState<MemeToken | null>(null)
  const [clock, setClock] = useState('')
  const [sortBy, setSortBy] = useState('ai_score')
  const [narrativeFilter, setNarrativeFilter] = useState('all')
  const [minLiquidity, setMinLiquidity] = useState(5000)
  // Filter bucket radar — dievaluasi SERVER-SIDE dari data live
  // (all | NEW_BONDING | BONDING_RADAR | MOMENTUM | NONE)
  const [bucketFilter, setBucketFilter] = useState('all')
  // Pagination radar — feed live (proxy + suplemen DexScreener) bisa >100
  // token, jadi listnya tidak terbatas tanpa pagination. Page reset otomatis
  // saat filter atau ukuran halaman berubah.
  const [page, setPage] = useState(1)
  // Ukuran halaman bisa dipilih user (25/50/100) lewat select di pagination radar.
  const [pageSize, setPageSize] = useState(50)

  useEffect(() => {
    const upd = () => setClock(new Date().toLocaleTimeString('en-GB', { hour12: false }))
    upd()
    const id = setInterval(upd, 1000)
    return () => clearInterval(id)
  }, [])

  // AUTO-UPDATE: interval poll sengaja dibuat LEBIH PENDEK dari TTL cache
  // server masing-masing route (meme-tokens 12s, wallets 15s, narratives 45s,
  // money-flow 20s, risk 25s) supaya setiap siklus poll membawa data baru —
  // tabel bergerak sendiri tanpa perlu klik REFRESH / reload halaman.
  // refetchOnWindowFocus diaktifkan per-query (global default-nya off) agar
  // data langsung segar saat user kembali ke tab.
  // Reset ke halaman 1 saat filter berubah — pagination harus konsisten
  // dengan data baru yang di-fetch (queryKey berubah → refetch).
  useEffect(() => { setPage(1) }, [sortBy, narrativeFilter, minLiquidity, bucketFilter, pageSize])

  const tokensQuery = useQuery({
    queryKey: ['meme-tokens', sortBy, narrativeFilter, minLiquidity, bucketFilter, page, pageSize],
    queryFn: () => fetchMemeTokens({ sort: sortBy, chain: 'solana', page: String(page), pageSize: String(pageSize), min_liq: String(minLiquidity), narrative: narrativeFilter, bucket: bucketFilter }),
    enabled: section === 'radar' || section === 'sniper',
    refetchInterval: 15_000,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  })
  // Sniper butuh SEMUA token dari feed (tanpa pagination) — pagination
  // radar hanya untuk tabel, sniper tetap scanning seluruh feed live.
  const sniperTokensQuery = useQuery({
    queryKey: ['meme-tokens-sniper', sortBy, narrativeFilter, minLiquidity, bucketFilter],
    queryFn: () => fetchMemeTokens({ sort: sortBy, chain: 'solana', page: '1', pageSize: '200', min_liq: String(minLiquidity), narrative: narrativeFilter, bucket: bucketFilter }),
    enabled: section === 'sniper',
    refetchInterval: 15_000,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  })
  const walletsQuery = useQuery({ queryKey: ['meme-wallets'], queryFn: fetchMemeWallets, enabled: section === 'wallets', refetchInterval: 12_000, staleTime: 5_000, refetchOnWindowFocus: true })
  const narrativesQuery = useQuery({ queryKey: ['meme-narratives'], queryFn: fetchNarratives, enabled: section === 'narrative', refetchInterval: 40_000, staleTime: 15_000, refetchOnWindowFocus: true })
  const flowQuery = useQuery({ queryKey: ['meme-money-flow'], queryFn: fetchMoneyFlow, enabled: section === 'flow', refetchInterval: 15_000, staleTime: 5_000, refetchOnWindowFocus: true })
  const riskQuery = useQuery({ queryKey: ['meme-risk'], queryFn: fetchRiskData, enabled: section === 'risk', refetchInterval: 20_000, staleTime: 10_000, refetchOnWindowFocus: true })

  const tokens: MemeToken[] = tokensQuery.data?.tokens || []

  const sections: { key: Section; label: string; icon: string }[] = [
    { key: 'radar', label: 'RADAR', icon: '/assets/ic_monitoring.svg' },
    { key: 'sniper', label: 'SNIPER', icon: '/assets/ic_fingerprint.svg' },
    { key: 'wallets', label: 'WALLETS', icon: '/assets/ic_coin.png' },
    { key: 'narrative', label: 'NARRATIVE', icon: '/assets/ic_planet.svg' },
    { key: 'flow', label: 'FLOW', icon: '/assets/ic_connection.svg' },
    { key: 'risk', label: 'RISK', icon: '/assets/ic_rules.svg' },
  ]

  return (
    <>
      {/* Shell selebar Dashboard (.cc-floor-app): width calc(100vw - 32px),
          max 1680px, palet warna disamakan lewat override var --t-* di CSS.
          Card top bar (TRENCHOS / MEME COMMAND CENTER / SOLANA · …) dihapus —
          statistik ACTIVE EDGE / STATUS / CLOCK dipindah ke baris subnav,
          menggantikan teks hint "LIVE FEED + KURVA PUMP.FUN + RUGCHECK …". */}
      <div className="meme-terminal meme-cc-shell">
        {/* Sub-menu section — baris mandiri, sticky, z-index 120:
            di atas overlay scanline .meme-terminal::before (z-20) dan
            di bawah dropdown Navbar global (.nav-dropdown z-99999).
            Tidak lagi disembunyikan di layar kecil. */}
        <nav className="meme-cc-subnav">
          {sections.map(s => (
            <button key={s.key} className={section === s.key ? 'active' : ''} onClick={() => setSection(s.key)}>
              <img src={s.icon} alt="" />{s.label}
            </button>
          ))}
          <div className="stats">
            <div className="stat"><label>ACTIVE EDGE</label><b className="live">+{(tokensQuery.data?.tokens || []).filter((t: any) => t.aiSignal === 'STRONG BUY' || t.aiSignal === 'CONDITIONAL BUY').length}</b></div>
            <div className="stat"><label>STATUS</label><b className="live">● LIVE</b></div>
            <div className="stat"><label>CLOCK</label><b>{clock}</b></div>
          </div>
        </nav>

        <div className="meme-cc-body">
          {section === 'radar' && (
            <>
              {/* Pencarian coin on-demand — hasil bisa langsung dianalisa
                  (modal yang sama dengan radar) */}
              <CoinSearch onSelect={setSelectedToken} />
              <RadarSection
                tokens={tokens} meta={tokensQuery.data} isLoading={tokensQuery.isLoading} error={tokensQuery.error}
                onSelect={setSelectedToken} sortBy={sortBy} setSortBy={setSortBy}
                narrativeFilter={narrativeFilter} setNarrativeFilter={setNarrativeFilter}
                minLiquidity={minLiquidity} setMinLiquidity={setMinLiquidity}
                bucketFilter={bucketFilter} setBucketFilter={setBucketFilter}
                page={page} pageSize={pageSize} total={tokensQuery.data?.total ?? 0} totalPages={tokensQuery.data?.totalPages ?? 1} setPage={setPage} setPageSize={setPageSize}
                refetch={tokensQuery.refetch}
              />
            </>
          )}
          {section === 'sniper' && (
            <SniperSection tokens={sniperTokensQuery.data?.tokens || []} isLoading={sniperTokensQuery.isLoading} mode={sniperMode} setMode={setSniperMode} onSelect={setSelectedToken} refetch={sniperTokensQuery.refetch} />
          )}
          {section === 'wallets' && (
            <WalletsSection data={walletsQuery.data} isLoading={walletsQuery.isLoading} error={walletsQuery.error} refetch={walletsQuery.refetch} />
          )}
          {section === 'narrative' && (
            <NarrativeSection data={narrativesQuery.data} isLoading={narrativesQuery.isLoading} error={narrativesQuery.error} refetch={narrativesQuery.refetch} />
          )}
          {section === 'flow' && (
            <FlowSection data={flowQuery.data} isLoading={flowQuery.isLoading} error={flowQuery.error} refetch={flowQuery.refetch} />
          )}
          {section === 'risk' && (
            <RiskSection data={riskQuery.data} isLoading={riskQuery.isLoading} error={riskQuery.error} refetch={riskQuery.refetch} />
          )}
        </div>
      </div>

      {/* Modal dirender DI LUAR shell: shell memakai transform (centering lebar
          Dashboard) yang membuat position:fixed menjadi relatif terhadap shell,
          bukan viewport — modal harus tetap fixed ke viewport. */}
      <TokenDetailModal token={selectedToken} onClose={() => setSelectedToken(null)} />
    </>
  )
}
