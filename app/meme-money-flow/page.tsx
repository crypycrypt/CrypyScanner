"use client"

import { ReactQueryProvider } from '../../lib/queryClient'
import MemeMoneyFlow from '../../components/meme/MemeMoneyFlow'

export default function MemeMoneyFlowPage() {
  return (
    <ReactQueryProvider>
      <MemeMoneyFlow />
    </ReactQueryProvider>
  )
}
