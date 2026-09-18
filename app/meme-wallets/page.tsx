"use client"

import { ReactQueryProvider } from '../../lib/queryClient'
import MemeWalletTracker from '../../components/meme/MemeWalletTracker'

export default function MemeWalletsPage() {
  return (
    <ReactQueryProvider>
      <MemeWalletTracker />
    </ReactQueryProvider>
  )
}
