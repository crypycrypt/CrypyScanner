"use client"
import { useState } from 'react'

// Deterministic hue from symbol — used for fallback avatar color
function symHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h) % 360
}

interface Props {
  symbol: string
  size?: number
  className?: string
}

export default function CoinIcon({ symbol, size = 32, className = '' }: Props) {
  const clean = symbol.replace(/^\$/, '').toUpperCase()
  const [failed, setFailed] = useState(false)
  const hue = symHue(clean)

  // spothq/cryptocurrency-icons covers 800+ coins by lowercase symbol
  // e.g. btc, eth, sol, bnb, xrp, usdt, yfi, uni, comp, aave …
  const src = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${clean.toLowerCase()}.png`

  if (failed) {
    // Fallback: colored circle avatar with first 2 chars
    return (
      <div
        className={`flex-shrink-0 rounded-full flex items-center justify-center font-bold select-none ${className}`}
        style={{
          width: size,
          height: size,
          background: `hsl(${hue},52%,20%)`,
          border: `1.5px solid hsl(${hue},60%,40%)`,
          color: `hsl(${hue},85%,72%)`,
          fontSize: Math.max(8, Math.floor(size * 0.34)),
          letterSpacing: '-0.02em',
        }}
      >
        {clean.slice(0, 2)}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={clean}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`rounded-full object-contain flex-shrink-0 ${className}`}
      style={{ width: size, height: size, background: 'rgba(255,255,255,0.03)' }}
    />
  )
}
