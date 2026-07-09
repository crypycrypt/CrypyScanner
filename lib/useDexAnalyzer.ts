import { useQuery } from '@tanstack/react-query'
import { getTopGainers, searchToken, getTrendingTokens } from './dexScreenerApi'

export interface DexPair {
  id: string
  symbol: string
  name: string
  chain: string
  dex: string
  addr: string
  price: number
  change: number
  mcap: string
  fdv: string
  vol24: string
  liq: string
  h1: number
  h24: number
  d7: number
  txns5m: number
  pairAddress: string
  baseToken: any
  quoteToken: any
  url: string
}

export function useDexAnalyzer() {
  return useQuery({
    queryKey: ['dex-analyzer'],
    queryFn: async (): Promise<DexPair[]> => {
      // Fetch trending tokens from DEXScreener API
      const trendingTokens = await getTrendingTokens()
      
      // If trending tokens are available, use them
      if (trendingTokens.length > 0) {
        return trendingTokens.slice(0, 20)
      }
      
      // Fallback to top gainers if trending tokens are empty
      const topGainers = await getTopGainers('solana', '24h')
      return topGainers.slice(0, 20)
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  })
}

export function useDexSearch(query: string) {
  return useQuery({
    queryKey: ['dex-search', query],
    queryFn: async (): Promise<DexPair[]> => {
      if (!query.trim()) return []
      return await searchToken(query)
    },
    enabled: query.trim().length > 0,
    staleTime: 30000,
  })
}