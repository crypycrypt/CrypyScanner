"use client"
import AnimatedCard from '../ui/AnimatedCard'

export default function SmartMoney(){
  const wallets = [
    {addr: '0xAbc...123', score: 92, last: '3h ago'},
    {addr: '0xDef...456', score: 78, last: '1d ago'}
  ]
  return (
    <AnimatedCard>
      <h3 className="font-semibold mb-3">Smart Money</h3>
      <div className="grid grid-cols-1 gap-2">
        {wallets.map(w=> (
          <div key={w.addr} className="p-3 rounded bg-[rgba(255,255,255,0.02)] flex justify-between items-center">
            <div>
              <div className="font-medium">{w.addr}</div>
              <div className="text-slate-400 text-sm">Last activity: {w.last}</div>
            </div>
            <div className="text-neon font-semibold">Score: {w.score}</div>
          </div>
        ))}
      </div>
    </AnimatedCard>
  )
}
