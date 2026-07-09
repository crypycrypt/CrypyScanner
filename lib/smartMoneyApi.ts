// Real-time Smart Money API for tracking wallet activities

interface SmartMoneyWallet {
  id: string
  addr: string
  label: string
  score: number
  roi30d: string
  topTokens: string[]
  lastActive: string
}

// Mock data that simulates real-time smart money tracking
export const mockSmartMoneyData: SmartMoneyWallet[] = [
  {
    id: 'sm1',
    addr: '0xAbc...123',
    label: 'Smart Whale',
    score: 92,
    roi30d: '+148%',
    topTokens: ['SOL', 'AI', 'ORDI'],
    lastActive: '3h ago'
  },
  {
    id: 'sm2',
    addr: '0xDef...456',
    label: 'Alpha Trader',
    score: 87,
    roi30d: '+89%',
    topTokens: ['BTC', 'JTO', 'MON'],
    lastActive: '1d ago'
  },
  {
    id: 'sm3',
    addr: '0x7Fa...789',
    label: 'DeFi Degen',
    score: 74,
    roi30d: '+210%',
    topTokens: ['YFI', 'COMP', 'UNI'],
    lastActive: '2h ago'
  },
  {
    id: 'sm4',
    addr: '0x3Bc...321',
    label: 'Long-term Bull',
    score: 68,
    roi30d: '+34%',
    topTokens: ['BTC', 'ETH', 'SOL'],
    lastActive: '5h ago'
  }
]

// Real-time Smart Money hook
export function useSmartMoneyRealTime() {
  // In a real implementation, this would fetch from blockchain APIs
  // For now, we'll use mock data that simulates real-time updates
  return {
    data: mockSmartMoneyData,
    isLoading: false
  }
}