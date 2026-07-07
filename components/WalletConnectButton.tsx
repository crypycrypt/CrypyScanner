"use client"
import { useEffect, useState } from 'react'
import { ethers } from 'ethers'

export default function WalletConnectButton() {
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    checkConnected()
    // listen for account changes
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      ;(window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) setAddress(null)
        else setAddress(accounts[0])
      })
    }
  }, [])

  async function checkConnected() {
    if (typeof window === 'undefined' || !(window as any).ethereum) return
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const accounts = await provider.send('eth_accounts', [])
      if (accounts && accounts.length) setAddress(accounts[0])
    } catch (e) {
      console.debug('checkConnected', e)
    }
  }

  async function connect() {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      alert('No injected wallet found. Please install MetaMask or use a wallet that injects window.ethereum')
      return
    }
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const addr = await signer.getAddress()
      setAddress(addr)
    } catch (e) {
      console.error(e)
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

  const shortened = `${address.slice(0,6)}...${address.slice(-4)}`
  return (
    <div className="flex items-center gap-2">
      <span className="px-3 py-1 bg-[rgba(255,255,255,0.03)] rounded-md">{shortened}</span>
      <button onClick={disconnect} className="btn-theme btn-theme-sm">Disconnect</button>
    </div>
  )
}
