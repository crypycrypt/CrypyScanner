"use client"
import { motion } from 'framer-motion'

export default function HeroCard(){
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[rgba(255,255,255,0.03)] rounded-2xl p-6 backdrop-blur-xs border border-[rgba(255,255,255,0.04)]">
      <h3 className="text-xl font-semibold text-neon">AI Crypto Copilot</h3>
      <p className="text-slate-400">Ask natural language questions about wallets, tokens and whale activity. Floating copilot UI will appear across the app.</p>
    </motion.div>
  )
}
