'use client'
import { useState } from 'react'
import Image from 'next/image'

interface Project {
  id: string
  name: string
  category: string
  description: string
  traffic: string
  conversion: string
  stack: string[]
  color: string
  type: 'personal' | 'client'
  image: string
}

const projects: Project[] = [
  {
    id: 'mipura',
    name: 'Mipura.com',
    category: 'Coffee Affiliate',
    description: 'Coffee enthusiasts affiliate hub connecting passionate lovers with premium products and expert reviews.',
    traffic: '22.5K',
    conversion: '3.2%',
    stack: ['WordPress', 'WooCommerce', 'Analytics'],
    color: '#c17f3c',
    type: 'personal',
    image: '/s360/1.png',
  },
  {
    id: 'startpaddle',
    name: 'StartPaddle.com',
    category: 'Sports Affiliate',
    description: 'Water paddle sports hub featuring gear reviews, training resources, and performance insights.',
    traffic: '18.2K',
    conversion: '4.1%',
    stack: ['Shopify', 'Liquid', 'SEO Tools'],
    color: '#0ea5e9',
    type: 'personal',
    image: '/s360/2.png',
  },
  {
    id: 'studiothree60',
    name: 'StudioThree60.com',
    category: 'Digital Agency',
    description: 'Design agency leveraging AI builders, Adobe Creative Suite, and design automation tools.',
    traffic: '15.8K',
    conversion: '5.7%',
    stack: ['React', 'Stripe', 'Automation'],
    color: '#8b5cf6',
    type: 'personal',
    image: '/s360/3.png',
  },
  {
    id: 'petprosusa',
    name: 'PetProsUSA.com',
    category: 'Pet Affiliate',
    description: 'Comprehensive pet products platform offering expert reviews and personalized pet care guidance.',
    traffic: '28.4K',
    conversion: '2.9%',
    stack: ['WordPress', 'Affiliate Mgmt', 'CRM'],
    color: '#22c55e',
    type: 'personal',
    image: '/s360/4.png',
  },
  {
    id: 'superwatches',
    name: 'SuperWatchesStore.com',
    category: 'Watch Retail',
    description: 'Accessories retailer with curated collections and premium watch inventory management.',
    traffic: '12.3K',
    conversion: '3.8%',
    stack: ['Shopify Plus', 'Inventory Mgmt', 'Analytics'],
    color: '#f59e0b',
    type: 'personal',
    image: '/s360/5.png',
  },
  {
    id: 'aetherhockey',
    name: 'AetherHockey.com',
    category: 'Sports Platform',
    description: 'Elite hockey skills training platform with resources for players, coaches, and parents.',
    traffic: '45.2K',
    conversion: '4.2%',
    stack: ['Custom App', 'Video Platform', 'LMS'],
    color: '#00b4ff',
    type: 'personal',
    image: '/s360/6.png',
  },
  {
    id: 'icehouse',
    name: 'Ice House Tavern',
    category: 'Hospitality',
    description: "Arizona's premier hockey bar featuring live game viewing, team events, and community spaces.",
    traffic: '8.7K',
    conversion: '2.1%',
    stack: ['WordPress', 'Event Mgmt', 'Social Integration'],
    color: '#14b8a6',
    type: 'client',
    image: '/s360/7.png',
  },
]

function ProjectCard({
  project,
  expanded,
  onToggle,
}: {
  project: Project
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-xl border border-[rgba(0,180,255,0.1)] bg-[#0d0d1a] overflow-hidden hover:border-[rgba(0,180,255,0.25)] transition-colors duration-200">
      <div className="relative h-36 flex items-end justify-between p-3 overflow-hidden">
        <Image
          src={project.image}
          alt={project.name}
          fill
          className="object-cover object-top"
        />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, #0d0d1a 0%, ${project.color}22 100%)` }} />
        <span className="relative z-10 text-[10px] font-[700] text-white/70 bg-black/50 px-2 py-1 rounded-md backdrop-blur-sm uppercase tracking-wide">
          {project.category}
        </span>
        <div className="relative z-10 flex items-center gap-2">
          <span className="text-[10px] font-[600] text-white/60 bg-black/50 px-2 py-1 rounded-md backdrop-blur-sm">
            High Performance
          </span>
          <button
            onClick={onToggle}
            className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm hover:bg-black/70 transition-colors"
          >
            <svg
              width="10"
              height="10"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              className={`transition-transform duration-200 ${expanded ? 'rotate-45' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
          <h3 className="font-[700] text-white text-sm leading-tight">{project.name}</h3>
        </div>
        <p className="text-[#475569] text-xs leading-relaxed mb-3">{project.description}</p>

        <div className="flex items-center gap-4 mb-3">
          <div>
            <div className="text-white font-[800] text-sm">{project.traffic}</div>
            <div className="text-[#334155] text-[10px] uppercase tracking-wide">Traffic</div>
          </div>
          <div className="w-px h-7 bg-[rgba(0,180,255,0.08)]" />
          <div>
            <div className="text-white font-[800] text-sm">{project.conversion}</div>
            <div className="text-[#334155] text-[10px] uppercase tracking-wide">Conversion</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {project.stack.map(tech => (
            <span
              key={tech}
              className="text-[9px] text-[#334155] border border-[rgba(0,180,255,0.07)] px-2 py-0.5 rounded-full"
            >
              {tech}
            </span>
          ))}
        </div>

        {expanded && (
          <div className="pt-3 border-t border-[rgba(0,180,255,0.07)] mt-2">
            <a href="#contact" className="text-[#00b4ff] text-xs font-[600] hover:underline">
              Start a similar project &#8594;
            </a>
          </div>
        )}

        <button
          onClick={onToggle}
          className="text-[#334155] text-[10px] hover:text-[#475569] mt-2 block transition-colors"
        >
          Click to explore case study
        </button>
      </div>
    </div>
  )
}

export default function ProjectDeepDive() {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <section id="work" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-[800] text-4xl md:text-5xl text-white text-center mb-4">
          Project Deep Dive
        </h2>
        <p className="text-[#475569] text-center mb-12 max-w-lg mx-auto text-sm leading-relaxed">
          Click any project to explore revenue metrics, traffic insights, and detailed case studies.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              expanded={expanded === project.id}
              onToggle={() => setExpanded(expanded === project.id ? null : project.id)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
