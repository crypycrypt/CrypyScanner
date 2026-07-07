"use client"
import { ReactNode } from 'react'
import '@rainbow-me/rainbowkit/styles.css'
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit'
// Use dynamic imports to avoid TypeScript export mismatch between installed packages
const wagmi: any = require('wagmi')
const publicProvider: any = require('wagmi/providers/public').publicProvider
const { mainnet, sepolia }: any = require('viem/chains')

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

const { configureChains, createConfig, WagmiConfig } = wagmi

const { chains, publicClient } = configureChains([mainnet, sepolia], [publicProvider()])

const { connectors } = getDefaultWallets({
  appName: 'WhaleRadar AI',
  projectId,
  chains,
})

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: connectors(),
  publicClient,
})

export function WagmiProvider({ children }: { children: ReactNode }) {
  return (
    // @ts-ignore - runtime wiring uses dynamic requires due to package type mismatches
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>{children}</RainbowKitProvider>
    </WagmiConfig>
  )
}
