"use client"
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Donation wallet (Solana). Can be overridden via NEXT_PUBLIC_DONATION_WALLET env.
const DONATION_WALLET =
  process.env.NEXT_PUBLIC_DONATION_WALLET || 'FC8xKNeiDuSrJrmw3TFdZSfNFWJemCk5QnhXgM2zkKcD'

const EXPLORER_URL = `https://solscan.io/account/${DONATION_WALLET}`

function buildQrUrl(address: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(address)}`
}

export default function DonationButton() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    }
  }, [])

  async function copyAddress() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(DONATION_WALLET)
      } else {
        // Fallback for non-secure contexts
        const ta = document.createElement('textarea')
        ta.value = DONATION_WALLET
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Copy failed:', e)
    }
  }

  const modal = open ? (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="landing-card w-full max-w-sm rounded-2xl p-6 text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white text-lg leading-none"
              aria-label="Close"
            >
              ✕
            </button>

            <h3 className="text-xl font-bold text-neon mb-1">💝 Support This Project</h3>
            <p className="text-xs text-slate-400 mb-5">
              Scan the QR code or copy the address to send a donation (SOL / Solana tokens).
            </p>

            {/* QR Code */}
            <div className="bg-white rounded-xl p-3 inline-block mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={buildQrUrl(DONATION_WALLET)}
                alt="Donation wallet QR code"
                width={220}
                height={220}
                className="rounded"
              />
            </div>

            {/* Address */}
            <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg p-3 mb-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 text-left">
                Solana Wallet Address
              </div>
              <div className="font-mono text-xs text-slate-200 break-all text-left leading-relaxed">
                {DONATION_WALLET}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copyAddress}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  copied
                    ? 'bg-green-600/30 text-green-400 border border-green-500/40'
                    : 'bg-[rgba(99,102,241,0.15)] text-indigo-400 border border-[rgba(99,102,241,0.3)] hover:bg-[rgba(99,102,241,0.25)]'
                }`}
              >
                {copied ? '✓ Copied!' : '📋 Copy Address'}
              </button>
              <a
                href={EXPLORER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-[rgba(255,255,255,0.06)] text-slate-300 border border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.12)] transition-colors text-center"
              >
                🔗 Solscan
              </a>
            </div>
          </div>
        </div>
  ) : null

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-wrapper" aria-label="Support this project with a donation">
        <div className="btn-light" />
        <div className="gradient-layer" style={{ animationDelay: '0s', animationDuration: '25s' }} />
        <div className="gradient-layer" style={{ animationDelay: '0.15s', animationDuration: '15.9s' }} />
        <div className="gradient-layer" style={{ animationDelay: '0.53s', animationDuration: '26.4s' }} />
        <div className="gradient-layer" style={{ animationDelay: '0.45s', animationDuration: '17.8s' }} />
        <div className="gradient-layer" style={{ animationDelay: '1.6s', animationDuration: '19.2s' }} />
        <span className="btn-icon">💝</span>
        <span className="gradient-btn">Donation</span>
        <span className="text-overlay">Donation</span>
      </button>

      {modal && typeof document !== 'undefined'
        ? createPortal(modal, document.body)
        : null}
    </>
  )
}
