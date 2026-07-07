import CryptoScannerTabs from '../../components/crypto-scanner/CryptoScannerTabs'
import { ReactQueryProvider } from '../../lib/queryClient'

export default function CryptoScannerPage(){
  return (
    <main className="container mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-neon mb-6">Crypto Scanner Suite</h1>
      <ReactQueryProvider>
        <CryptoScannerTabs />
      </ReactQueryProvider>
    </main>
  )
}
