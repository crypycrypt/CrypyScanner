"use client"

import { ReactQueryProvider } from '../../lib/queryClient'
import MemeRiskScanner from '../../components/meme/MemeRiskScanner'

export default function MemeRiskPage() {
  return (
    <ReactQueryProvider>
      <MemeRiskScanner />
    </ReactQueryProvider>
  )
}
