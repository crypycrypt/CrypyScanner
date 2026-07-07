"use client"
import AnimatedCard from '../ui/AnimatedCard'
import Skeleton from '../ui/Skeleton'
import { useCryptoScans } from '../../lib/mockHooks'
import { useState } from 'react'
import Modal from '../ui/Modal'
import { useLiveScan } from '../../lib/useLiveScan'

export default function CryptoScannerPanel(){
  const { data, isLoading } = useCryptoScans() as any
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<any | null>(null)
  const live = useLiveScan()

  return (
    <AnimatedCard>
      <h3 className="font-semibold mb-3">Crypto Scanner</h3>
      {isLoading && <Skeleton className="h-40 w-full rounded" />}
      {!isLoading && (!data || data.length === 0) && <div className="text-slate-400">No scans available</div>}
      {!isLoading && data && (
        <div className="grid grid-cols-1 gap-3">
          {data.map((s:any)=> (
            <div key={s.id} className="p-3 rounded-md bg-[rgba(255,255,255,0.02)] flex items-start gap-3">
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
              </div>
            </div>
          ))}
        </div>
      )}
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
            {live.events.map((e:any)=> (
              <div key={e.id} className="py-1 border-b border-[rgba(255,255,255,0.02)] text-sm">
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
