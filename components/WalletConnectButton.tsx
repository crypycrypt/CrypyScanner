"use client"
import { useEffect, useState } from 'react'

export default function WalletConnectButton() {
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    // Use eth_accounts (read-only, no MetaMask popup) to check if already connected
    checkConnected()
    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null
    if (!eth) return
    const handler = (accounts: string[]) => {
      setAddress(accounts.length > 0 ? accounts[0] : null)
    }
    eth.on('accountsChanged', handler)
    return () => {
      try { eth.removeListener?.('accountsChanged', handler) } catch { /* ignore */ }
    }
  }, [])

  async function checkConnected() {
    try {
      const eth = typeof window !== 'undefined' ? (window as any).ethereum : null
      if (!eth) return
      // eth_accounts does NOT trigger MetaMask popup — safe to call silently
      const accounts: string[] = await eth.request({ method: 'eth_accounts' })
      if (accounts?.length > 0) setAddress(accounts[0])
    } catch {
      // wallet not ready — do nothing, no overlay
    }
  }

  async function connect() {
    try {
      const eth = typeof window !== 'undefined' ? (window as any).ethereum : null
      if (!eth) {
        alert('No Web3 wallet found. Please install MetaMask or another browser wallet.')
        return
      }
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' })
      if (accounts?.length > 0) setAddress(accounts[0])
    } catch (e: any) {
      if (e?.code === 4001) return // user rejected — silent
      console.error('Wallet connect error:', e?.message ?? e)
    }
  }

  function disconnect() {
    setAddress(null)
  }

  if (!address) {
    return (
      <button onClick={connect} className="btn-theme btn-theme-sm">Connect Wallet</button>
    )
  }

  const shortened = `${address.slice(0, 6)}...${address.slice(-4)}`
  return (
    <div className="flex items-center gap-2">
      <span className="px-3 py-1 bg-[rgba(255,255,255,0.04)] rounded-md text-sm font-mono">{shortened}</span>
      <button onClick={disconnect} className="btn-theme btn-theme-sm">Disconnect</button>
    </div>
  )
}
