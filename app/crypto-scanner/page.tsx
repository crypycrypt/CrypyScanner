import CoinScannerWidget from '../../components/dashboard/CoinScannerWidget'
import { ReactQueryProvider } from '../../lib/queryClient'

export default function CryptoScannerPage(){
  return (
    <main className="container mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-neon mb-6">Crypto Scanner</h1>
      <ReactQueryProvider>
        <CoinScannerWidget />
      </ReactQueryProvider>
    </main>
  )
}
