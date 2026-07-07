import '../styles/globals.css'
import { ReactNode } from 'react'
import Navbar from '../components/Navbar'

export const metadata = {
  title: 'WhaleRadar AI',
  description: 'AI-powered Web3 analytics platform'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,600;0,800;1,400&family=Press+Start+2P&display=swap" rel="stylesheet" />
      </head>
  <body className="bg-[#05060a] text-white antialiased font-ui">
          <div className="min-h-screen bg-gradient-to-b from-[#020214] to-[#071025]">
            <Navbar />
            <main className="max-w-6xl mx-auto px-6 py-6">
              {children}
            </main>
          </div>
      </body>
    </html>
  )
}
