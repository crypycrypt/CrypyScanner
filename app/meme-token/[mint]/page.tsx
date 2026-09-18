"use client"

import { ReactQueryProvider } from '../../../lib/queryClient'
import MemeTokenDetail from '../../../components/meme/MemeTokenDetail'
import { useParams } from 'next/navigation'

export default function MemeTokenDetailPage() {
  const params = useParams()
  const mint = params.mint as string

  return (
    <ReactQueryProvider>
      <MemeTokenDetail mint={mint} />
    </ReactQueryProvider>
  )
}
