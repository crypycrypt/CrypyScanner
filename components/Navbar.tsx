"use client"
import Link from 'next/link'
import WalletConnectButton from './WalletConnectButton'

export default function Navbar(){
  return (
    <nav className="w-full py-4">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between card-glass p-3 rounded-xl">
        <Link href="/" className="flex items-center gap-3">
          <img src="/assets/ic_logo.png" alt="WhaleRadar AI" className="h-8 w-8 object-contain" />
          <span className="text-neon font-bold text-xl">WhaleRadar AI</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-300">Dashboard</Link>
          <Link href="/crypto-scanner" className="text-slate-300">Crypto Scanner</Link>
          <Link href="/pricing" className="text-slate-300">Pricing</Link>
          <WalletConnectButton />
        </div>
      </div>
    </nav>
  )
}
