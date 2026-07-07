"use client"
import { motion } from 'framer-motion'

export default function ForegroundHUD(){
  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <svg className="absolute left-8 top-12 w-24 h-24 opacity-90 floaty" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 60 C20 30, 80 30, 95 60 L95 70 C80 40, 20 40, 5 70 Z" fill="#00f0ff22" stroke="#00f0ff66" strokeWidth="1" />
      </svg>
      <svg className="absolute right-12 top-24 w-28 h-28 opacity-80 floaty" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="30" fill="#00D08422" stroke="#00D08466" strokeWidth="1" />
      </svg>
      <div className="absolute left-1/2 top-6 -translate-x-1/2 px-3 py-1 bg-[rgba(0,0,0,0.36)] rounded-md text-xs text-slate-200 border border-[rgba(255,255,255,0.03)]">NEON HUD • Live Scanning</div>
    </div>
  )
}
