"use client"
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSmartMoneyRealTime } from '../../lib/smartMoneyApi'
import Skeleton from '../ui/Skeleton'
import Pagination from '../ui/Pagination'

const TABS = ['SM Live','Wallet Tracer','Accum Radar','Wallet Graph','Alerts & Telegram']

export default function SmartMoney(){
  const { data, isLoading } = useSmartMoneyRealTime() as any
  const [tab, setTab] = useState('Wallet Graph')
  const [wallet, setWallet] = useState('BPKKmZ2THpgRwyAZcZKfawhgT8xLycVoXSWGe94MpR2i')
  const [page, setPage] = useState(1)

  const pageSize = 3
  const wallets = data ?? []
  const totalPages = Math.max(1, Math.ceil(wallets.length / pageSize))
  const pagedWallets = useMemo(() => wallets.slice((page - 1) * pageSize, page * pageSize), [wallets, page])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/assets/ic_monitoring.svg" alt="smart" className="w-5 h-5" />
          <h3 className="font-bold text-lg">Smart Money Intelligence</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(34,197,94,0.15)] text-green-400">LIVE</span>
        </div>
        <span className="text-xs text-slate-400">SOLANA · ARKHAM-STYLE</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: tab === t ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)',
              color: tab === t ? '#60a5fa' : '#64748b',
              border: `1px solid ${tab === t ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.05)'}`
            }}>
            {t}
          </button>
        ))}
      </div>

      {isLoading ? <Skeleton className="h-[420px] w-full rounded-xl"/> : (
        <div className="space-y-3">
          <div className="card-glass rounded-xl p-3">
            <div className="text-xs text-slate-400 mb-2">Saved Wallets (klik untuk map flow)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {pagedWallets.map((w:any)=>(
                <button key={w.id} onClick={()=>setWallet(w.addr)} className="text-left bg-[rgba(255,255,255,0.02)] rounded p-2 hover:bg-[rgba(255,255,255,0.05)]">
                  <div className="text-xs text-slate-200 font-mono">{w.addr}</div>
                  <div className="text-[11px] text-slate-400">{w.label} · score {w.score}</div>
                </button>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>

          <div className="card-glass rounded-xl p-3">
            <div className="text-xs text-slate-400 mb-2">Atau masukkan wallet address:</div>
            <div className="flex gap-2">
              <input
                value={wallet}
                onChange={(e)=>setWallet(e.target.value)}
                className="flex-1 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-sm text-slate-200"
              />
              <button className="btn-theme btn-theme-sm">Map Flow</button>
            </div>
          </div>

          {tab === 'Wallet Graph' ? (
            <div className="card-glass rounded-xl p-3 relative overflow-hidden">
              <div className="text-sm font-semibold mb-2">Wallet Flow Graph · Smart Money Routing</div>
              <div className="relative h-[380px] bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] rounded-lg overflow-hidden">
                {/* SVG Connection Lines with Animation */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
                      <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="0.8" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Animated connection lines */}
                  {[
                    {x1:'50',y1:'60',x2:'62',y2:'40'},
                    {x1:'50',y1:'60',x2:'38',y2:'42'},
                    {x1:'50',y1:'60',x2:'72',y2:'58'},
                    {x1:'50',y1:'60',x2:'30',y2:'58'},
                    {x1:'50',y1:'60',x2:'58',y2:'76'},
                    {x1:'50',y1:'60',x2:'42',y2:'76'},
                  ].map((line, i) => (
                    <motion.line
                      key={i}
                      x1={line.x1}
                      y1={line.y1}
                      x2={line.x2}
                      y2={line.y2}
                      stroke="url(#grad1)"
                      strokeWidth="0.6"
                      opacity="0.8"
                      filter="url(#glow)"
                      initial={{ opacity: 0, strokeDashoffset: 100 }}
                      animate={{ opacity: 0.8, strokeDashoffset: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.8, repeat: Infinity, repeatType: 'reverse', repeatDelay: 2 }}
                    />
                  ))}
                  
                  {/* Central node glow effect */}
                  <circle cx="50" cy="60" r="12" fill="#f59e0b" opacity="0.1" filter="url(#glow)" />
                </svg>

                {/* Central Wallet Node with Glow */}
                <motion.div 
                  className="absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-[rgba(245,158,11,0.32)] border border-amber-400/70 flex items-center justify-center text-xs font-bold text-amber-200"
                  style={{
                    boxShadow: '0 0 20px rgba(245,158,11,0.4), inset 0 0 15px rgba(245,158,11,0.2)'
                  }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {wallet.slice(0,6)}...
                </motion.div>

                {/* Connected Wallet Nodes with Animations */}
                {[
                  {x:'62%',y:'35%',s:'7LfT...mklH',delay:0},
                  {x:'37%',y:'38%',s:'5u1J...bzNn',delay:0.1},
                  {x:'72%',y:'56%',s:'6hn6F...jT2Y',delay:0.2},
                  {x:'28%',y:'56%',s:'2uMX...bVvG',delay:0.3},
                  {x:'58%',y:'76%',s:'5Q54...e4j1',delay:0.4},
                  {x:'40%',y:'76%',s:'3mE6...Rq76',delay:0.5},
                ].map((n,i)=>(
                  <motion.div 
                    key={i} 
                    className="absolute w-16 h-16 rounded-full bg-[rgba(59,130,246,0.35)] border-2 border-blue-300/60 flex items-center justify-center text-[10px] text-blue-100 font-mono font-semibold cursor-pointer hover:scale-110"
                    style={{
                      left:n.x, 
                      top:n.y, 
                      transform:'translate(-50%,-50%)',
                      boxShadow: '0 0 15px rgba(59,130,246,0.4), inset 0 0 10px rgba(59,130,246,0.15)'
                    }}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: n.delay, duration: 0.6, ease: 'easeOut' }}
                    whileHover={{ 
                      scale: 1.15,
                      boxShadow: '0 0 25px rgba(59,130,246,0.8), inset 0 0 15px rgba(59,130,246,0.3)'
                    }}
                  >
                    {n.s}
                  </motion.div>
                ))}

                {/* Floating stats overlay */}
                <motion.div 
                  className="absolute top-3 right-3 bg-[rgba(0,0,0,0.5)] backdrop-blur border border-blue-400/30 rounded-lg p-2 text-xs"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="text-slate-400">Connected</div>
                  <div className="text-blue-400 font-bold">6 Wallets</div>
                </motion.div>
              </div>
            </div>
          ) : (
            <div className="card-glass rounded-xl p-4 text-sm text-slate-400">{tab} module akan mengikuti flow source pada iterasi berikutnya.</div>
          )}
        </div>
      )}
    </div>
  )
}

