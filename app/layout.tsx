import '../styles/globals.css'
import { ReactNode } from 'react'
import { Inter, Press_Start_2P } from 'next/font/google'
import Navbar from '../components/Navbar'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const pressStart = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-game', display: 'swap' })

export const metadata = { title: 'WhaleRadar AI', description: 'AI-powered crypto analytics' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${pressStart.variable}`}>
      <body className="bg-[#0b1220] text-white antialiased font-ui min-h-screen">
        <div className="min-h-screen bg-gradient-to-b from-[#0b1220] to-[#0f172a]">
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

