import { ReactQueryProvider } from '../../lib/queryClient'
import WhaleAlertsWidget from '../../components/dashboard/WhaleAlertsWidget'
import CoinScannerWidget from '../../components/dashboard/CoinScannerWidget'
import AISignalsWidget from '../../components/dashboard/AISignalsWidget'
import CryptoScannerPanel from '../../components/dashboard/CryptoScannerPanel'

export default function DashboardPage(){
  return (
    <div className="container mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-neon mb-6">Dashboard</h1>
      <ReactQueryProvider>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <WhaleAlertsWidget />
            <CoinScannerWidget />
            <CryptoScannerPanel />
          </div>
          <div className="space-y-6">
            <AISignalsWidget />
          </div>
        </div>
      </ReactQueryProvider>
    </div>
  )
}
