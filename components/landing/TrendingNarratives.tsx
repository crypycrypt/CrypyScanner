export default function TrendingNarratives(){
  return (
    <section className="container mx-auto px-6 py-12">
      <h2 className="text-3xl font-bold text-neon mb-4">Narasi Populer</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['AI','Memecoin','Gaming','Layer2'].map((t)=> (
          <div key={t} className="card-glass p-3 rounded-md text-center">{t}</div>
        ))}
      </div>
    </section>
  )
}
