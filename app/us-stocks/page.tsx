"use client"

import StockSignalTerminal from '../../components/stock-scanner/StockSignalTerminal'
import StockMarketOverview from '../../components/stock-scanner/StockMarketOverview'

export default function UsStocksPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-6 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src="/assets/ic_universe.svg" alt="" className="w-9 h-9" />
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                US Stocks
              </h1>
              <p className="text-slate-400 mt-2">Scanner sinyal saham US — data Yahoo Finance, gratis, tanpa API key</p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-green-500/20 border border-green-400/50 text-green-300 text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            LIVE
          </div>
        </div>

        <StockMarketOverview market="US" />
        <StockSignalTerminal market="US" />
      </div>
    </main>
  )
}
