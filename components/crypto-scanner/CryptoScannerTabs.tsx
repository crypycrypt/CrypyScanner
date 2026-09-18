"use client"
import { useState } from 'react'
import CoinScannerWidget from '../dashboard/CoinScannerWidget'
import SniperScanner from './SniperScanner'
import DexAnalyzer from './DexAnalyzer'
import SmartMoney from './SmartMoney'
import FuturesAnalysisPage from './FuturesAnalysisPage'
import WalletFlowGraph from './WalletFlowGraph'

const TABS = [
  { id:'scanner', label:'Crypto Scanner' },
  { id:'sniper',  label:'Sniper Scanner' },
  { id:'dex',     label:'DEX Analyzer' },
  { id:'smart',   label:'Smart Money' },
  { id:'wallet',  label:'Wallet Flow' },
  { id:'futures', label:'Futures Analysis' },
]

export default function CryptoScannerTabs(){
  const [active, setActive] = useState('scanner')
  return (
    <div>
      <div className="flex gap-1 border-b border-[rgba(255,255,255,0.06)] mb-6 overflow-x-auto">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActive(t.id)}
            className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0"
            style={{color:active===t.id?'white':'#64748b',borderBottom:active===t.id?'2px solid #6366f1':'2px solid transparent'}}>
            {t.label}
          </button>
        ))}
      </div>
      <div>
        {active==='scanner' && <CoinScannerWidget />}
        {active==='sniper'  && <SniperScanner />}
        {active==='dex'     && <DexAnalyzer />}
        {active==='smart'   && <SmartMoney />}
        {active==='wallet'  && <WalletFlowGraph />}
        {active==='futures' && <FuturesAnalysisPage />}
      </div>
    </div>
  )
}

