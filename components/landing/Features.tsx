import ParallaxCard from './ParallaxCard'

export default function Features(){
  const items = [
    {
      icon: '🐋',
      title: 'Whale Alerts',
      desc: 'Real-time alert untuk akumulasi dan distribusi whale. Deteksi pergerakan besar sebelum pasar bereaksi.',
      stat: '24/7'
    },
    {
      icon: '🔍',
      title: 'Wallet Tracker',
      desc: 'Lacak portofolio, transaksi, dan performa wallet smart money. Filter berdasarkan profit dan win rate.',
      stat: '50K+'
    },
    {
      icon: '🤖',
      title: 'AI Analysis',
      desc: 'Ringkasan sinyal BUY/SELL/WATCH powered by AI. Analisis teknikal, on-chain, dan sentiment dalam satu dashboard.',
      stat: 'AI'
    },
    {
      icon: '📈',
      title: 'Crypto Scanner',
      desc: 'Screening token real-time dengan filter volume, market cap, dan signal. Temukan opportunity sebelum crowded.',
      stat: 'Live'
    },
    {
      icon: '🛡️',
      title: 'Risk Management',
      desc: 'Hollowcat risk engine menghitung entry, SL, TP, dan expected RR secara otomatis untuk setiap setup.',
      stat: 'Auto'
    },
    {
      icon: '📊',
      title: 'Market Structure',
      desc: 'Deteksi BOS, CHoCH, FVG, Order Block, dan liquidity sweep. Visualisasi chart yang clean dan actionable.',
      stat: 'SMC'
    }
  ]

  return (
    <section id="features" className="container mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">⚡</span>
        <div>
          <h2 className="text-3xl font-bold text-neon">Fitur Utama</h2>
          <p className="text-slate-400 text-sm">Semua tools yang perlu trader crypto untuk edge di pasar</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <ParallaxCard key={item.title} artwork="/assets/ic_aurora%20copy.svg" className="p-6 rounded-xl hover:border-[rgba(0,240,255,0.3)] transition-all group">
            <div className="flex items-start gap-4">
              <span className="text-3xl">{item.icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white group-hover:text-neon transition-colors">{item.title}</h4>
                  <span className="text-xs text-neon font-mono bg-neon/10 px-2 py-0.5 rounded">{item.stat}</span>
                </div>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>
            </div>
          </ParallaxCard>
        ))}
      </div>
    </section>
  )
}
