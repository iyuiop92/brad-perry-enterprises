'use client'
import { useState } from 'react'

interface Node {
  id: string
  label: string
  sub: string
  x: number
  y: number
  r: number
  color: string
  type: 'hub' | 'personal' | 'client'
}

const nodes: Node[] = [
  { id: 'bpe',           label: 'BradPerryEnterprises.com', sub: 'Network Hub',  x: 390, y: 248, r: 28, color: '#ffffff', type: 'hub' },
  { id: 'petprosusa',    label: 'PetProsUSA',     sub: '28K visits',  x: 182, y: 88,  r: 18, color: '#22c55e', type: 'personal' },
  { id: 'startpaddle',   label: 'StartPaddle',    sub: '18K visits',  x: 98,  y: 195, r: 16, color: '#0ea5e9', type: 'personal' },
  { id: 'studiothree60', label: 'StudioThree60',  sub: '15K visits',  x: 165, y: 295, r: 16, color: '#8b5cf6', type: 'personal' },
  { id: 'mipura',        label: 'Mipura',         sub: '22K visits',  x: 148, y: 378, r: 16, color: '#c17f3c', type: 'personal' },
  { id: 'superwatches',  label: 'SuperWatches',   sub: '12K visits',  x: 305, y: 428, r: 14, color: '#f59e0b', type: 'personal' },
  { id: 'aetherhockey',  label: 'AetherHockey',   sub: '45K visits',  x: 568, y: 118, r: 22, color: '#00b4ff', type: 'personal' },
  { id: 'azice',         label: 'AZ Ice',          sub: '3.5K visits', x: 635, y: 238, r: 12, color: '#94a3b8', type: 'client' },
  { id: 'drivenbaseball',label: 'DrivenBaseball', sub: '14K visits',  x: 618, y: 365, r: 12, color: '#ef4444', type: 'client' },
  { id: 'icehouse',      label: 'IceHouseTavern', sub: '8.7K visits', x: 472, y: 425, r: 12, color: '#14b8a6', type: 'client' },
]

const edges: [string, string][] = [
  ['bpe', 'petprosusa'],
  ['bpe', 'startpaddle'],
  ['bpe', 'studiothree60'],
  ['bpe', 'mipura'],
  ['bpe', 'superwatches'],
  ['bpe', 'aetherhockey'],
  ['bpe', 'a2ice'],
  ['bpe', 'drivenbaseball'],
  ['bpe', 'icehouse'],
  ['aetherhockey', 'studiothree60'],
  ['mipura', 'petprosusa'],
  ['startpaddle', 'studiothree60'],
]

const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))

export default function AffiliateNetwork() {
  const [hovered, setHovered] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'personal' | 'client'>('all')

  const visibleNodes = nodes.filter(n => n.type === 'hub' || filter === 'all' || n.type === filter)
  const visibleIds = new Set(visibleNodes.map(n => n.id))

  const visibleEdges = edges.filter(([a, b]) => visibleIds.has(a) && visibleIds.has(b))

  const activeEdges = hovered
    ? visibleEdges.filter(([a, b]) => a === hovered || b === hovered)
    : visibleEdges

  return (
    <section id="network" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-[800] text-4xl md:text-5xl text-white text-center mb-4">
          The Affiliate Network
        </h2>
        <p className="text-[#475569] text-center mb-8 max-w-md mx-auto text-sm leading-relaxed">
          Explore how my profitable sites connect and cross-promote each other in
          this interactive network visualization.
        </p>

        <div className="flex items-center justify-center gap-6 mb-6 text-xs text-[#475569] flex-wrap">
          <span className="italic">Hover over nodes to see connections</span>
          <div className="flex items-center gap-4">
            {(['all', 'personal', 'client'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 font-[600] capitalize transition-colors ${
                  filter === f ? 'text-white' : 'text-[#475569] hover:text-[#64748b]'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: f === 'personal' ? '#00b4ff' : f === 'client' ? '#ef4444' : '#ffffff',
                  }}
                />
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[rgba(0,180,255,0.1)] bg-[#04040a] overflow-hidden">
          <svg viewBox="0 0 760 510" className="w-full" style={{ minHeight: 280 }}>
            <defs>
              <pattern id="netdot" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.8" fill="rgba(0,180,255,0.05)" />
              </pattern>
            </defs>
            <rect width="760" height="510" fill="url(#netdot)" />

            {/* Dim edges */}
            {visibleEdges.map(([a, b]) => {
              const na = nodeMap[a]
              const nb = nodeMap[b]
              if (!na || !nb) return null
              const isActive = !hovered || activeEdges.some(([ea, eb]) => ea === a && eb === b)
              return (
                <line
                  key={`${a}-${b}-dim`}
                  x1={na.x} y1={na.y}
                  x2={nb.x} y2={nb.y}
                  stroke="rgba(0,180,255,0.08)"
                  strokeWidth="1"
                  strokeDasharray="4 5"
                  opacity={isActive ? 0 : 0.6}
                />
              )
            })}

            {/* Active edges */}
            {activeEdges.map(([a, b]) => {
              const na = nodeMap[a]
              const nb = nodeMap[b]
              if (!na || !nb) return null
              const otherNode = a === hovered ? nodeMap[b] : nodeMap[a]
              return (
                <line
                  key={`${a}-${b}-active`}
                  x1={na.x} y1={na.y}
                  x2={nb.x} y2={nb.y}
                  stroke={hovered ? otherNode.color : 'rgba(0,180,255,0.2)'}
                  strokeWidth={hovered ? 1.5 : 0.8}
                  opacity={hovered ? 0.7 : 0.3}
                />
              )
            })}

            {/* Nodes */}
            {visibleNodes.map((node) => {
              const isHovered = hovered === node.id
              const isDimmed = hovered !== null && !isHovered

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer' }}
                  opacity={isDimmed ? 0.4 : 1}
                >
                  {/* Hit area */}
                  <circle r={node.r + 10} fill="transparent" />

                  {/* Glow on hover */}
                  {isHovered && (
                    <circle r={node.r + 6} fill={node.color} opacity={0.1} />
                  )}

                  <circle
                    r={node.r}
                    fill={node.type === 'hub' ? '#0a0a14' : node.color + '20'}
                    stroke={node.color}
                    strokeWidth={isHovered ? 2 : 1}
                  />

                  {node.type === 'hub' && (
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill="white"
                      fontSize="9"
                      fontWeight="800"
                      fontFamily="Outfit, sans-serif"
                    >
                      BPE
                    </text>
                  )}

                  <text
                    textAnchor="middle"
                    dy={node.r + 14}
                    fill={node.color}
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="Outfit, sans-serif"
                  >
                    {node.label}
                  </text>
                  <text
                    textAnchor="middle"
                    dy={node.r + 24}
                    fill="#475569"
                    fontSize="8"
                    fontFamily="Outfit, sans-serif"
                  >
                    {node.sub}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </section>
  )
}
