export default function WhaleActivity(){
  return (
    <section className="container mx-auto px-6 py-12">
      <h2 className="text-3xl font-bold text-neon mb-4">Aktivitas Whale</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-glass p-4 rounded-xl">
          <h4 className="font-semibold">Akun: 0xAbc...123</h4>
          <p className="text-slate-400">Akumulasi besar pada token $AI</p>
          <div className="mt-2 text-slate-200">Volume: 1,200,000</div>
        </div>
        <div className="card-glass p-4 rounded-xl">
          <h4 className="font-semibold">Distribusi Whale</h4>
          <p className="text-slate-400">Whale membagi posisi ke beberapa alamat</p>
        </div>
        <div className="card-glass p-4 rounded-xl">
          <h4 className="font-semibold">Sinyal Beli/Jual</h4>
          <p className="text-slate-400">Confidence: 78% — Analisis Volume/MCap</p>
        </div>
      </div>
    </section>
  )
}
