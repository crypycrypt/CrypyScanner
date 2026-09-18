import ParallaxCard from './ParallaxCard'

export default function WalletIntelligence(){
  const features = [
    {
      icon: '🔍',
      title: 'Lacak Wallet',
      desc: 'Masukkan alamat wallet untuk melihat nilai portofolio, alokasi token, P/L real-time, dan skor smart money.',
      stat: '50K+',
      statLabel: 'Wallet Terdaftar'
    },
    {
      icon: '🛡️',
      title: 'Reputasi Wallet',
      desc: 'Analisis reputasi otomatis: smart money, bot, atau exchange. Dapatkan insight dari pola transaksi.',
      stat: '94%',
      statLabel: 'Akurasi Deteksi'
    }
  ]

  return (
    <section className="container mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">🧠</span>
        <div>
          <h2 className="text-3xl font-bold text-neon">Kecerdasan Wallet</h2>
          <p className="text-slate-400 text-sm">Teknologi AI untuk melacak dan menganalisis pola wallet smart money</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((f, i) => (
          <ParallaxCard key={i} artwork="/assets/ic_fingerprint.svg" className="p-6 rounded-xl hover:border-[rgba(0,240,255,0.3)] transition-all group">
            <div className="flex items-start gap-4">
              <span className="text-3xl">{f.icon}</span>
              <div className="flex-1">
                <h4 className="font-semibold text-white mb-2 group-hover:text-neon transition-colors">{f.title}</h4>
                <p className="text-slate-400 text-sm mb-4">{f.desc}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-neon">{f.stat}</span>
                  <span className="text-xs text-slate-500">{f.statLabel}</span>
                </div>
              </div>
            </div>
          </ParallaxCard>
        ))}
      </div>
    </section>
  )
}
