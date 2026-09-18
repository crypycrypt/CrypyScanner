"use client"
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ParallaxBackground from '../../components/landing/ParallaxBackground'
import ForegroundHUD from '../../components/landing/ForegroundHUD'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import MarketDirectionChart from '../../components/dashboard/MarketDirectionChart'
import FearGreedIndex from '../../components/dashboard/FearGreedIndex'
import AISignalsWidget from '../../components/dashboard/AISignalsWidget'
import SignalBotWidget from '../../components/dashboard/SignalBotWidget'
import WhaleActivityMonitor from '../../components/dashboard/WhaleActivityMonitor'
import WhaleAlertsWidget from '../../components/dashboard/WhaleAlertsWidget'
import { ReactQueryProvider } from '../../lib/queryClient'
import AiInputToy from '../../components/home/AiInputToy'

const quickActions = [
  { title: 'Scan Whale Alerts', desc: 'Pantau akumulasi/distribusi whale real-time', href: '/dashboard' },
  { title: 'Buka Crypto Scanner', desc: 'Screening token, sniper, dan DEX analyzer', href: '/crypto-scanner' },
  { title: 'AI Signal Copilot', desc: 'Ringkasan cepat aksi BUY / SELL / WATCH', href: '/dashboard' },
  { title: 'Smart Money Wallets', desc: 'Lacak wallet dengan performa terbaik', href: '/crypto-scanner' },
]

const news = [
  { id:'n1', title: 'BTC reclaim level psikologis, volume meningkat', tag: 'Market', time: '2m ago', detail:'Bitcoin berhasil reclaim level psikologis, volume naik signifikan disertai net inflow exchange negatif.' },
  { id:'n2', title: 'Narrative AI agents kembali trending di Solana', tag: 'Narrative', time: '7m ago', detail:'Token bertema AI agents mencatat lonjakan volume dan social mention, terutama di ekosistem Solana.' },
  { id:'n3', title: 'Whale transfer besar ke exchange terdeteksi', tag: 'Whale', time: '12m ago', detail:'Pergerakan whale menunjukkan potensi tekanan jual jangka pendek pada beberapa pair utama.' },
  { id:'n4', title: 'Altcoin rotation naik usai dominasi BTC stabil', tag: 'Macro', time: '20m ago', detail:'Saat BTC dominance stabil, kapital cenderung berotasi ke altcoin mid-cap dan high-beta.' },
]

const narratives = [
  { name: 'AI Agents', score: 92, momentum: '+18%' },
  { name: 'RWA', score: 81, momentum: '+11%' },
  { name: 'Layer 2', score: 74, momentum: '+6%' },
  { name: 'Memecoin', score: 69, momentum: '+4%' },
]

interface MacroOverview {
  btc?: { price: number; change24h: number }
  eth?: { price: number; change24h: number }
  totalMcapLabel?: string
  btcDominance?: number
}

