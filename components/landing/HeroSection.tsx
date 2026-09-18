"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import ParallaxBackground from './ParallaxBackground'
import ForegroundHUD from './ForegroundHUD'

const slides = [
  {
    title: 'Explore every signal',
    desc: 'Pantau pergerakan whale, exchange inflow, dan anomali volume dari ruang komando Anda.',
    background: '/assets/ic_bg1.png',
    tag: 'Live Signal',
    card: { image: '/assets/ic_dinosour.png', title: 'Signal hunter', detail: 'Deteksi peluang lebih awal' },
  },
  {
    title: 'Your crypto universe',
    desc: 'Temukan wallet aktif, rotasi token, dan pola akumulasi melalui insight yang lebih jelas.',
    background: '/assets/ic_bg2.png',
    tag: 'Smart Money',
    card: { image: '/assets/ic_coin.png', title: 'Market rewards', detail: 'Ikuti momentum terbaik' },
  },
]

// Floating data particle positions
const particles = [
  { left: '10%', top: '20%', delay: 0.1, size: 8 },
  { left: '85%', top: '15%', delay: 0.3, size: 6 },
  { left: '15%', top: '75%', delay: 0.5, size: 10 },
  { left: '90%', top: '65%', delay: 0.7, size: 7 },
  { left: '50%', top: '10%', delay: 0.9, size: 5 },
  { left: '70%', top: '80%', delay: 1.1, size: 9 },
]

export default function HeroSection(){
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length)
    }, 3800)

    return () => window.clearInterval(timer)
  }, [])

  const slide = slides[active]

  return (
    <section className="hero-carousel-section relative overflow-hidden rounded-3xl">
      <ParallaxBackground />
      <div className="container mx-auto px-6 py-20 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.85fr)] gap-12 items-center">
          <div className="hero-copy-block min-w-0">
            <motion.img
              src="/assets/ic_astronout.png"
              alt="Astronaut explorer"
              className="hero-landing-astronaut"
              animate={{ y: [0, -12, 0], rotate: [-2, 2, -2] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.h1
              initial={{opacity:0,y:8}}
              animate={{opacity:1,y:0}}
              transition={{duration:0.8, ease:'easeOut'}}
              className="hero-title font-extrabold text-neon mb-4 leading-tight font-game"
            >
              WhaleRadar AI
            </motion.h1>
            <motion.p
              initial={{opacity:0,y:6}}
              animate={{opacity:1,y:0}}
              transition={{duration:0.8, ease:'easeOut', delay:0.15}}
              className="text-xl text-slate-300 mb-6 max-w-xl"
            >
              Platform analitik Web3 bertenaga AI. Dapatkan alert whale real-time, analisis smart-money, dan copilot AI untuk keputusan trading lebih cepat.
            </motion.p>
            <motion.div
              initial={{opacity:0,y:6}}
              animate={{opacity:1,y:0}}
              transition={{duration:0.8, ease:'easeOut', delay:0.3}}
              className="flex gap-4"
            >
              <Link href="/dashboard" className="btn-theme">Buka Dashboard</Link>
              <a href="#features" className="btn-theme">Fitur</a>
            </motion.div>
          </div>
          <motion.div
            initial={{opacity:0,scale:0.98}}
            animate={{opacity:1,scale:1}}
            transition={{duration:0.8, ease:'easeOut', delay:0.2}}
            className="hero-carousel-shell"
          >
            {/* Orbit rings */}
            <motion.div
              className="hero-orbit hero-orbit-one"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 0.15, 0.15], scale: [0.8, 1, 1] }}
              transition={{ duration: 1.5, delay: 0.5 }}
            />
            <motion.div
              className="hero-orbit hero-orbit-two"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 0.12, 0.12], scale: [0.8, 1, 1] }}
              transition={{ duration: 1.5, delay: 0.7 }}
            />
            <motion.div
              className="hero-orbit hero-orbit-three"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 0.1, 0.1], scale: [0.8, 1, 1] }}
              transition={{ duration: 1.5, delay: 0.9 }}
            />

            {/* Floating data particles */}
            {particles.map((p, i) => (
              <motion.div
                key={i}
                className="hero-data-particle"
                style={{ left: p.left, top: p.top, width: p.size, height: p.size }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 0.6, 0.6, 0],
                  scale: [0, 1, 1, 0],
                  y: [0, -10, -10, 0],
                }}
                transition={{
                  duration: 4,
                  delay: p.delay,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}

            <AnimatePresence mode="wait">
              <motion.div
                key={slide.background}
                className="hero-carousel-background"
                style={{ backgroundImage: `url("${slide.background}")` }}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.55 }}
              />
            </AnimatePresence>
            <div className="hero-carousel-shade" />
            <ForegroundHUD />
            <div className="hero-carousel-copy">
              <span className="hero-carousel-tag">{slide.tag}</span>
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                >
                  <h3>{slide.title}</h3>
                  <p>{slide.desc}</p>
                </motion.div>
              </AnimatePresence>
              <div className="mt-4">
                <input placeholder="Tanya: Haruskah saya beli $MEGA?" className="hero-copilot-input" />
                <div className="mt-3 flex justify-end">
                  <button className="btn-theme btn-theme-sm">Tanya Copilot</button>
                </div>
              </div>
            </div>
            <div className="hero-carousel-visual" aria-label={slide.title}>
              <motion.div key={slide.card.title} className="hero-feature-card" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
                <img src={slide.card.image} alt="" />
                <div><strong>{slide.card.title}</strong><span>{slide.card.detail}</span></div>
              </motion.div>
              <span className="hero-carousel-visual-label">{slide.tag}</span>
            </div>
            <div className="hero-carousel-dots" aria-label="Hero carousel controls">
              {slides.map((item, index) => (
                <button
                  key={item.title}
                  className={index === active ? 'active' : ''}
                  onClick={() => setActive(index)}
                  aria-label={`Show ${item.title}`}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
