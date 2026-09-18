import ParallaxCard from './ParallaxCard'

export default function Pricing(){
  const plans = [
    {
      name: 'Free',
      price: 'Rp 0',
      period: '/bulan',
      desc: 'Untuk trader pemula yang ingin explore tools',
      features: ['5 sinyal AI/hari', 'Whale alerts basic', 'Narrative tracker', 'Community access'],
      cta: 'Mulai Gratis',
      highlighted: false
    },
    {
      name: 'Pro',
      price: 'Rp 299K',
      period: '/bulan',
      desc: 'Untuk aktif trader yang butuh edge di pasar',
      features: ['Unlimited AI signals', 'Whale alerts premium', 'Wallet tracker unlimited', 'Market structure chart', 'Priority support'],
      cta: 'Upgrade Pro',
      highlighted: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      desc: 'Untuk fund & professional trader',
      features: ['API access', 'Custom indicators', 'Dedicated support', 'White-label options', 'SLA guarantee'],
      cta: 'Contact Sales',
      highlighted: false
    }
  ]

  return (
    <section className="container mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">💎</span>
        <div>
          <h2 className="text-3xl font-bold text-neon">Harga</h2>
          <p className="text-slate-400 text-sm">Pilih plan yang sesuai dengan kebutuhan trading kamu</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <ParallaxCard key={plan.name} artwork="/assets/ic_planet.svg" className={`p-6 rounded-xl transition-all ${plan.highlighted ? 'border-neon/50 md:scale-105' : 'hover:border-[rgba(0,240,255,0.3)]'}`}>
            {plan.highlighted && (
              <div className="text-xs font-bold text-neon bg-neon/10 px-3 py-1 rounded-full inline-block mb-4">
                MOST POPULAR
              </div>
            )}
            <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-3xl font-bold text-neon">{plan.price}</span>
              <span className="text-slate-500 text-sm">{plan.period}</span>
            </div>
            <p className="text-slate-400 text-sm mb-6">{plan.desc}</p>
            <ul className="space-y-3 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="text-green-400">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${plan.highlighted ? 'bg-neon text-[#0b1220] hover:bg-neon/90' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600/30'}`}>
              {plan.cta}
            </button>
          </ParallaxCard>
        ))}
      </div>
    </section>
  )
}
