"use client"
import AnimatedCard from '../ui/AnimatedCard'
import Skeleton from '../ui/Skeleton'
import { useWhaleAlerts } from '../../lib/mockHooks'

export default function WhaleAlertsWidget(){
  const { data, isLoading } = useWhaleAlerts() as any
  return (
    <AnimatedCard>
      <h3 className="font-semibold mb-2">Whale Alerts</h3>
      {isLoading && <Skeleton className="h-24 w-full rounded" />}
      {!isLoading && (!data || data.length === 0) && <div className="text-slate-400">Belum ada alert</div>}
      {!isLoading && data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((d:any)=> (
            <li key={d.id} className="p-2 bg-[rgba(255,255,255,0.02)] rounded">{d.wallet} — {d.token} — {d.volume} — {d.confidence}%</li>
          ))}
        </ul>
      )}
    </AnimatedCard>
  )
}
