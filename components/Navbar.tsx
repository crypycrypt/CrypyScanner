"use client"
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import WalletConnectButton from './WalletConnectButton'

const cryptoItems = [
  { href: '/crypto-scanner', label: 'Crypto Scanner', icon: '/assets/ic_chart.svg' },
  { href: '/sniper-scanner', label: 'AI Signal', icon: '/assets/ic_fingerprint.svg' },
  { href: '/dex-analyzer', label: "Meme's", icon: '/assets/ic_universe.svg' },
  { href: '/smart-money', label: 'Smart Money', icon: '/assets/ic_ai.svg' },
]

const stockItems = [
  { href: '/idx-stocks', label: 'IDX Stocks', icon: '/assets/ic_chart.svg' },
  { href: '/us-stocks', label: 'US Stocks', icon: '/assets/ic_universe.svg' },
]

type MenuKey = 'crypto' | 'stocks' | null

export default function Navbar(){
  const [openMenu, setOpenMenu] = useState<MenuKey>(null)
  const navRef = useRef<HTMLElement>(null)
  const pathname = usePathname()

  // Close any open menu whenever the route changes (client-side nav keeps this mounted).
  useEffect(() => {
    setOpenMenu(null)
  }, [pathname])

  // Close on outside click / touch.
  useEffect(() => {
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const toggleMenu = (key: Exclude<MenuKey, null>) => {
    setOpenMenu((current) => (current === key ? null : key))
  }

  const closeAll = () => setOpenMenu(null)

  const renderDropdown = (key: Exclude<MenuKey, null>, label: string, items: { href: string; label: string; icon: string }[]) => {
    const open = openMenu === key
    return (
      <div className="relative" style={{ zIndex: 100 }}>
        <button
          type="button"
          className="nav-link nav-link-button"
          onClick={() => toggleMenu(key)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {label} ▾
        </button>
        {open && (
          <div className="nav-dropdown min-w-[230px]" role="menu" onClick={(e) => e.stopPropagation()}>
            {items.map((item, index) => (
              <Link href={item.href} className="nav-dropdown-item" onClick={closeAll} key={item.href} role="menuitem">
                <span className="nav-dropdown-icon" style={{ animationDelay: `${index * 120}ms` }}>
                  <img src={item.icon} alt="" />
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <nav ref={navRef} className="landing-nav w-full py-5 px-4">
      <div className="nav-pill max-w-6xl mx-auto">
        <Link href="/" className="nav-brand" onClick={closeAll}>
          {/* Logo top-menu kiri — diganti ke ic_aurora copy.svg (line-art SVG,
              jadi object-contain tanpa crop bundar; spasi di nama file
              di-encode %20 agar valid sebagai URL). */}
          <img src="/assets/ic_aurora%20copy.svg" alt="WhaleRadar AI" className="h-12 w-12 object-contain" />
          <span className="text-neon font-bold text-xl">WhaleRadar AI</span>
        </Link>
        <div className="nav-menu">
          <Link href="/home" className="nav-link" onClick={closeAll}>Home</Link>
          <Link href="/dashboard" className="nav-link" onClick={closeAll}>Dashboard</Link>

          {renderDropdown('crypto', 'Crypto', cryptoItems)}
          {renderDropdown('stocks', 'Stocks', stockItems)}

          <WalletConnectButton />
        </div>
      </div>
    </nav>
  )
}
