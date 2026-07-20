'use client'
import { useState } from 'react'
import Image from 'next/image'

interface Project {
  id: string
  name: string
  category: string
  description: string
  stack: string[]
  color: string
  image: string
  type: 'personal' | 'client'
  url?: string | null
}

const projects: Project[] = [
  {
    id: 'aetherhockey',
    name: 'AetherHockey.com',
    category: 'Sports Platform',
    description: 'Elite hockey skills training platform with resources for players, coaches, and parents.',
    stack: ['Custom App', 'Video Platform', 'LMS'],
    color: '#00b4ff',
    image: '/s360/4.png',
    type: 'personal',
    url: 'https://aetherhockey.com',
  },
  {
    id: 'a2ice',
    name: 'AZIce.com',
    category: 'Facility Management',
    description: 'Seven-site network for a $8M ice management company in Phoenix — fully custom multi-site CMS.',
    stack: ['Custom CMS', 'Booking System', 'Multi-site'],
    color: '#94a3b8',
    image: '/s360/7.png',
    type: 'client',
    url: 'https://azice.com',
  },
  {
    id: 'studiothree60',
    name: 'StudioThree60.com',
    category: 'Digital Agency',
    description: 'Design agency leveraging AI builders, Adobe Creative Suite, and design automation tools.',
    stack: ['React', 'Stripe', 'Automation'],
    color: '#8b5cf6',
    image: '/s360/3.png',
    type: 'personal',
    url: 'https://studiothree60.com',
  },
  {
    id: 'mipura',
    name: 'Mipura.com',
    category: 'Coffee Affiliate',
    description: 'Coffee enthusiasts affiliate hub connecting passionate lovers with premium products and expert reviews.',
    stack: ['WordPress', 'WooCommerce', 'Analytics'],
    color: '#c17f3c',
    image: '/s360/1.png',
    type: 'personal',
    url: 'https://mipura.com',
  },
  {
    id: 'icehouse',
    name: 'Ice House Tavern',
    category: 'Hospitality',
    description: "Arizona's premier hockey bar featuring live game viewing, team events, and community spaces.",
    stack: ['WordPress', 'Event Mgmt', 'Social Integration'],
    color: '#14b8a6',
    image: '/s360/9.png',
    type: 'client',
    url: 'https://icehousetavernphx.com',
  },
  {
    id: 'drivenbaseball',
    name: 'DrivenBaseballAthletics.com',
    category: 'Sports Training',
    description: 'Baseball training academy with a dedicated player app for skill development and progress tracking.',
    stack: ['React Native', 'Firebase', 'Video Analytics'],
    color: '#ef4444',
    image: '/s360/8.png',
    type: 'client',
    url: 'https://drivenbaseballathletics.com',
  },
  {
    id: 'startpaddle',
    name: 'StartPaddle.com',
    category: 'Sports Affiliate',
    description: 'Water paddle sports hub featuring gear reviews, training resources, and performance insights.',
    stack: ['Shopify', 'Liquid', 'SEO Tools'],
    color: '#0ea5e9',
    image: '/s360/2.png',
    type: 'personal',
    url: null,
  },
  {
    id: 'petprosusa',
    name: 'PetProsUSA.com',
    category: 'Pet Affiliate',
    description: 'Comprehensive pet products platform offering expert reviews and personalized pet care guidance.',
    stack: ['WordPress', 'Affiliate Mgmt', 'CRM'],
    color: '#22c55e',
    image: '/s360/5.png',
    type: 'personal',
    url: null,
  },
  {
    id: 'superwatches',
    name: 'SuperWatchesStore.com',
    category: 'Watch Retail',
    description: 'Accessories retailer with curated collections and premium watch inventory management.',
    stack: ['Shopify Plus', 'Inventory Mgmt', 'Analytics'],
    color: '#f59e0b',
    image: '/s360/6.png',
    type: 'personal',
    url: null,
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
      <div className="relative h-36 overflow-hidden">
        <Image
          src={project.image}
          alt={project.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.05) 100%)' }} />
        <div className="absolute inset-0 flex items-end justify-between p-3">
          <span className="text-[10px] font-[700] text-white/70 bg-black/50 px-2 py-1 rounded-md backdrop-blur-sm uppercase tracking-wide">
            {project.category}
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
        <p className="text-white text-xs leading-relaxed mb-3">{project.description}</p>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {project.stack.map(tech => (
            <span
              key={tech}
              className="text-[9px] text-white border border-[rgba(0,180,255,0.07)] px-2 py-0.5 rounded-full"
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

        {project.url ? (
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00b4ff] text-[10px] font-[600] hover:underline mt-2 block"
            onClick={e => e.stopPropagation()}
          >
            Visit website &#8594;
          </a>
        ) : (
          <span className="text-[#334155] text-[10px] mt-2 block">Coming Soon</span>
        )}
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
        <p className="text-white text-center mb-12 max-w-lg mx-auto text-sm leading-relaxed">
          Click any project to explore detailed case studies.
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
