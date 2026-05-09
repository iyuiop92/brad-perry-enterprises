'use client'
import { useState } from 'react'

const projectTypes = [
  {
    id: 'affiliate',
    label: 'Affiliate Network',
    desc: 'Revenue-generating affiliate site',
    icon: (
      <svg width="20" height="20" fill="none" stroke="#00b4ff" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="9" cy="5" r="2" /><circle cx="15" cy="19" r="2" /><circle cx="19" cy="9" r="2" />
        <path strokeLinecap="round" d="M9 7v3M15 17v-3M17 10l-5 4" />
      </svg>
    ),
  },
  {
    id: 'ecommerce',
    label: 'E-commerce Platform',
    desc: 'Full-featured online store',
    icon: (
      <svg width="20" height="20" fill="none" stroke="#00b4ff" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="1" y="2" width="22" height="20" rx="2" />
        <path strokeLinecap="round" d="M1 10h22M8 2v8M16 2v8" />
      </svg>
    ),
  },
  {
    id: 'webapp',
    label: 'Web Application',
    desc: 'Custom web application',
    icon: (
      <svg width="20" height="20" fill="none" stroke="#00b4ff" strokeWidth="1.5" viewBox="0 0 24 24">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    id: 'strategy',
    label: 'Strategy Consultation',
    desc: 'Growth & optimization planning',
    icon: (
      <svg width="20" height="20" fill="none" stroke="#00b4ff" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
      </svg>
    ),
  },
]

const estimates: Record<string, string> = {
  affiliate: 'Affiliate Network projects typically run $2,500–$7,500 depending on niche complexity and content scope.',
  ecommerce: 'E-commerce Platform builds typically run $4,000–$12,000 depending on catalog size and custom features.',
  webapp: 'Web Application projects typically run $5,000–$15,000 depending on feature set and integrations.',
  strategy: 'Strategy Consultations start at $500 for a focused session up to $2,500 for a full growth plan.',
}

export default function ContactForm() {
  const [selected, setSelected] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', budget: '', timeline: '', description: '' })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSent(true)
  }

  return (
    <section id="contact" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-[800] text-4xl md:text-5xl text-white text-center mb-3">
          Let's Build Something Profitable
        </h2>
        <p className="text-[#475569] text-center mb-12 text-sm">
          Get a custom project estimate in real-time
        </p>

        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <div className="text-white font-[700] text-sm mb-5">What are you looking to build?</div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {projectTypes.map(pt => (
                <button
                  key={pt.id}
                  onClick={() => setSelected(pt.id === selected ? null : pt.id)}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                    selected === pt.id
                      ? 'border-[rgba(0,180,255,0.4)] bg-[rgba(0,180,255,0.07)]'
                      : 'border-[rgba(0,180,255,0.1)] bg-[#0d0d1a] hover:border-[rgba(0,180,255,0.2)]'
                  }`}
                >
                  <div className="mb-2">{pt.icon}</div>
                  <div className="text-white font-[600] text-xs mb-0.5">{pt.label}</div>
                  <div className="text-[#334155] text-[10px] leading-tight">{pt.desc}</div>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-[rgba(0,180,255,0.1)] bg-[#0d0d1a] p-5">
              <div className="flex items-center gap-2.5 mb-2">
                <svg width="16" height="16" fill="none" stroke="#00b4ff" strokeWidth="1.5" viewBox="0 0 24 24">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span className="text-white font-[700] text-sm">Get Instant Estimate</span>
              </div>
              <p className="text-[#475569] text-xs leading-relaxed">
                {selected
                  ? estimates[selected]
                  : "Select a project type to see timeline, investment, and what's included."}
              </p>
              {selected && (
                <p className="text-[#334155] text-[10px] mt-2">
                  All estimates include strategy, design, development, and optimization
                </p>
              )}
            </div>
          </div>

          <div>
            {sent ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-[rgba(0,180,255,0.12)] border border-[rgba(0,180,255,0.3)] flex items-center justify-center mb-4">
                  <svg width="20" height="20" fill="none" stroke="#00b4ff" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                  </svg>
                </div>
                <div className="text-white font-[700] text-xl mb-2">Brief received!</div>
                <p className="text-[#475569] text-sm">I'll review and get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="text-white font-[700] text-sm mb-1">Project Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#475569] text-xs block mb-1.5">Name</label>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-[#0d0d1a] border border-[rgba(0,180,255,0.1)] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-[#1e293b] focus:outline-none focus:border-[rgba(0,180,255,0.35)]"
                    />
                  </div>
                  <div>
                    <label className="text-[#475569] text-xs block mb-1.5">Email</label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full bg-[#0d0d1a] border border-[rgba(0,180,255,0.1)] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-[#1e293b] focus:outline-none focus:border-[rgba(0,180,255,0.35)]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#475569] text-xs block mb-1.5">Budget Range</label>
                    <select
                      value={form.budget}
                      onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                      className="w-full bg-[#0d0d1a] border border-[rgba(0,180,255,0.1)] rounded-lg px-3 py-2.5 text-[#64748b] text-sm focus:outline-none focus:border-[rgba(0,180,255,0.35)]"
                    >
                      <option value="">Select budget</option>
                      <option>Under $2,500</option>
                      <option>$2,500 – $5,000</option>
                      <option>$5,000 – $10,000</option>
                      <option>$10,000+</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[#475569] text-xs block mb-1.5">Timeline</label>
                    <select
                      value={form.timeline}
                      onChange={e => setForm(f => ({ ...f, timeline: e.target.value }))}
                      className="w-full bg-[#0d0d1a] border border-[rgba(0,180,255,0.1)] rounded-lg px-3 py-2.5 text-[#64748b] text-sm focus:outline-none focus:border-[rgba(0,180,255,0.35)]"
                    >
                      <option value="">Select timeline</option>
                      <option>ASAP (1–2 weeks)</option>
                      <option>1 month</option>
                      <option>2–3 months</option>
                      <option>Flexible</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[#475569] text-xs block mb-1.5">Project Description</label>
                  <textarea
                    rows={4}
                    placeholder="Tell me about your vision, goals, and any specific requirements..."
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-[#0d0d1a] border border-[rgba(0,180,255,0.1)] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-[#1e293b] focus:outline-none focus:border-[rgba(0,180,255,0.35)] resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 bg-white text-[#04040a] font-[700] py-3.5 rounded-lg text-sm hover:bg-[#00b4ff] hover:text-white transition-all duration-200"
                >
                  Send Project Brief
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
