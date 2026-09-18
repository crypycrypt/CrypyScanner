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
  image?: string | null
}

const FALLBACK_IMAGES: Record<string, string> = {
  LDO: 'https://assets.coingecko.com/coins/images/13573/large/Lido_DAO.png?1696513326',
  ETH: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png?1696501628',
  BTC: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1696501400',
  SOL: 'https://assets.coingecko.com/coins/images/4128/large/solana.png?1718769756',
  BNB: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png?1696501970',
}

export default function CoinIcon({ symbol, size = 32, className = '', image }: Props) {
  const clean = symbol.replace(/^\$/, '').toUpperCase()
  const [failedImage, setFailedImage] = useState(false)
  const [failedMappedImage, setFailedMappedImage] = useState(false)
  const [failedCdn, setFailedCdn] = useState(false)
  const hue = symHue(clean)
  const mappedImage = FALLBACK_IMAGES[clean]

  // spothq/cryptocurrency-icons covers 800+ coins by lowercase symbol
  // e.g. btc, eth, sol, bnb, xrp, usdt, yfi, uni, comp, aave …
  const src = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${clean.toLowerCase()}.png`

  if (image && !failedImage) {
    return (
      <img
        src={image}
        alt={clean}
        width={size}
        height={size}
        onError={() => setFailedImage(true)}
        className={`rounded-full object-contain flex-shrink-0 ${className}`}
        style={{ width: size, height: size, background: 'rgba(255,255,255,0.03)' }}
      />
    )
  }

  if (mappedImage && !failedMappedImage) {
    return (
      <img
        src={mappedImage}
        alt={clean}
        width={size}
        height={size}
        onError={() => setFailedMappedImage(true)}
        className={`rounded-full object-contain flex-shrink-0 ${className}`}
        style={{ width: size, height: size, background: 'rgba(255,255,255,0.03)' }}
      />
    )
  }

  if (failedCdn) {
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
      onError={() => setFailedCdn(true)}
      className={`rounded-full object-contain flex-shrink-0 ${className}`}
      style={{ width: size, height: size, background: 'rgba(255,255,255,0.03)' }}
    />
  )
}
