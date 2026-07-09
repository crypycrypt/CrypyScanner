"use client"
import { useQuery } from '@tanstack/react-query'

// Type definitions
interface WhaleSignal {
  id: string
  symbol: string
  name: string
  ticker: string
  signal: string
  label: string
  score: number
  scoreMax: number
  h1: number
  h24: number
  d7: number
  volMcap: number
  tags: string[]
  spike: boolean
  color: string
}

interface CoinScannerData {
  id: string
  rank: number
  symbol: string
  name: string
  price: number
  age: string
  h1: number
  h24: number
  d7: number
  volume: string
  mcap: string
  liq: string
  signal: string
}

interface SignalBotData {
  id: string
  symbol: string
  name: string
  signal: string
  status: string
  entryPrice: number
  targetPrice: number
  profitPct: number
  confidence: number
  h1: number
  h24: number
  d7: number
  volMcap: number
}

// Real-time cryptocurrency data APIs
const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const BINANCE_API = 'https://api.binance.com/api/v3'
const PROXY_API = '/api/coingecko/markets'

// Real-time whale monitor using CoinGecko API
async function fetchCoinGeckoData(coinIds: string[]) {
  try {
    const response = await fetch(`${PROXY_API}?vs_currency=usd&ids=${coinIds.join(',')}&per_page=50&page=1`)
    
    if (!response.ok) throw new Error(`Proxy API error: ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('Error fetching CoinGecko data:', error)
    // Return mock data if API fails
    return coinIds.map((id, index) => ({
      id,
      symbol: id.substring(0, 3).toUpperCase(),
      name: id.charAt(0).toUpperCase() + id.slice(1),
      current_price: Math.random() * 1000 + 1,
      price_change_percentage_24h: (Math.random() - 0.5) * 20,
      price_change_percentage_1h_in_currency: (Math.random() - 0.5) * 10,
      price_change_percentage_7d_in_currency: (Math.random() - 0.5) * 30,
      total_volume: Math.random() * 1000000000,
      market_cap: Math.random() * 10000000000
    }))
  }
}

// Real-time whale monitor using CoinGecko API matching crypto-scanner logic
export function useWhaleMonitor() {
  return useQuery({
    queryKey: ['whaleMonitor'],
    queryFn: async () => {
      try {
        // Use the new whale-screen API endpoint that matches crypto-scanner exactly
        const response = await fetch('/api/whale-screen')
        if (!response.ok) {
          throw new Error(`Whale screen API error: ${response.status}`)
        }
        
        const data = await response.json()
        
        // Process the data exactly like crypto-scanner's whale-panel.js
        const signals = data.whales.map((whale: any) => {
          const change24h = whale.priceChange24h || 0
          const ratio = whale.volMcRatio || 0
          
          // Crypto-scanner whale activity logic
          let whaleActivity = '🟡 Neutral'
          if (ratio > 0.2 && change24h > 0) {
            whaleActivity = '🟢 Accumulation'
          } else if (ratio > 0.2 && change24h < 0) {
            whaleActivity = '🔴 Distribution'
          }
          
          // Map to our signal system
          let signal = 'WATCH'
          let label = 'Monitor'
          let color = '#eab308'
          
          if (whaleActivity === '🟢 Accumulation') {
            signal = 'BUY'
            label = 'Akumulasi Whale'
            color = '#22c55e'
          } else if (whaleActivity === '🔴 Distribution') {
            signal = 'SELL'
            label = 'Distribusi Whale'
            color = '#ef4444'
          }
          
          return {
            id: whale.id,
            symbol: whale.symbol.toUpperCase(),
            name: whale.name,
            ticker: whale.symbol.toUpperCase(),
            signal,
            label,
            score: Math.min(100, Math.max(30, Math.abs(change24h) * 3)),
            scoreMax: 100,
            h1: whale.priceChange24h || 0, // Use 24h change for h1 since we don't have 1h data
            h24: change24h,
            d7: whale.priceChange24h || 0, // Use 24h change for d7 since we don't have 7d data
            volMcap: ratio,
            tags: whale.signals || [],
            spike: Math.abs(change24h) > 10,
            color,
            whaleActivity, // Add the crypto-scanner activity status
            image: whale.image // Add coin image
          }
        })
        
        // Count signals for summary - calculate from actual signals
        const accumulation = signals.filter((s: any) => s.signal === 'BUY').length
        const distribution = signals.filter((s: any) => s.signal === 'SELL').length
        const neutral = signals.filter((s: any) => s.signal === 'WATCH').length
        
        return {
          accumulation,
          distribution,
          neutral,
          signals: signals.sort((a: any, b: any) => Math.abs(b.h24) - Math.abs(a.h24))
        }
        
      } catch (error) {
        console.error('Error in whale monitor:', error)
        // Return empty data structure on error
        return {
          accumulation: 0,
          distribution: 0,
          neutral: 0,
          signals: []
        }
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    staleTime: 10000 // Consider data stale after 10 seconds
  })
}

// Real-time coin scanner using CoinGecko API
export function useCoinScannerTable() {
  return useQuery({
    queryKey: ['coinScannerTable'],
    queryFn: async () => {
      try {
        const response = await fetch(`${PROXY_API}?vs_currency=usd&order=market_cap_desc&per_page=50&page=1`)
        if (!response.ok) throw new Error('Proxy API error')
        const data = await response.json()
        
        return data.map((coin: any, index: number) => ({
          id: coin.id,
          rank: index + 1,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          price: coin.current_price,
          age: 'N/A', // This would require additional API calls for coin age
          h1: coin.price_change_percentage_1h_in_currency || 0,
          h24: coin.price_change_percentage_24h_in_currency || 0,
          d7: coin.price_change_percentage_7d_in_currency || 0,
          volume: `$${(coin.total_volume / 1000000).toFixed(2)}M`,
          mcap: `$${(coin.market_cap / 1000000000).toFixed(2)}B`,
          liq: coin.total_volume > coin.market_cap * 0.1 ? 'High' : 'Low',
          signal: coin.price_change_percentage_24h_in_currency > 10 ? 'Breakout' :
                 coin.price_change_percentage_24h_in_currency < -5 ? 'Correction' : 'Consolidation',
          image: coin.image // Add coin logo URL
        }))
      } catch (error) {
        console.error('Error fetching coin scanner data:', error)
        // Return empty array on error
        return []
      }
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000,
  })
}

// Real-time sniper scanner matching crypto-scanner functionality
export function useSniperScanner() {
  return useQuery({
    queryKey: ['sniperScanner'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/crypto-scanner/sniper-scan?tf=1h&limit=100')
        if (!response.ok) throw new Error('Sniper scan API error')
        const data = await response.json()
        
        if (data.ok && data.coins) {
          return data.coins
        }
        
        return []
      } catch (error) {
        console.error('Error fetching sniper scanner data:', error)
        return []
      }
    },
    refetchInterval: 30000,
    staleTime: 10000
  })
}

// Signal bot for automated trading signals using real-time data from crypto-scanner
export function useSignalBot() {
  return useQuery({
    queryKey: ['signalBot'],
    queryFn: async () => {
      try {
        // Fetch real-time signals from crypto-scanner API
        const response = await fetch('/api/crypto-scanner/signals')
        if (!response.ok) throw new Error('Signal API error')
        const signals = await response.json()
        
        // Transform signals to match the expected format
        return signals.map((signal: any) => ({
          id: `signal-${signal.coinId}`,
          symbol: signal.coinSymbol.toUpperCase(),
          name: signal.coinName,
          signal: signal.signal,
          status: signal.htfAligned ? 'ACTIVE' : 'MONITOR',
          entryPrice: signal.entryHigh,
          targetPrice: signal.tp1,
          profitPct: 0,
          confidence: signal.confidence,
          h1: signal.priceChange24h,
          h24: signal.priceChange24h,
          d7: 0,
          volMcap: signal.volume24h / (signal.currentPrice * 1000000) // Approximate volume/mcap ratio
        }))
        
      } catch (error) {
        console.error('Error fetching signal bot data:', error)
        // Fallback to empty array
        return []
      }
    },
    refetchInterval: 30000,
    staleTime: 10000
  })
}