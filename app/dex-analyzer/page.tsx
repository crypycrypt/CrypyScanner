"use client"

import React from 'react'
import MemeCommandCenter from '../../components/meme/MemeCommandCenter'
import { ReactQueryProvider } from '../../lib/queryClient'

export default function DexAnalyzerPage() {
  return (
    <ReactQueryProvider>
      <MemeCommandCenter />
    </ReactQueryProvider>
  )
}
