'use client'
import { useEffect, useRef } from 'react'

const COLORS = [
  '#00b4ff', '#8b5cf6', '#c17f3c', '#f97316',
  '#ef4444', '#22c55e', '#10b981', '#f59e0b', '#38bdf8',
]

interface Particle {
  x: number; y: number
  vx: number; vy: number
  r: number; opacity: number
  color: string
}

export default function ParticleField() {
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
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }

    function init() {
      if (!canvas) return
      particles = Array.from({ length: 70 }, () => ({
        x:       Math.random() * canvas!.width,
        y:       Math.random() * canvas!.height,
        vx:      (Math.random() - 0.5) * 0.18,
        vy:      (Math.random() - 0.5) * 0.18,
        r:       Math.random() * 1.2 + 0.4,
        opacity: Math.random() * 0.12 + 0.04,
        color:   COLORS[Math.floor(Math.random() * COLORS.length)],
      }))
    }

    function draw() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.opacity
        ctx.fill()
      }
      ctx.globalAlpha = 1
      animId = requestAnimationFrame(draw)
    }

    resize()
    init()
    draw()
    window.addEventListener('resize', () => { resize(); init() })
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', () => { resize(); init() })
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
