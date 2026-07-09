import { ReactQueryProvider } from '../../lib/queryClient'
import WhaleAlertsWidget from '../../components/dashboard/WhaleAlertsWidget'
import WhaleActivityMonitor from '../../components/dashboard/WhaleActivityMonitor'
import CoinScannerWidget from '../../components/dashboard/CoinScannerWidget'
import AISignalsWidget from '../../components/dashboard/AISignalsWidget'
import SignalBotWidget from '../../components/dashboard/SignalBotWidget'
import AnimatedWalletGraph from '../../components/dashboard/AnimatedWalletGraph'
import MarketDirectionChart from '../../components/dashboard/MarketDirectionChart'
import FearGreedIndex from '../../components/dashboard/FearGreedIndex'

export default function DashboardPage(){
  return (
    <ReactQueryProvider>
      <div className="space-y-8 py-4">
        {/* Top Section: Market Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MarketDirectionChart />
          </div>
          <div className="space-y-6">
            <FearGreedIndex />
            <AnimatedWalletGraph />
          </div>
        </div>
        
        {/* AI Signals — full width at the top */}
        <AISignalsWidget />
        {/* Signal Bot — full width */}
        <SignalBotWidget />
        {/* Whale Activity Monitor — full width */}
        <WhaleActivityMonitor />
        {/* Whale Alert Signals — full width */}
        <WhaleAlertsWidget />
        {/* Coin Scanner — full width */}
        <CoinScannerWidget />
      </div>
    </ReactQueryProvider>
  )
}

