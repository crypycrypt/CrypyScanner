"use client"
import { ReactNode } from 'react'
import { motion } from 'framer-motion'

export default function AnimatedCard({ children }: { children: ReactNode }){
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="card-glass p-4 rounded-xl">
      {children}
    </motion.div>
  )
}
