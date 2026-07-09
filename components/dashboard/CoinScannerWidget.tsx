"use client"
import { useState } from 'react'
import { useCoinScannerTable } from '../../lib/realTimeHooks'
import Skeleton from '../ui/Skeleton'
import CoinIcon from '../ui/CoinIcon'
import Pagination from '../ui/Pagination'
import AnalyzeModal, { CoinAnalyzeData } from '../ui/AnalyzeModal'

const MARKET = [
  { label:'F&G INDEX', value:'27', sub:'Fear', color:'#ef4444' },
  { label:'BTC', value:'$63.3K', sub:'+0.9%', color:'#22c55e' },
  { label:'ETH', value:'$1.8K', sub:'+1.0%', color:'#22c55e' },
  { label:'TOTAL MCAP', value:'$2.27T', sub:'+0.4%', color:'#22c55e' },
  { label:'BTC DOM.', value:'55.8%', sub:'', color:'#94a3b8' },
  { label:'VOL 24H', value:'$88.2B', sub:'', color:'#94a3b8' },
  { label:'AKTIF', value:'17,319', sub:'coins', color:'#94a3b8' },
]
const TIME_TABS = ['1H','24H','7D']
const CAT_TABS = ['All','Trending','Gainers','Losers','Whale','Long','Short','Watchlist']

export default function CoinScannerWidget(){
  const { data, isLoading } = useCoinScannerTable() as any
  const [time, setTime] = useState('24H')
  const [cat, setCat] = useState('All')
  const [page, setPage] = useState(1)
  const [analyzeOpen, setAnalyzeOpen] = useState(false)
  const [analyzeCoin, setAnalyzeCoin] = useState<CoinAnalyzeData | null>(null)

  const pageSize = 6
  const rows = data ?? []
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const pagedRows = rows.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-4">
      {/* Market stats bar */}
      <div className="card-glass rounded-xl px-4 py-2 flex items-center gap-6 overflow-x-auto">
        {MARKET.map(m=>(
          <div key={m.label} className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-slate-400">{m.label}</span>
            <span className="text-sm font-semibold text-white">{m.value}</span>
            {m.sub && <span className="text-xs font-medium" style={{color:m.color}}>{m.sub}</span>}
          </div>
        ))}
      </div>

      {/* Time + Category filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 card-glass rounded-lg p-1">
          {TIME_TABS.map(t=>(
            <button key={t} onClick={()=>setTime(t)}
              className="px-3 py-1 rounded text-xs font-semibold transition-all"
              style={{background:time===t?'#3b82f6':'transparent',color:time===t?'white':'#64748b'}}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {CAT_TABS.map(c=>(
            <button key={c} onClick={()=>setCat(c)}
              className="px-3 py-1 rounded text-xs font-semibold transition-all"
              style={{background:cat===c?'rgba(255,255,255,0.08)':'transparent',color:cat===c?'white':'#64748b'}}>
              {c==='Trending'?'Trending':c==='Gainers'?'Gainers':c==='Losers'?'Losers':c==='Whale'?'Whale':c==='Long'?'Long':c==='Short'?'Short':c==='Watchlist'?'Watchlist':c}
            </button>
          ))}
        </div>
        <input placeholder="Search token... (/)" className="ml-auto px-3 py-1.5 rounded-lg text-xs bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-slate-300 w-40"/>
        <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(99,102,241,0.15)] text-indigo-400 border border-[rgba(99,102,241,0.2)]">✨ AI Rank</button>
      </div>

      {/* Table */}
      {isLoading ? <Skeleton className="h-64 w-full rounded-xl"/> : (
        <div className="card-glass rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.04)] text-xs text-slate-400">
                <th className="px-3 py-2 text-left w-6">⭐</th>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">TOKEN</th>
                <th className="px-3 py-2 text-right">PRICE</th>
                <th className="px-3 py-2 text-right">AGE</th>
                <th className="px-3 py-2 text-right text-blue-400">1H%</th>
                <th className="px-3 py-2 text-right text-blue-400">24H% ↓</th>
                <th className="px-3 py-2 text-right">7D%</th>
                <th className="px-3 py-2 text-right">VOLUME</th>
                <th className="px-3 py-2 text-right">MCAP</th>
                <th className="px-3 py-2 text-right">LIQUIDITY</th>
                <th className="px-3 py-2 text-right">SIGNAL</th>
                <th className="px-3 py-2 text-center">ANALYZE</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row:any, i:number)=>(
                <tr key={row.id} className={`border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-colors ${i%2===0?'':'bg-[rgba(255,255,255,0.01)]'}`}>
                  <td className="px-3 py-2.5 text-slate-600">☆</td>
                  <td className="px-3 py-2.5 text-slate-400">{row.rank}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {row.image ? (
                        <img
                          src={row.image}
                          alt={row.name}
                          className="w-7 h-7 rounded-full"
                          onError={(e) => {
                            // Fallback to initial if image fails to load
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const parent = target.parentElement
                            if (parent) {
                              const fallback = document.createElement('div')
                              fallback.className = 'w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold'
                              fallback.textContent = row.symbol.charAt(0)
                              parent.appendChild(fallback)
                            }
                          }}
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                          {row.symbol.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-white">{row.name}</div>
                        <div className="text-xs text-slate-400">{row.symbol}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold">${row.price.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400 text-xs">{row.age}</td>
                  <td className="px-3 py-2.5 text-right text-xs" style={{color:row.h1>=0?'#22c55e':'#ef4444'}}>{row.h1>=0?'+':''}{row.h1.toFixed(2)}%</td>
                  <td className="px-3 py-2.5 text-right text-xs" style={{color:row.h24>=0?'#22c55e':'#ef4444'}}>{row.h24>=0?'+':''}{row.h24.toFixed(2)}%</td>
                  <td className="px-3 py-2.5 text-right text-xs" style={{color:row.d7>=0?'#22c55e':'#ef4444'}}>{row.d7>=0?'+':''}{row.d7.toFixed(2)}%</td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-300">{row.volume}</td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-300">{row.mcap}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{background:row.liq==='High'?'rgba(239,68,68,0.15)':'rgba(148,163,184,0.1)',color:row.liq==='High'?'#ef4444':'#94a3b8'}}>
                      {row.liq==='High'?'High':'Low'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="text-xs text-right" style={{color:'#a78bfa'}}>{row.signal}</div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => { setAnalyzeCoin({ symbol: row.symbol, name: row.name, price: row.price, h1: row.h1, h24: row.h24, d7: row.d7, volume: row.volume, mcap: row.mcap }); setAnalyzeOpen(true) }}
                      className="px-2.5 py-1 rounded text-[10px] font-bold bg-[rgba(0,240,255,0.10)] text-[#00f0ff] border border-[rgba(0,240,255,0.22)] hover:bg-[rgba(0,240,255,0.18)] transition-colors whitespace-nowrap">
                      🔍 Analyze
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      <AnalyzeModal open={analyzeOpen} onClose={() => setAnalyzeOpen(false)} coin={analyzeCoin} />
    </div>
  )
}

