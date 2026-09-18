import ParallaxCard from './ParallaxCard'

export default function FAQ(){
  const faqs = [
    {
      q: 'Apa itu CrypyCrypt?',
      a: 'CrypyCrypt adalah platform analitik crypto berbasis AI yang menggabungkan whale tracking, wallet intelligence, dan market structure analysis untuk memberikan edge trading.'
    },
    {
      q: 'Bagaimana cara kerja AI Copilot?',
      a: 'AI Copilot menganalisis on-chain data, volume, market structure, dan sentiment untuk menghasilkan ringkasan sinyal BUY/SELL/WATCH secara real-time.'
    },
    {
      q: 'Apakah data whale akurat?',
      a: 'Ya, kami menggunakan multiple data sources dan algoritma deteksi yang telah diuji untuk mengidentifikasi akumulasi dan distribusi whale dengan akurasi tinggi.'
    },
    {
      q: 'Apakah ada free trial?',
      a: 'Tentu! Plan Free memberikan akses ke 5 sinyal AI per hari, whale alerts basic, dan narrative tracker. Tanpa kartu kredit.'
    }
  ]

  return (
    <section className="container mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">❓</span>
        <div>
          <h2 className="text-3xl font-bold text-neon">FAQ</h2>
          <p className="text-slate-400 text-sm">Pertanyaan yang sering ditanyakan</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        {faqs.map((f) => (
          <ParallaxCard key={f.q} artwork="/assets/ic_ai.svg" className="p-5 rounded-xl hover:border-[rgba(0,240,255,0.3)] transition-all">
            <div className="font-semibold text-white mb-2">{f.q}</div>
            <div className="text-slate-400 text-sm">{f.a}</div>
          </ParallaxCard>
        ))}
      </div>
    </section>
  )
}
