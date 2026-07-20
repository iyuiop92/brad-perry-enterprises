'use client'
import { useState, useEffect, useRef } from 'react'

type Tab = 'development' | 'design' | 'strategy' | 'ai'

interface Skill {
  name: string
  level: number
  type: string
  years: number
  projects: number | null
  description: string
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'development', label: 'Development' },
  { id: 'design', label: 'Design' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'ai', label: 'AI & Automation' },
]

const skillsData: Record<Tab, { title: string; skills: Skill[] }> = {
  development: {
    title: 'Development Mastery',
    skills: [
      { name: 'React/Next.js', level: 95, type: 'Frontend', years: 4, projects: null, description: 'Expert in building scalable React applications with modern frameworks' },
      { name: 'Node.js/Express', level: 88, type: 'Backend', years: 4, projects: 10, description: 'Building robust APIs and server-side solutions' },
      { name: 'TypeScript', level: 92, type: 'Language', years: 5, projects: 38, description: 'Type-safe development for large-scale applications' },
      { name: 'Mobile Development', level: 82, type: 'Mobile', years: 4, projects: 18, description: 'React Native and Progressive Web Apps' },
    ],
  },
  design: {
    title: 'Design Mastery',
    skills: [
      { name: 'UI/UX Design', level: 90, type: 'Interface', years: 6, projects: 60, description: 'Creating intuitive user experiences that convert' },
      { name: 'Vercel', level: 88, type: 'Tooling', years: 4, projects: 45, description: 'Deploying and scaling production apps with zero-config infrastructure' },
      { name: 'Brand Identity', level: 85, type: 'Branding', years: 8, projects: 30, description: 'Building memorable brands that stand out in their market' },
      { name: 'Motion Design', level: 75, type: 'Animation', years: 3, projects: 20, description: 'Purposeful micro-interactions and page transitions' },
    ],
  },
  strategy: {
    title: 'Strategy Mastery',
    skills: [
      { name: 'SEO & Content', level: 92, type: 'Growth', years: 8, projects: 50, description: 'Driving organic traffic through strategic content positioning' },
      { name: 'Conversion Rate Optimization', level: 88, type: 'Revenue', years: 6, projects: 40, description: 'Turning traffic into revenue with data-driven testing' },
      { name: 'Affiliate Strategy', level: 95, type: 'Monetization', years: 7, projects: 12, description: 'Building profitable affiliate network architectures' },
      { name: 'Business Development', level: 85, type: 'Growth', years: 10, projects: null, description: 'Identifying and capturing market opportunities' },
    ],
  },
  ai: {
    title: 'AI & Automation Mastery',
    skills: [
      { name: 'LLM Integration', level: 90, type: 'AI', years: 2, projects: 15, description: 'Building production AI applications with Claude, GPT, and open models' },
      { name: 'n8n & Automation', level: 88, type: 'Automation', years: 3, projects: 25, description: 'Workflow automation reducing manual tasks by 80%' },
      { name: 'AI Content Systems', level: 85, type: 'Content', years: 2, projects: 8, description: 'Scalable content pipelines powered by AI' },
      { name: 'Vector Search', level: 80, type: 'Data', years: 1, projects: 5, description: 'Semantic search and RAG architectures with Qdrant' },
    ],
  },
}

function RadarChart({ skills }: { skills: Skill[] }) {
  const cx = 80
  const cy = 80
  const maxR = 58

  const angles = skills.map((_, i) => (i / skills.length) * Math.PI * 2 - Math.PI / 2)

  const dataPoints = skills.map((s, i) => ({
    x: cx + (s.level / 100) * maxR * Math.cos(angles[i]),
    y: cy + (s.level / 100) * maxR * Math.sin(angles[i]),
  }))

  const polygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  const gridLevels = [0.25, 0.5, 0.75, 1]

  return (
    <svg viewBox="0 0 160 160" className="w-44 h-44">
      {gridLevels.map(level => {
        const pts = skills
          .map((_, i) => {
            const r = level * maxR
            return `${cx + r * Math.cos(angles[i])},${cy + r * Math.sin(angles[i])}`
          })
          .join(' ')
        return (
          <polygon
            key={level}
            points={pts}
            fill="none"
            stroke="rgba(0,180,255,0.1)"
            strokeWidth="1"
          />
        )
      })}

      {skills.map((_, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + maxR * Math.cos(angles[i])}
          y2={cy + maxR * Math.sin(angles[i])}
          stroke="rgba(0,180,255,0.1)"
          strokeWidth="1"
        />
      ))}

      <polygon points={polygon} fill="rgba(0,180,255,0.12)" stroke="#00b4ff" strokeWidth="1.5" />

      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#00b4ff" />
      ))}

      {skills.map((s, i) => {
        const r = maxR + 16
        const x = cx + r * Math.cos(angles[i])
        const y = cy + r * Math.sin(angles[i])
        const anchor =
          Math.abs(Math.cos(angles[i])) < 0.15
            ? 'middle'
            : Math.cos(angles[i]) > 0
            ? 'start'
            : 'end'
        const shortName = s.name.split('/')[0].split(' ')[0]
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor={anchor}
            dy="4"
            fill="#475569"
            fontSize="7"
            fontFamily="Outfit, sans-serif"
          >
            {shortName}
          </text>
        )
      })}
    </svg>
  )
}

export default function SkillsMastery() {
  const [activeTab, setActiveTab] = useState<Tab>('development')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const data = skillsData[activeTab]

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setActiveTab(prev => {
        const idx = tabs.findIndex(t => t.id === prev)
        return tabs[(idx + 1) % tabs.length].id
      })
    }, 5000)
  }

  useEffect(() => {
    startTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  return (
    <section id="services" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-[800] text-4xl md:text-5xl text-white text-center mb-4">
          Skills Mastery
        </h2>
        <p className="text-white text-center mb-10 max-w-lg mx-auto text-sm leading-relaxed">
          Explore my expertise across development, design, strategy, and AI automation through interactive visualizations.
        </p>

        <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); startTimer() }}
              className={`px-4 py-2 rounded-lg text-sm font-[600] transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-[rgba(0,180,255,0.12)] text-[#00b4ff] border border-[rgba(0,180,255,0.3)]'
                  : 'text-white border border-transparent hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-[rgba(0,180,255,0.1)] bg-[#0d0d1a] p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="text-white font-[700] text-sm mb-1">{data.title}</div>
              <div className="text-white text-xs mb-4">Expertise levels across key skills</div>
              <RadarChart skills={data.skills} />
            </div>

            <div className="flex-1 flex flex-col gap-3 w-full">
              {data.skills.map(skill => (
                <div
                  key={skill.name}
                  className="p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(0,180,255,0.06)]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-[700] text-sm">{skill.name}</span>
                    <span className="text-[#00b4ff] font-[800] text-sm">{skill.level}%</span>
                  </div>
                  <p className="text-white text-xs mb-2 leading-relaxed">{skill.description}</p>
                  <div className="h-1 bg-[rgba(0,180,255,0.07)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00b4ff] rounded-full"
                      style={{ width: `${skill.level}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-white text-[10px]">
                    <span>{skill.years}+ years</span>
                    {skill.projects !== null && <span>{skill.projects} projects</span>}
                    <span className="ml-auto">{skill.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
