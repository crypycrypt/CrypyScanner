"use client"
import { ReactNode } from 'react'

export default function Modal({ open, onClose, children, title }:{open:boolean, onClose:()=>void, children:ReactNode, title?:string}){
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl p-6 bg-[#060713] border border-[rgba(255,255,255,0.04)] rounded-xl">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="btn-theme btn-theme-sm">Close</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}
