"use client"
import AnimatedCard from '../ui/AnimatedCard'
import Skeleton from '../ui/Skeleton'
import { useCoinScannerTable } from '../../lib/realTimeHooks'
import { useState } from 'react'
import Modal from '../ui/Modal'
import { useLiveScan } from '../../lib/useLiveScan'
import Pagination from '../ui/Pagination'

export default function CryptoScannerPanel(){
  const { data: coins, isLoading } = useCoinScannerTable() as any
  
  // Transform coin scanner data to crypto scans format
  const data = coins ? [
    {
      id: 'cs1',
      name: 'HollowCat Scan',
      desc: 'Menemukan transfer besar yang terdeteksi HollowCat',
      status: 'Active',
      matches: coins.filter((c: any) => c.h24 > 5).length,
      last: '2m ago',
      color: '#6EE7B7'
    },
    {
      id: 'cs2',
      name: 'Sniper Scanner',
      desc: 'Mendeteksi sniper bot dan aksi beli saat launch',
      status: 'Watching',
      matches: coins.filter((c: any) => c.h24 > 10).length,
      last: '8m ago',
      color: '#60A5FA'
    },
    {
      id: 'cs3',
      name: 'Smart Money',
      desc: 'Melacak wallet dengan perilaku smart-money',
      status: 'Active',
      matches: coins.filter((c: any) => c.h24 > 0).length,
      last: '1m ago',
      color: '#FDE68A'
    },
    {
      id: 'cs4',
      name: 'Crypto Scanner',
      desc: 'Scanner pola umum: rug check, liquidity pull',
      status: 'Idle',
      matches: 0,
      last: '1h ago',
      color: '#FCA5A5'
    }
  ] : []
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<any | null>(null)
  const [analyzeOpen, setAnalyzeOpen] = useState(false)
  const [page, setPage] = useState(1)
  const live = useLiveScan()

  const pageSize = 3
  const rows = data ?? []
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const pagedRows = rows.slice((page - 1) * pageSize, page * pageSize)

  const projection = [96, 98, 102, 101, 105, 110, 114, 118]
  const max = Math.max(...projection)
  const min = Math.min(...projection)
  const points = projection.map((v, i) => `${(i / (projection.length - 1)) * 100},${100 - ((v - min) / (max - min || 1)) * 100}`).join(' ')

  return (
    <AnimatedCard>
      <h3 className="font-semibold mb-3">Crypto Scanner</h3>
      {isLoading && <Skeleton className="h-40 w-full rounded" />}
      {!isLoading && (!data || data.length === 0) && <div className="text-slate-400">No scans available</div>}
      {!isLoading && data && (
        <div className="grid grid-cols-1 gap-3">
          {pagedRows.map((s:any, sidx)=> (
            <div key={`${s.id}-${sidx}`} className="p-3 rounded-md bg-[rgba(255,255,255,0.02)] flex items-start gap-3">
              <div className="w-3 h-3 rounded-full mt-2" style={{background: s.color}}></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-sm text-slate-400">{s.status}</div>
                </div>
                <div className="text-slate-400 text-sm mt-1">{s.desc}</div>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className="px-2 py-1 bg-[rgba(255,255,255,0.03)] rounded">Matches: {s.matches}</span>
                  <span className="px-2 py-1 bg-[rgba(255,255,255,0.03)] rounded">Last: {s.last}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={()=>{ setActive(s); setOpen(true); live.start() }} className="btn-theme btn-theme-sm">View Details</button>
                <button onClick={()=>{ setActive(s); setAnalyzeOpen(true) }} className="btn-theme btn-theme-sm">Analyze</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      <Modal open={open} onClose={()=>{ setOpen(false); live.stop(); live.clear(); setActive(null) }} title={active?.name || 'Scan Details'}>
        <div className="space-y-3">
          <div className="text-slate-400">{active?.desc}</div>
          <div className="flex items-center gap-2">
            <button onClick={()=> live.start()} className="btn-theme btn-theme-sm">Start Live</button>
            <button onClick={()=> live.stop()} className="btn-theme btn-theme-sm">Stop</button>
            <button onClick={()=> live.clear()} className="btn-theme btn-theme-sm">Clear</button>
            <RunSmcButton />
          </div>
          <div className="max-h-64 overflow-auto bg-[rgba(255,255,255,0.02)] p-3 rounded">
            {live.events.length === 0 && <div className="text-slate-400">No events yet</div>}
            {live.events.map((e:any, eidx)=> (
              <div key={`${e.id}-${eidx}`} className="py-1 border-b border-[rgba(255,255,255,0.02)] text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{e.type} • {e.token}</div>
                  <div className="text-slate-400 text-xs">{e.when}</div>
                </div>
                <div className="text-slate-400 text-xs">{e.details}</div>
              </div>
            ))}
          </div>
          <SmcResult />
        </div>
      </Modal>

      <Modal open={analyzeOpen} onClose={()=>setAnalyzeOpen(false)} title={`Analyze • ${active?.name ?? 'Scanner'}`}>
        <div className="space-y-3">
          <div className="text-sm text-slate-300">
            Potensi arah: <span className="text-green-400 font-semibold">Bullish continuation</span> (confidence 78%)
          </div>
          <div className="card-glass rounded-lg p-3">
            <svg viewBox="0 0 100 100" className="w-full h-40">
              <polyline fill="none" stroke="#00f0ff" strokeWidth="2" points={points} />
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="card-glass rounded p-2"><span className="text-slate-400">Support Zone</span><div className="text-slate-100 font-semibold">95 - 97</div></div>
            <div className="card-glass rounded p-2"><span className="text-slate-400">Target Zone</span><div className="text-green-400 font-semibold">116 - 121</div></div>
            <div className="card-glass rounded p-2"><span className="text-slate-400">Risk</span><div className="text-yellow-300 font-semibold">Medium</div></div>
            <div className="card-glass rounded p-2"><span className="text-slate-400">Setup</span><div className="text-slate-100 font-semibold">Pullback Entry</div></div>
          </div>
        </div>
      </Modal>
    </AnimatedCard>
  )
}

function RunSmcButton(){
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<any | null>(null)
  async function run(){
    setLoading(true)
    try{
      const candles = Array.from({length:30}).map((_,i)=>({ time: new Date(Date.now() - (30-i)*60000).toISOString(), open: Math.random()*10+1, high: Math.random()*10+12, low: Math.random()*10, close: Math.random()*10+2, volume: Math.random()*1000 }))
      const r = await fetch('/api/crypto-scanner', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ candles }) })
      const j = await r.json()
      setRes(j)
    }catch(e){ setRes({ ok:false, error: (e as any).message }) }
    setLoading(false)
  }
  return (
    <div>
      <button onClick={run} className="px-3 py-1 bg-blue-600 text-white rounded">{loading? 'Running...':'Run SMC'}</button>
      {res && <pre className="text-xs mt-2 max-h-40 overflow-auto bg-[rgba(255,255,255,0.02)] p-2 rounded">{JSON.stringify(res, null, 2)}</pre>}
    </div>
  )
}

function SmcResult(){
  return null
}
