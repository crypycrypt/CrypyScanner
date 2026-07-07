"use client"
import AnimatedCard from '../ui/AnimatedCard'

export default function DexAnalyzer(){
  const pairs = [
    {pair: 'AI/ETH', liquidity: '$120k', slippage: '0.6%', rugRisk: 'low'},
    {pair: 'MEGA/ETH', liquidity: '$8k', slippage: '8.2%', rugRisk: 'high'},
  ]
  return (
    <AnimatedCard>
      <h3 className="font-semibold mb-3">DEX Analyzer</h3>
      <div className="grid grid-cols-1 gap-2">
        {pairs.map(p=> (
          <div key={p.pair} className="p-3 rounded bg-[rgba(255,255,255,0.02)] flex justify-between items-center">
            <div>
              <div className="font-medium">{p.pair}</div>
              <div className="text-slate-400 text-sm">Liquidity: {p.liquidity} • Slippage: {p.slippage}</div>
            </div>
            <div className={`px-2 py-1 rounded ${p.rugRisk==='high'? 'bg-red-600':'bg-emerald-500'} text-black text-sm`}>{p.rugRisk}</div>
          </div>
        ))}
      </div>
    </AnimatedCard>
  )
}
