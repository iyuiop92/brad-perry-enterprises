'use client'
import { useState, useEffect, useRef } from 'react'

const phases = [
  {
    id: 'discover',
    name: 'Discover & Research',
    duration: '1-2 weeks',
    description: 'Deep market analysis to identify profitable opportunities and understand your target audience.',
    deliverables: ['Market Analysis Report', 'Competitor Research', 'Opportunity Matrix', 'Target Audience Profiles'],
    tools: ['SEMrush', 'Ahrefs', 'Google Analytics', 'Hotjar'],
  },
  {
    id: 'design',
    name: 'Design & Strategy',
    duration: '2-3 weeks',
    description: 'Create user-centered designs that maximize conversions and deliver exceptional experiences.',
    deliverables: ['Brand Guidelines', 'Wireframes', 'UI/UX Mockups', 'Content Strategy'],
    tools: ['Vercel', 'Supabase', 'Maze', 'UserTesting'],
  },
  {
    id: 'build',
    name: 'Develop & Launch',
    duration: '3-4 weeks',
    description: 'Build high-performance, scalable solutions optimized for speed and conversions.',
    deliverables: ['Production-ready Application', 'SEO Setup', 'Analytics Integration', 'Performance Report'],
    tools: ['Next.js', 'Vercel', 'Supabase', 'Cloudflare'],
  },
  {
    id: 'scale',
    name: 'Scale & Optimize',
    duration: 'Ongoing',
    description: 'Continuous optimization using data-driven insights to maximize revenue and growth.',
    deliverables: ['Monthly Analytics Reports', 'A/B Test Results', 'Revenue Growth Plan', 'Technical Upgrades'],
    tools: ['Google Analytics', 'Hotjar', 'Stripe', 'Vercel Analytics'],
  },
]

export default function HowWeBuild() {
  const [open, setOpen] = useState<string>('discover')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activePhase = phases.find(p => p.id === open)

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setOpen(prev => {
        const idx = phases.findIndex(p => p.id === prev)
        return phases[(idx + 1) % phases.length].id
      })
    }, 5000)
  }

  useEffect(() => {
    startTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  return (
    <section id="about" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-[800] text-4xl md:text-5xl text-white text-center mb-4">
          How We Build Success
        </h2>
        <p className="text-[#475569] text-center mb-4 max-w-lg mx-auto text-sm leading-relaxed">
          Experience my proven methodology through an interactive process walkthrough.
        </p>
        <div className="flex justify-center mb-12">
          <button className="flex items-center gap-2 text-[#64748b] text-sm border border-[rgba(0,180,255,0.15)] px-5 py-2.5 rounded-lg hover:border-[rgba(0,180,255,0.35)] hover:text-[#94a3b8] transition-all">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
            </svg>
            See Process in Action
          </button>
        </div>

        <div className="grid md:grid-cols-[260px_1fr] gap-5">
          <div className="flex flex-col gap-2">
            {phases.map(phase => (
              <button
                key={phase.id}
                onClick={() => { setOpen(phase.id); startTimer() }}
                className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                  open === phase.id
                    ? 'bg-[rgba(0,180,255,0.07)] border-[rgba(0,180,255,0.25)] text-white'
                    : 'border-[rgba(0,180,255,0.06)] text-[#475569] hover:text-[#64748b] hover:border-[rgba(0,180,255,0.12)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-[600] text-sm">{phase.name}</span>
                  <svg
                    width="13"
                    height="13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    className="flex-shrink-0 opacity-60"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={open === phase.id ? 'M19 9l-7 7-7-7' : 'M9 5l7 7-7 7'}
                    />
                  </svg>
                </div>
                <span className="text-[10px] text-[#334155] mt-0.5 block">{phase.duration}</span>
              </button>
            ))}
          </div>

          {activePhase && (
            <div className="rounded-2xl border border-[rgba(0,180,255,0.15)] bg-[#0d0d1a] p-6">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-[rgba(0,180,255,0.1)] flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" fill="none" stroke="#00b4ff" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
                  </svg>
                </div>
                <div>
                  <div className="text-white font-[700] text-base">{activePhase.name}</div>
                  <div className="text-[#334155] text-xs">{activePhase.duration}</div>
                </div>
              </div>
              <p className="text-[#475569] text-sm mb-6 leading-relaxed">{activePhase.description}</p>

              <div className="mb-5">
                <div className="text-[#64748b] font-[700] text-[10px] uppercase tracking-widest mb-3">
                  Key Deliverables
                </div>
                <div className="flex flex-col gap-2">
                  {activePhase.deliverables.map(d => (
                    <div key={d} className="flex items-center gap-2 text-sm text-[#64748b]">
                      <svg width="12" height="12" fill="none" stroke="#00b4ff" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
                      </svg>
                      {d}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[#64748b] font-[700] text-[10px] uppercase tracking-widest mb-3">
                  Tools & Technologies
                </div>
                <div className="flex flex-wrap gap-2">
                  {activePhase.tools.map(tool => (
                    <span
                      key={tool}
                      className="text-xs text-[#475569] border border-[rgba(0,180,255,0.1)] px-3 py-1 rounded-full"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-16 text-center">
          <div className="text-white font-[800] text-2xl mb-2">Ready to leverage this expertise?</div>
          <p className="text-[#475569] text-sm mb-6">
            Let's discuss how these skills can drive your next project to success.
          </p>
          <a
            href="#contact"
            className="inline-flex items-center justify-center gap-2 border border-[rgba(255,255,255,0.12)] text-white font-[600] px-8 py-3.5 rounded-lg text-sm hover:bg-white hover:text-[#04040a] transition-all duration-200 w-full max-w-xs"
          >
            Start Your Project <span>&#8594;</span>
          </a>
        </div>
      </div>
    </section>
  )
}
