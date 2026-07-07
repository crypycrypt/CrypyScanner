"use client"
import Link from 'next/link'
import { motion } from 'framer-motion'
import ParallaxBackground from './ParallaxBackground'
import ForegroundHUD from './ForegroundHUD'

export default function HeroSection(){
  return (
    <section className="relative overflow-hidden rounded-3xl">
      <ParallaxBackground />
      <div className="container mx-auto px-6 py-20 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <motion.h1 initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="text-6xl lg:text-7xl font-extrabold text-neon mb-4 leading-tight font-game">WhaleRadar AI</motion.h1>
            <motion.p initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} className="text-xl text-slate-300 mb-6 max-w-xl">Platform analitik Web3 bertenaga AI. Dapatkan alert whale real-time, analisis smart-money, dan copilot AI untuk keputusan trading lebih cepat.</motion.p>
            <div className="flex gap-4">
              <Link href="/dashboard" className="btn-theme">Buka Dashboard</Link>
              <a href="#features" className="btn-theme">Fitur</a>
            </div>
          </div>
          <motion.div initial={{opacity:0,scale:0.98}} animate={{opacity:1,scale:1}} className="card-glass p-6 rounded-2xl flex flex-col lg:flex-row gap-4 items-center shadow-2xl">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-neon">AI Crypto Copilot</h3>
              <p className="text-slate-400">Tanyakan tentang wallet, token, atau aktivitas whale — dapatkan ringkasan yang mudah dipahami oleh AI kami.</p>
              <div className="mt-4">
                <input placeholder="Tanya: Haruskah saya beli $MEGA?" className="w-full p-3 rounded-md bg-transparent border border-[rgba(255,255,255,0.04)] text-slate-200" />
                <div className="mt-3 flex justify-end">
                  <button className="btn-theme btn-theme-sm">Tanya Copilot</button>
                </div>
            <ForegroundHUD />
              </div>
            </div>
            <div className="w-44 h-44 flex-shrink-0">
              <img src="/assets/ic_build.png" alt="Hero" className="w-full h-full object-contain" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
