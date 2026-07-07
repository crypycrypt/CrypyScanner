"use client"
import AnimatedCard from '../ui/AnimatedCard'
import Skeleton from '../ui/Skeleton'
import { useCoinScanner } from '../../lib/mockHooks'

export default function CoinScannerWidget(){
  const { data, isLoading } = useCoinScanner() as any
  return (
    <AnimatedCard>
      <h3 className="font-semibold mb-2">Coin Scanner</h3>
      {isLoading && <Skeleton className="h-36 w-full rounded" />}
      {!isLoading && (!data || data.length === 0) && <div className="text-slate-400">Tidak ada koin</div>}
      {!isLoading && data && (
        <div className="grid grid-cols-1 gap-2">
          {data.map((c:any)=> (
            <div key={c.id} className="p-2 flex justify-between items-center bg-[rgba(255,255,255,0.02)] rounded">
              <div>
                <div className="font-semibold">{c.symbol}</div>
                <div className="text-slate-400 text-sm">RSI {c.rsi} • 24H {c.change24}%</div>
              </div>
              <div className="text-neon font-semibold">${c.price}</div>
            </div>
          ))}
        </div>
      )}
    </AnimatedCard>
  )
}
