"use client"

import { ReactQueryProvider } from '../../lib/queryClient'
import MemeScanner from '../../components/meme/MemeScanner'

export default function MemeScannerPage() {
  return (
    <ReactQueryProvider>
      <MemeScanner />
    </ReactQueryProvider>
  )
}
