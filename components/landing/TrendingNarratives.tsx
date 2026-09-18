import ParallaxCard from './ParallaxCard'

export default function TrendingNarratives(){
  const narratives = [
    { name: 'AI Agents', score: 92, momentum: '+18%', desc: 'Autonomous AI agents on Solana' },
    { name: 'RWA', score: 81, momentum: '+11%', desc: 'Real World Assets tokenization' },
    { name: 'Layer 2', score: 74, momentum: '+6%', desc: 'Scaling solutions & rollups' },
    { name: 'Memecoin', score: 69, momentum: '+4%', desc: 'Community-driven tokens' },
  ]

  return (
    <section className="container mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">📊</span>
        <div>
          <h2 className="text-3xl font-bold text-neon">Narasi Populer</h2>
          <p className="text-slate-400 text-sm">Track narrative momentum dan identify trend crypto terbaru</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {narratives.map((n) => (
          <ParallaxCard key={n.name} artwork="/assets/ic_chart.svg" className="p-5 rounded-xl hover:border-[rgba(0,240,255,0.3)] transition-all group cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-white group-hover:text-neon transition-colors">{n.name}</h4>
              <span className="text-green-400 text-sm font-semibold">{n.momentum}</span>
            </div>
            <p className="text-slate-400 text-xs mb-3">{n.desc}</p>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${n.score}%` }} />
            </div>
            <div className="text-xs text-slate-500 mt-1">Score {n.score}/100</div>
          </ParallaxCard>
        ))}
      </div>
    </section>
  )
}
