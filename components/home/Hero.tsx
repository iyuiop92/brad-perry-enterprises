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
    <section className="relative min-h-screen flex items-center justify-center text-center overflow-hidden bg-[#04040a]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="relative z-10 px-6 max-w-4xl pt-16">
        <h1 className="font-[800] text-5xl md:text-7xl lg:text-8xl text-white leading-[1.05] mb-6 tracking-tight">
          Web designer{' '}
          <span className="text-[#00b4ff]">+</span>{' '}
          operator
          <br />
          of profitable niche sites
        </h1>
        <p className="text-[#64748b] text-lg md:text-xl max-w-lg mx-auto mb-10 leading-relaxed">
          Building high-converting affiliate networks that generate consistent revenue
          through expert design and strategic optimization.
        </p>
        <div className="flex items-center justify-center gap-5 flex-wrap">
          <a
            href="#contact"
            className="inline-flex items-center gap-2 bg-white text-[#04040a] font-[700] px-7 py-3.5 rounded-lg text-sm hover:bg-[#00b4ff] hover:text-white transition-all duration-200"
          >
            Work with me <span className="text-base font-[800]">+</span>
          </a>
          <a
            href="#network"
            className="inline-flex items-center gap-1.5 text-white text-sm font-[600] hover:text-[#00b4ff] transition-colors"
          >
            See the network <span>&#8594;</span>
          </a>
        </div>
      </div>
    </section>
  )
}
