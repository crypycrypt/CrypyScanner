"use client"
import { motion } from 'framer-motion'

export default function ForegroundHUD(){
  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Floating hexagon / circuit node */}
      <motion.svg
        className="absolute left-8 top-12 w-24 h-24 opacity-90 floaty"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.9, scale: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
      >
        <path d="M5 60 C20 30, 80 30, 95 60 L95 70 C80 40, 20 40, 5 70 Z" fill="#00f0ff22" stroke="#00f0ff66" strokeWidth="1" />
      </motion.svg>

      {/* Floating circle / data node */}
      <motion.svg
        className="absolute right-12 top-24 w-28 h-28 opacity-80 floaty"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.8, scale: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
      >
        <circle cx="50" cy="50" r="30" fill="#00D08422" stroke="#00D08466" strokeWidth="1" />
      </motion.svg>

      {/* Floating diamond / signal node */}
      <motion.svg
        className="absolute left-1/2 top-16 w-16 h-16 opacity-70 floaty"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.7, scale: 1 }}
        transition={{ duration: 1, delay: 0.7 }}
      >
        <polygon points="50,5 95,50 50,95 5,50" fill="#a78bfa22" stroke="#a78bfa66" strokeWidth="1" />
      </motion.svg>

      {/* Floating triangle / alert node */}
      <motion.svg
        className="absolute right-8 bottom-32 w-20 h-20 opacity-60 floaty"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.6, scale: 1 }}
        transition={{ duration: 1, delay: 0.9 }}
      >
        <polygon points="50,8 92,92 8,92" fill="#fbbf2422" stroke="#fbbf2466" strokeWidth="1" />
      </motion.svg>

      {/* Glowing pulse dots */}
      <motion.div
        className="absolute left-1/3 top-1/3 w-2 h-2 rounded-full bg-neon"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0.8, 0], scale: [0, 1.5, 0] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
      />
      <motion.div
        className="absolute right-1/3 top-1/4 w-1.5 h-1.5 rounded-full bg-brand"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0.7, 0], scale: [0, 1.5, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.8 }}
      />
      <motion.div
        className="absolute left-2/3 bottom-1/3 w-2 h-2 rounded-full bg-neon"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0.6, 0], scale: [0, 1.5, 0] }}
        transition={{ duration: 3, repeat: Infinity, delay: 1.4 }}
      />

      {/* Subtle connecting line */}
      <motion.svg
        className="absolute left-1/4 top-1/2 w-48 h-0.5 opacity-30"
        viewBox="0 0 100 1"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.line
          x1="0" y1="0.5" x2="100" y2="0.5"
          stroke="#00f0ff"
          strokeWidth="0.5"
          strokeDasharray="2 2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, delay: 1 }}
        />
      </motion.svg>
    </div>
  )
}
