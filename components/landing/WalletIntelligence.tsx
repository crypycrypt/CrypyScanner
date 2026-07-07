export default function WalletIntelligence(){
  return (
    <section className="container mx-auto px-6 py-12">
      <h2 className="text-3xl font-bold text-neon mb-4">Kecerdasan Wallet</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-glass p-4 rounded-xl">
          <h4 className="font-semibold">Lacak Wallet</h4>
          <p className="text-slate-400">Masukkan alamat wallet untuk melihat nilai portofolio, alokasi token, P/L dan skor smart money.</p>
        </div>
        <div className="card-glass p-4 rounded-xl">
          <h4 className="font-semibold">Reputasi Wallet</h4>
          <p className="text-slate-400">Analisis reputasi: smart, bot, atau exchange?</p>
        </div>
      </div>
    </section>
  )
}
