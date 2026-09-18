"use client"
import { useEffect, useState, useRef } from 'react'

interface MousePos {
  x: number
  y: number
  scroll: number
  enabled: boolean
}

export default function ParallaxBackground(){
  const [pos, setPos] = useState<MousePos>({x:0,y:0,scroll:0,enabled:true})
  const rafRef = useRef<number>(0)

  useEffect(()=>{
    const enabled = typeof window !== 'undefined' && window.innerWidth > 768
    setPos(p=>({ ...p, enabled }))

    let latest = { x: 0, y: 0 }

    function onMove(e: MouseEvent){
      if (!enabled) return
      const x = (e.clientX - window.innerWidth/2) / (window.innerWidth/2)
      const y = (e.clientY - window.innerHeight/2) / (window.innerHeight/2)
      latest = { x, y }
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        setPos(p=>({ ...p, x: latest.x, y: latest.y }))
      })
    }
    function onScroll(){
      if (!enabled) return
      setPos(p=>({ ...p, scroll: window.scrollY }))
    }
    function onResize(){
      const e = window.innerWidth > 768
      setPos(p=>({ ...p, enabled: e }))
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)

    return ()=>{
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // layer transforms - use translate3d for GPU acceleration
  const layer = (strength:number, invert=false)=>{
    if (!pos.enabled) return { transform: 'translate3d(0,0,0)' }
    const tx = (pos.x * strength * (invert ? -1:1)).toFixed(2)
    const ty = ((pos.y * strength * (invert ? -1:1)) + pos.scroll*0.0005*strength).toFixed(2)
    return { transform: `translate3d(${tx}px, ${ty}px, 0)`, willChange: 'transform' }
  }

  // Generate floating particle positions
  const particleCount = 24
  const particles = Array.from({ length: particleCount }, (_, i) => ({
    id: i,
    size: Math.random() * 3 + 1,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 3,
    duration: Math.random() * 4 + 3,
  }))

  return (
    <div className="parallax-viewport pointer-events-none absolute inset-0 overflow-hidden">
      {/* Deep background gradient */}
      <div className="parallax-gradient-bg" aria-hidden />

      {/* Layer 1 - Far background (cyan glow) */}
      <div className="parallax-layer layer-1" style={layer(8)} aria-hidden />

      {/* Layer 2 - Mid background (purple glow, inverted) */}
      <div className="parallax-layer layer-2" style={layer(16, true)} aria-hidden />

      {/* Layer 3 - Near background (green accent) */}
      <div className="parallax-layer layer-3" style={layer(28)} aria-hidden />

      {/* Layer 4 - Floating geometric orbs */}
      <div className="parallax-layer layer-4" style={layer(12, true)} aria-hidden />

      {/* Layer 5 - Star field with twinkling */}
      <div className="parallax-stars" style={layer(2)} aria-hidden>
        {particles.map((p) => (
          <div
            key={p.id}
            className="parallax-star"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
            aria-hidden
          />
        ))}
      </div>

      {/* Layer 6 - Subtle grid overlay */}
      <div className="parallax-grid" style={layer(4)} aria-hidden />
    </div>
  )
}
