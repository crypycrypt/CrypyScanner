"use client"
import { useQuery } from '@tanstack/react-query'

function sleep(ms: number){ return new Promise(r=> setTimeout(r, ms)) }

export function useWhaleAlerts(){
  return useQuery({
    queryKey: ['whaleAlerts'],
    queryFn: async ()=>{
      await sleep(700)
      return [
        {id:1, wallet: '0xAbc...123', token: '$AI', volume: '1.2M', confidence: 78},
        {id:2, wallet: '0xDef...456', token: '$MEGA', volume: '400k', confidence: 64}
      ]
    }
  })
}

export function useCoinScanner(){
  return useQuery({
    queryKey: ['coinScanner'],
    queryFn: async ()=>{
      await sleep(600)
      return [
        {id: 'ai', symbol: 'AI', price: 0.12, change24: 12.4, rsi: 68},
        {id: 'mega', symbol: 'MEGA', price: 0.0032, change24: -4.2, rsi: 44}
      ]
    }
  })
}

export function useAISignals(){
  return useQuery({
    queryKey: ['aiSignals'],
    queryFn: async ()=>{
      await sleep(500)
      return [
        {id: 's1', type: 'BUY', token: 'AI', confidence: 78, reason: 'Accumulation + volume surge'},
        {id: 's2', type: 'WATCH', token: 'MEGA', confidence: 44, reason: 'High volatility'}
      ]
    }
  })
}

export function useCryptoScans(){
  return useQuery({
    queryKey: ['cryptoScans'],
    queryFn: async ()=>{
      await sleep(500)
      return [
        {id: 'cs1', name: 'HollowCat Scan', desc: 'Finds large transfers flagged by HollowCat', status: 'Active', matches: 3, last: '2m ago', color: '#6EE7B7'},
        {id: 'cs2', name: 'Sniper Scanner', desc: 'Detects likely sniper bots and buys at launch', status: 'Watching', matches: 1, last: '8m ago', color: '#60A5FA'},
        {id: 'cs3', name: 'Smart Money', desc: 'Tracks wallets with smart-money behaviors', status: 'Active', matches: 5, last: '1m ago', color: '#FDE68A'},
        {id: 'cs4', name: 'Crypto Scanner', desc: 'Generic pattern scanner: rug checks, liquidity pulls', status: 'Idle', matches: 0, last: '1h ago', color: '#FCA5A5'},
      ]
    }
  })
}
