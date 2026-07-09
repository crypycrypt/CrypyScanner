"use client"
import AnimatedCard from '../ui/AnimatedCard'
import Skeleton from '../ui/Skeleton'
import { useSignalBotRealTime } from '../../lib/useSignalBotRealTime'

export default function AISignalsWidget(){
  const { data: signals, isLoading } = useSignalBotRealTime() as any
  
  // Transform signal bot data to AI signals format
  const data = signals ? signals.slice(0, 3).map((signal: any, index: number) => ({
    id: `ai-${index}`,
    type: signal.signal === 'LONG' ? 'BUY' : signal.signal === 'SHORT' ? 'SELL' : 'WATCH',
    token: signal.coinSymbol.toUpperCase(),
    confidence: signal.confidence,
    reason: signal.signalReason
  })) : []
  return (
    <AnimatedCard>
      <h3 className="font-semibold mb-2">AI Signals</h3>
      {isLoading && <Skeleton className="h-28 w-full rounded" />}
      {!isLoading && (!data || data.length === 0) && <div className="text-slate-400">Tidak ada sinyal</div>}
      {!isLoading && data && (
        <ul className="space-y-2">
          {data.map((s:any)=> (
            <li key={s.id} className="p-2 flex justify-between items-center bg-[rgba(255,255,255,0.02)] rounded">
              <div className="flex items-center gap-3">
                <img src={`/assets/${s.type === 'BUY' ? 'ic_check.svg' : 'ic_rejection.svg'}`} alt={s.type} className="h-6 w-6" />
                <div>
                  <div className="font-semibold">{s.type} — {s.token}</div>
                  <div className="text-slate-400 text-sm">{s.reason}</div>
                </div>
              </div>
              <div className="text-emerald-400">{s.confidence}%</div>
            </li>
          ))}
        </ul>
      )}
    </AnimatedCard>
  )
}
