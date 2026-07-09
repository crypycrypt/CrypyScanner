"use client"
import Link from 'next/link'
import WalletConnectButton from './WalletConnectButton'
import { useState, useEffect, useRef } from 'react'

export default function Navbar(){
  const [stocksOpen, setStocksOpen] = useState(false)
  const [cryptoOpen, setCryptoOpen] = useState(false)
  
  const handleStocksClick = () => {
    console.log('Stocks button clicked, current state:', stocksOpen)
    setStocksOpen(!stocksOpen)
    setCryptoOpen(false)
  }

  const handleCryptoClick = () => {
    console.log('Crypto button clicked, current state:', cryptoOpen)
    setCryptoOpen(!cryptoOpen)
    setStocksOpen(false)
  }
  
  return (
    <nav className="w-full py-4">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between card-glass p-3 rounded-xl">
        <Link href="/" className="flex items-center gap-3">
          <img src="/assets/ic_logo.png" alt="WhaleRadar AI" className="h-8 w-8 object-contain" />
          <span className="text-neon font-bold text-xl">WhaleRadar AI</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/home" className="text-slate-300 hover:text-white transition-colors">Home</Link>
          <Link href="/dashboard" className="text-slate-300 hover:text-white transition-colors">Dashboard</Link>
          
          {/* Crypto Dropdown */}
          <div className="relative">
            <button
              className="text-slate-300 hover:text-white transition-colors flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-slate-800"
              onClick={handleCryptoClick}
            >
              Crypto ▾
            </button>
            {cryptoOpen && (
              <div
                className="absolute top-full left-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-2 min-w-[180px] z-50"
                style={{
                  display: 'block',
                  opacity: 1,
                  visibility: 'visible',
                  transform: 'translateY(0)'
                }}
              >
                <Link href="/crypto-scanner" className="block px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors" onClick={() => setCryptoOpen(false)}>
                  Crypto Scanner
                </Link>
                <Link href="/sniper-scanner" className="block px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors" onClick={() => setCryptoOpen(false)}>
                  Sniper Scanner
                </Link>
                <Link href="/dex-analyzer" className="block px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors" onClick={() => setCryptoOpen(false)}>
                  DEX Analyzer
                </Link>
                <Link href="/smart-money" className="block px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors" onClick={() => setCryptoOpen(false)}>
                  Smart Money
                </Link>
                <Link href="/futures-analysis" className="block px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors" onClick={() => setCryptoOpen(false)}>
                  Futures Analysis
                </Link>
              </div>
            )}
          </div>
          
          {/* Stocks Dropdown */}
          <div className="relative">
            <button
              className="text-slate-300 hover:text-white transition-colors flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-slate-800"
              onClick={handleStocksClick}
            >
              Stocks ▾
            </button>
            {stocksOpen && (
              <div
                className="absolute top-full left-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-2 min-w-[140px] z-50"
                style={{
                  display: 'block',
                  opacity: 1,
                  visibility: 'visible',
                  transform: 'translateY(0)'
                }}
              >
                <Link href="/stocks/idx" className="block px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors" onClick={() => setStocksOpen(false)}>
                  IDX Stocks
                </Link>
                <Link href="/stocks/us" className="block px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors" onClick={() => setStocksOpen(false)}>
                  US Stocks
                </Link>
              </div>
            )}
          </div>
          
          <WalletConnectButton />
        </div>
      </div>
    </nav>
  )
}
