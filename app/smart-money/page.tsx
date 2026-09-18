"use client"

import React from 'react'
import WalletTracer from '../../components/smart-money/WalletTracer'
import { ReactQueryProvider } from '../../lib/queryClient'

export default function SmartMoneyPage() {
  return (
    <ReactQueryProvider>
      <div className="min-h-screen">
        <WalletTracer />
      </div>
    </ReactQueryProvider>
  )
}
