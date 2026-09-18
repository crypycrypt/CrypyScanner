import { ReactQueryProvider } from '../../lib/queryClient'
import MemeDashboard from '../../components/meme/MemeDashboard'

export const metadata = { title: 'CrypyCrypt — Multi-Agent Floor', description: 'Real-time crypto trading bot execution floor' }

export default function DashboardPage(){
  return (
    <ReactQueryProvider>
      <MemeDashboard />
    </ReactQueryProvider>
  )
}
