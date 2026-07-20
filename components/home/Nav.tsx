'use client'
import { useState } from 'react'

export default function Nav() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#04040a]/80 backdrop-blur-md border-b border-[rgba(0,180,255,0.08)]">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
        <span className="font-[800] text-white text-sm tracking-wide">Brad Perry Enterprises</span>
        <div className="hidden md:flex items-center gap-8 text-sm text-white">
          <a href="#work" className="hover:text-white transition-colors">Work</a>
          <a href="#services" className="hover:text-white transition-colors">Services</a>
          <a
            href="https://aetherhockey.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            AetherHockey
          </a>
          <a href="#about" className="hover:text-white transition-colors">About</a>
          <a href="#contact" className="hover:text-[#00b4ff] transition-colors font-[600]">Contact</a>
        </div>
        <button
          className="md:hidden text-white hover:text-white transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {open
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-[#04040a] border-t border-[rgba(0,180,255,0.08)] px-6 py-5 flex flex-col gap-4 text-sm text-white">
          <a href="#work" onClick={() => setOpen(false)} className="hover:text-white transition-colors">Work</a>
          <a href="#services" onClick={() => setOpen(false)} className="hover:text-white transition-colors">Services</a>
          <a href="https://aetherhockey.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">AetherHockey</a>
          <a href="#about" onClick={() => setOpen(false)} className="hover:text-white transition-colors">About</a>
          <a href="#contact" onClick={() => setOpen(false)} className="hover:text-[#00b4ff] font-[600] transition-colors">Contact</a>
        </div>
      )}
    </nav>
  )
}
