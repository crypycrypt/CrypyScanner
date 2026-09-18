"use client"

import React from 'react'
import SniperScanner from '../../components/crypto-scanner/SniperScanner'
import { ReactQueryProvider } from '../../lib/queryClient'

export default function SniperScannerPage() {
  return (
    <ReactQueryProvider>
      <SniperScanner />
    </ReactQueryProvider>
  )
}