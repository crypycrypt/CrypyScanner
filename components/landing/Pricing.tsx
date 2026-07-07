export default function Pricing(){
  return (
    <section className="container mx-auto px-6 py-12">
      <h2 className="text-3xl font-bold text-neon mb-4">Harga</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-glass p-6 rounded-xl">
          <h3 className="font-semibold">Free</h3>
          <p className="text-slate-400">5 sinyal/hari</p>
        </div>
        <div className="card-glass p-6 rounded-xl">
          <h3 className="font-semibold">Pro</h3>
          <p className="text-slate-400">Unlimited signals, Wallet Tracker</p>
        </div>
        <div className="card-glass p-6 rounded-xl">
          <h3 className="font-semibold">Enterprise</h3>
          <p className="text-slate-400">API & Prioritas AI</p>
        </div>
      </div>
    </section>
  )
}
