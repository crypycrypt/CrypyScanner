export default function FAQ(){
  const faqs = [
    {q: 'Apa itu WhaleRadar AI?', a: 'Platform analitik Web3 berbasis AI untuk memantau whale dan smart money.'},
    {q: 'Bagaimana cara kerja AI Copilot?', a: 'AI menganalisis on-chain data dan menghasilkan ringkasan serta sinyal.'},
  ]
  return (
    <section className="container mx-auto px-6 py-12">
      <h2 className="text-3xl font-bold text-neon mb-4">FAQ</h2>
      <div className="grid grid-cols-1 gap-4">
        {faqs.map(f=> (
          <div key={f.q} className="card-glass p-4 rounded-md">
            <div className="font-semibold">{f.q}</div>
            <div className="text-slate-400">{f.a}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
