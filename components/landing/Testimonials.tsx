export default function Testimonials(){
  return (
    <section className="container mx-auto px-6 py-12">
      <h2 className="text-3xl font-bold text-neon mb-4">Testimoni</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-glass p-6 rounded-xl">{"\"WhaleRadar AI membantu trading saya\" — TraderA"}</div>
        <div className="card-glass p-6 rounded-xl">{"\"Sinyalnya akurat\" — AnalystB"}</div>
        <div className="card-glass p-6 rounded-xl">{"\"Copilot AInya berguna\" — UserC"}</div>
      </div>
    </section>
  )
}
