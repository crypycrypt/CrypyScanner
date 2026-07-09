"use client"

import React from 'react'
import SignalTerminal from '../../components/crypto-scanner/SignalTerminal'
import { ReactQueryProvider } from '../../lib/queryClient'

export default function FuturesAnalysis() {
  return (
    <ReactQueryProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Signal Terminal</h1>
            <p className="text-slate-400 mt-2">Hacker terminal interface for real-time futures signals</p>
          </div>
          <SignalTerminal />
        </div>
      </div>
    </ReactQueryProvider>
  )
}