import ParallaxCard from './ParallaxCard'

export default function WhaleActivity(){
  const activities = [
    {
      icon: '🐋',
      title: 'Akumulasi Besar',
      desc: 'Whale address 0xAbc...123 mengakumulasi $2.4M token AI dalam 24 jam terakhir',
      tag: 'BUY',
      tagColor: 'text-green-400 bg-green-500/10',
      volume: '$2,400,000',
      time: '2 menit lalu'
    },
    {
      icon: '📤',
      title: 'Distribusi ke Exchange',
      desc: '5 alamat whale memindahkan $1.8M ETH ke Binance dan Coinbase',
      tag: 'SELL',
      tagColor: 'text-red-400 bg-red-500/10',
      volume: '$1,800,000',
      time: '15 menit lalu'
    },
    {
      icon: '🎯',
      title: 'Sinyal Konfirmasi',
      desc: 'Volume/MCap ratio menunjukkan akumulasi institusional pada SOL dengan confidence 87%',
      tag: 'WATCH',
      tagColor: 'text-yellow-400 bg-yellow-500/10',
      volume: 'High Conviction',
      time: '1 jam lalu'
    }
  ]

  return (
    <section className="container mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">🐋</span>
        <div>
          <h2 className="text-3xl font-bold text-neon">Aktivitas Whale</h2>
          <p className="text-slate-400 text-sm">Pantau pergerakan whale real-time dan dapatkan sinyal early</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {activities.map((a, i) => (
          <ParallaxCard key={i} artwork="/assets/ic_universe.svg" className="p-5 rounded-xl hover:border-[rgba(0,240,255,0.3)] transition-all group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{a.icon}</span>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${a.tagColor}`}>{a.tag}</span>
            </div>
            <h4 className="font-semibold text-white mb-2 group-hover:text-neon transition-colors">{a.title}</h4>
            <p className="text-slate-400 text-sm mb-4">{a.desc}</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{a.time}</span>
              <span className="text-neon font-semibold">{a.volume}</span>
            </div>
          </ParallaxCard>
        ))}
      </div>
    </section>
  )
}
