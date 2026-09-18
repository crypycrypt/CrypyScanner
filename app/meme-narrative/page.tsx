"use client"

import { ReactQueryProvider } from '../../lib/queryClient'
import MemeNarrativeRadar from '../../components/meme/MemeNarrativeRadar'

export default function MemeNarrativePage() {
  return (
    <ReactQueryProvider>
      <MemeNarrativeRadar />
    </ReactQueryProvider>
  )
}
