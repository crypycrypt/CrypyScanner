"use client"
import { useState } from 'react'
import CryptoScannerPanel from '../../components/dashboard/CryptoScannerPanel'
import DexAnalyzer from './DexAnalyzer'
import SmartMoney from './SmartMoney'

export default function CryptoScannerTabs(){
  const tabs = ['Crypto Scanner','DEX Analyzer','Smart Money']
  const [active, setActive] = useState(0)
  return (
    <div>
      <div className="flex gap-2 mb-4">
        {tabs.map((t,i)=> (
          <button key={t} onClick={()=>setActive(i)} className={`px-3 py-1 rounded ${i===active? 'bg-emerald-500 text-black':'bg-[rgba(255,255,255,0.02)] text-slate-300'}`}>{t}</button>
        ))}
      </div>
      <div>
        {active===0 && <CryptoScannerPanel />}
        {active===1 && <DexAnalyzer />}
        {active===2 && <SmartMoney />}
      </div>
    </div>
  )
}
