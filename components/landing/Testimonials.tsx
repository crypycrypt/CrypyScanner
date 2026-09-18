import ParallaxCard from './ParallaxCard'

export default function Testimonials(){
  const testimonials = [
    {
      quote: 'WhaleRadar AI membantu trading saya. Sinyal akumulasi whale yang diberikan sangat timely dan profitable.',
      author: 'TraderA',
      role: 'Crypto Trader',
      avatar: '👤'
    },
    {
      quote: 'Sinyalnya akurat dan risk managementnya membantu saya menjaga capital. Recommended untuk serious trader.',
      author: 'AnalystB',
      role: 'Technical Analyst',
      avatar: '👤'
    },
    {
      quote: 'Copilot AInya berguna banget untuk quick scan market. Saves hours of manual analysis every day.',
      author: 'UserC',
      role: 'DeFi Investor',
      avatar: '👤'
    }
  ]

  return (
    <section className="container mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">💬</span>
        <div>
          <h2 className="text-3xl font-bold text-neon">Testimoni</h2>
          <p className="text-slate-400 text-sm">Apa kata trader tentang CrypyCrypt</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <ParallaxCard key={i} artwork="/assets/ic_stars.svg" className="p-6 rounded-xl hover:border-[rgba(0,240,255,0.3)] transition-all">
            <div className="text-3xl mb-4">"{t.quote}"</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-neon/20 flex items-center justify-center text-neon text-lg">
                {t.avatar}
              </div>
              <div>
                <div className="font-semibold text-white text-sm">{t.author}</div>
                <div className="text-xs text-slate-500">{t.role}</div>
              </div>
            </div>
          </ParallaxCard>
        ))}
      </div>
    </section>
  )
}
