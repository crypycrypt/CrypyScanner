export default function Features(){
  const items = [
    {title: 'Whale Alerts', desc: 'Alert real-time untuk akumulasi besar'},
    {title: 'Wallet Tracker', desc: 'Lacak portofolio dan transaksi'},
    {title: 'AI Analysis', desc: 'Ringkasan AI untuk sinyal dan risiko'},
  ]
  return (
    <section id="features" className="container mx-auto px-6 py-12">
      <h2 className="text-3xl font-bold mb-6 text-neon">Fitur Utama</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map(i=> (
          <div key={i.title} className="card-glass p-6 rounded-xl">
            <h4 className="font-semibold">{i.title}</h4>
            <p className="text-slate-400">{i.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
