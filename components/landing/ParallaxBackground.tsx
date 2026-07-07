"use client"
import { useEffect, useState } from 'react'

export default function ParallaxBackground(){
  const [pos, setPos] = useState({x:0,y:0,scroll:0,enabled:true})

  useEffect(()=>{
    // disable heavy parallax on small screens
    const enabled = typeof window !== 'undefined' && window.innerWidth > 768
    setPos(p=>({ ...p, enabled }))

    function onMove(e: MouseEvent){
      if (!enabled) return
      const x = (e.clientX - window.innerWidth/2) / (window.innerWidth/2)
      const y = (e.clientY - window.innerHeight/2) / (window.innerHeight/2)
      setPos(p=>({ ...p, x, y }))
    }
    function onScroll(){
      if (!enabled) return
      setPos(p=>({ ...p, scroll: window.scrollY }))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('scroll', onScroll, { passive: true })
    function onResize(){
      const e = window.innerWidth > 768
      setPos(p=>({ ...p, enabled: e }))
    }
    window.addEventListener('resize', onResize)
    return ()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize) }
  }, [])

  // layer transforms - use translate3d for GPU acceleration
  const layer = (strength:number, invert=false)=>{
    if (!pos.enabled) return { transform: 'translate3d(0,0,0)' }
    const tx = (pos.x * strength * (invert ? -1:1)).toFixed(2)
    const ty = ((pos.y * strength * (invert ? -1:1)) + pos.scroll*0.0005*strength).toFixed(2)
    return { transform: `translate3d(${tx}px, ${ty}px, 0)`, willChange: 'transform' }
  }

  return (
    <div className="parallax-viewport pointer-events-none absolute inset-0 overflow-hidden">
      <div className="parallax-layer layer-1" style={layer(6)} aria-hidden />
      <div className="parallax-layer layer-2" style={layer(12,true)} aria-hidden />
      <div className="parallax-layer layer-3" style={layer(24)} aria-hidden />
      <div className="parallax-stars" style={layer(2)} aria-hidden />
    </div>
  )
}
