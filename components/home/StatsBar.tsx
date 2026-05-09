'use client'
import { useEffect, useRef, useState } from 'react'

const stats = [
  { value: 400, suffix: '+', label: 'Projects Completed' },
  { value: 12, suffix: '+', label: 'Years Experience' },
  { value: 95, suffix: '%', label: 'Client Satisfaction' },
  { value: 24, suffix: '/7', label: 'System Uptime' },
]

function Counter({ value, suffix }: { value: number; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          let current = 0
          const step = value / 40
          const timer = setInterval(() => {
            current += step
            if (current >= value) {
              setCount(value)
              clearInterval(timer)
            } else {
              setCount(Math.floor(current))
            }
          }, 28)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [value])

  return (
    <div ref={ref} className="font-[800] text-4xl md:text-5xl text-white">
      {count}
      {suffix}
    </div>
  )
}

export default function StatsBar() {
  return (
    <section className="py-16 px-6 border-y border-[rgba(0,180,255,0.07)]">
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {stats.map(stat => (
          <div key={stat.label}>
            <Counter value={stat.value} suffix={stat.suffix} />
            <div className="text-[#475569] text-sm mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
