'use client'
import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
}

export default function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let particles: Particle[] = []

    function resize() {
      if (!canvas) return
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    function init() {
      if (!canvas) return
      particles = Array.from({ length: 90 }, () => ({
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 1.5 + 0.4,
        opacity: Math.random() * 0.5 + 0.15,
      }))
    }

    function draw() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(0,180,255,${0.05 * (1 - dist / 120)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${p.opacity})`
        ctx.fill()
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    init()
    draw()

    const handleResize = () => { resize(); init() }
    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden bg-[#04040a]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Top identity bar */}
      <div className="relative z-10 pt-8 px-8 md:px-14 flex items-center justify-between">
        <span className="text-white text-[10px] font-[600] tracking-[0.3em] uppercase">
          Brad Perry
        </span>
        <span className="text-white text-[10px] font-[600] tracking-[0.2em] uppercase">
          Est. 2012
        </span>
      </div>

      {/* Main content anchored to bottom */}
      <div className="relative z-10 flex-1 flex flex-col justify-end px-8 md:px-14 pb-16 pt-24">

        {/* Overline */}
        <div className="flex items-center gap-3 mb-7">
          <span className="w-5 h-px bg-[#00b4ff]" style={{ opacity: 0.7 }} />
          <span className="text-[#00b4ff] text-[10px] font-[600] tracking-[0.3em] uppercase">
            Web Designer &amp; Digital Operator
          </span>
        </div>

        {/* Headline */}
        <h1
          className="font-[800] leading-[0.9] tracking-tight text-white mb-10"
          style={{ fontSize: 'clamp(2.8rem, 9vw, 8rem)' }}
        >
          Building<br />
          <span style={{ color: '#00b4ff' }}>profitable</span><br />
          digital<br />
          businesses.
        </h1>

        {/* Bottom row: description + CTAs left, stats right */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-10 border-t border-[rgba(255,255,255,0.04)] pt-8">

          <div className="max-w-sm">
            <p className="text-white text-sm leading-relaxed mb-6">
              Affiliate networks, SaaS platforms, and client sites
              engineered for consistent revenue — not just good-looking.
            </p>
            <div className="flex items-center gap-5 flex-wrap">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 bg-white text-[#04040a] font-[700] px-6 py-3 rounded-lg text-sm hover:bg-[#00b4ff] hover:text-white transition-all duration-200"
              >
                Work with me <span className="text-base font-[800]">+</span>
              </a>
              <a
                href="#network"
                className="text-sm font-[600] text-white hover:text-white transition-colors"
              >
                See the network &#8594;
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-end gap-10 md:gap-14 shrink-0">
            <div>
              <div className="font-[800] text-white tabular-nums" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                400+
              </div>
              <div className="text-white text-[9px] font-[600] tracking-[0.2em] uppercase mt-1">Projects</div>
            </div>
            <div>
              <div className="font-[800] text-white tabular-nums" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                12+
              </div>
              <div className="text-white text-[9px] font-[600] tracking-[0.2em] uppercase mt-1">Years</div>
            </div>
            <div>
              <div className="font-[800] text-white tabular-nums" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                145K
              </div>
              <div className="text-white text-[9px] font-[600] tracking-[0.2em] uppercase mt-1">Monthly visits</div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