export default function HomeGamePage() {
  const [newsOpen, setNewsOpen] = useState(false)
  const [newsPage, setNewsPage] = useState(1)
  const [activeNews, setActiveNews] = useState<any | null>(null)
  const [macro, setMacro] = useState<MacroOverview | null>(null)

  const pageSize = 3
  const totalPages = Math.max(1, Math.ceil(news.length / pageSize))
  const pagedNews = useMemo(() => news.slice((newsPage - 1) * pageSize, newsPage * pageSize), [newsPage])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/market/overview', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setMacro(data)
      } catch {}
    }
    load()
    const id = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return (
    <ReactQueryProvider>
    <div className="wide-shell space-y-8">
      <section className="home-command-card relative overflow-hidden rounded-3xl card-glass p-6 sm:p-8">
        <ParallaxBackground />
        <ForegroundHUD />
        <img src="/assets/ic_build.png" alt="" className="home-command-bg-image home-command-bg-image-secondary" />
        <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-start justify-between gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-game text-neon mb-3">Crypy Crypto Scanner</h1>
            <p className="text-slate-300 max-w-xl">
              Mode cepat untuk akses fitur utama: berita market, narrative tracker, whale alert, dan aksi instan scanner.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/dashboard" className="btn-theme">Open Dashboard</Link>
              <Link href="/crypto-scanner" className="btn-theme">Open Scanner</Link>
            </div>
          </div>
          <AiInputToy />
        </div>
      </section>

      {/* Market Direction + Fear & Greed */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MarketDirectionChart />
        </div>
        <div className="space-y-6">
          <FearGreedIndex />
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <img src="/assets/ic_run.svg" alt="actions" className="w-5 h-5" />
          <h2 className="text-2xl font-semibold">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {quickActions.map((a) => (
            <Link key={a.title} href={a.href} className="card-glass rounded-xl p-4 hover:scale-[1.01] transition-transform">
              <div className="font-semibold text-slate-100">{a.title}</div>
              <div className="text-sm text-slate-400 mt-1">{a.desc}</div>
              <div className="text-neon text-xs mt-3">Open →</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Berita / News Feed + Narrative Radar */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <img src="/assets/ic_dashboard.svg" alt="news" className="w-5 h-5" />
              <h3 className="font-semibold text-lg">Berita / News Feed</h3>
            </div>
            <span className="text-xs text-slate-400">Live updates</span>
          </div>
          {macro && ((macro.btc?.price ?? 0) > 0 || (macro.eth?.price ?? 0) > 0) && (
            <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
              {macro.btc && macro.btc.price > 0 && <MacroPill label="BTC" price={macro.btc.price} change={macro.btc.change24h} />}
              {macro.eth && macro.eth.price > 0 && <MacroPill label="ETH" price={macro.eth.price} change={macro.eth.change24h} />}
              {macro.btcDominance != null && macro.btcDominance > 0 && (
                <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-1.5 flex flex-col items-center min-w-[84px] flex-shrink-0">
                  <span className="text-slate-500 text-[10px] font-semibold tracking-wide">BTC DOM.</span>
                  <span className="text-slate-200 text-sm font-bold">{macro.btcDominance.toFixed(1)}%</span>
                </div>
              )}
              {macro.totalMcapLabel && macro.totalMcapLabel !== 'N/A' && (
                <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-1.5 flex flex-col items-center min-w-[84px] flex-shrink-0">
                  <span className="text-slate-500 text-[10px] font-semibold tracking-wide">TOTAL MCAP</span>
                  <span className="text-slate-200 text-sm font-bold">{macro.totalMcapLabel}</span>
                </div>
              )}
            </div>
          )}
          <div className="space-y-2">
            {pagedNews.map((n) => (
              <button key={n.id} onClick={()=>{ setActiveNews(n); setNewsOpen(true) }} className="w-full text-left bg-[rgba(255,255,255,0.02)] rounded-lg p-3 hover:bg-[rgba(255,255,255,0.04)] transition-colors">
                <div className="flex items-center justify-between text-xs">
                  <span className="px-2 py-0.5 rounded bg-[rgba(99,102,241,0.15)] text-indigo-300">{n.tag}</span>
                  <span className="text-slate-500">{n.time}</span>
                </div>
                <div className="text-sm text-slate-200 mt-2">{n.title}</div>
              </button>
            ))}
          </div>
          <Pagination page={newsPage} totalPages={totalPages} onPageChange={setNewsPage} />
        </div>

        <div className="card-glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <img src="/assets/ic_planet.svg" alt="narrative" className="w-5 h-5" />
              <h3 className="font-semibold text-lg">Narrative Radar</h3>
            </div>
            <span className="text-xs text-slate-400">Momentum tracker</span>
          </div>
          <div className="space-y-3">
            {narratives.map((n) => (
              <div key={n.name} className="bg-[rgba(255,255,255,0.02)] rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-200 font-medium">{n.name}</span>
                  <span className="text-green-400 text-sm font-semibold">{n.momentum}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full">
                  <div className="h-full rounded-full bg-neon" style={{ width: `${n.score}%` }} />
                </div>
                <div className="text-xs text-slate-500 mt-1">Score {n.score}/100</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Signals */}
      <AISignalsWidget />

      {/* Signal Bot */}
      <SignalBotWidget />

      {/* Whale Activity Monitor */}
      <WhaleActivityMonitor />

      {/* Whale Alert Signals */}
      <WhaleAlertsWidget />

      <Modal open={newsOpen} onClose={()=>setNewsOpen(false)} title={activeNews?.title || 'News Detail'}>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-[rgba(99,102,241,0.15)] text-indigo-300">{activeNews?.tag}</span>
            <span className="text-slate-500">{activeNews?.time}</span>
          </div>
          <p className="text-slate-300 text-sm">{activeNews?.detail}</p>
        </div>
      </Modal>
    </div>
    </ReactQueryProvider>
  )
}

function fmtMacroPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  return `$${n.toFixed(2)}`
}

function MacroPill({ label, price, change }: { label: string; price: number; change: number }) {
  const up = change >= 0
  return (
    <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-1.5 flex flex-col items-center min-w-[84px] flex-shrink-0">
      <span className="text-slate-500 text-[10px] font-semibold tracking-wide">{label}</span>
      <span className="text-slate-100 text-sm font-bold">{fmtMacroPrice(price)}</span>
      <span className={`text-[11px] font-semibold ${up ? 'text-green-400' : 'text-red-400'}`}>
        {up ? '▲' : '▼'} {up ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  )
}
