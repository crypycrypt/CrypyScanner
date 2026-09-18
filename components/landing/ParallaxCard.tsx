'use client'

import { type ReactNode, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface Props {
  children: ReactNode
  className?: string
  artwork?: string
}

/** A small pointer-driven depth effect shared by the landing-page cards. */
export default function ParallaxCard({ children, className = '', artwork }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion || !cardRef.current) return
    const bounds = cardRef.current.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - 0.5
    const y = (event.clientY - bounds.top) / bounds.height - 0.5
    cardRef.current.style.setProperty('--card-x', `${x * 8}deg`)
    cardRef.current.style.setProperty('--card-y', `${y * -8}deg`)
    cardRef.current.style.setProperty('--glow-x', `${(x + 0.5) * 100}%`)
    cardRef.current.style.setProperty('--glow-y', `${(y + 0.5) * 100}%`)
  }

  const reset = () => {
    if (!cardRef.current) return
    cardRef.current.style.setProperty('--card-x', '0deg')
    cardRef.current.style.setProperty('--card-y', '0deg')
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      className={`parallax-card card-glass ${className}`}
    >
      <span className="parallax-card-glow" aria-hidden="true" />
      {artwork && <img className="parallax-card-art" src={artwork} alt="" aria-hidden="true" />}
      <div className="parallax-card-content">{children}</div>
    </motion.div>
  )
}
