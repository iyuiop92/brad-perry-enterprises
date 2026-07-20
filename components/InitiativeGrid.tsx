'use client'
import type { Task, Workspace } from '@/lib/types'

function seededSparkline(seed: string, points = 14): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h << 5, 1) - h + seed.charCodeAt(i)
    h |= 0
  }
  const vals: number[] = []
  let val = 50
  for (let i = 0; i < points; i++) {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) | 0
    val = Math.max(8, Math.min(92, val + ((Math.abs(h) % 22) - 10)))
    vals.push(val)
  }
  return vals
}

function Sparkline({
  seed,
  color,
  w = 200,
  h = 38,
}: {
  seed: string
  color: string
  w?: number
  h?: number
}) {
  const vals = seededSparkline(seed)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const pad = 4

  const points = vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * w,
    y: h - pad - ((v - min) / range) * (h - pad * 2),
  }))

  const linePath = points.reduce((acc, pt, i) => {
    if (i === 0) return `M${pt.x},${pt.y}`
    const prev = points[i - 1]
    const mx = (prev.x + pt.x) / 2
    return `${acc} C${mx},${prev.y} ${mx},${pt.y} ${pt.x},${pt.y}`
  }, '')

  const fillPath = `${linePath} L${w},${h} L0,${h} Z`
  const gradId = `sg-${seed.replace(/-/g, '').slice(0, 12)}`

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function healthPulse(ws: Workspace): number {
  if (ws.task_count === 0) return 50
  return Math.min(100, Math.round(
    ((ws.active_count * 2 + (ws.task_count - ws.blocked_count)) / (ws.task_count * 3)) * 100
  ))
}

export default function InitiativeGrid({
  workspaces,
  tasks,
  selectedWs,
  onSelectWs,
}: {
  workspaces: Workspace[]
  tasks: Task[]
  selectedWs: Workspace | null
  onSelectWs: (ws: Workspace) => void
}) {
  return (
    <div className="h-full overflow-y-auto p-5">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p
            className="text-[10px] font-[700] uppercase tracking-[0.22em]"
            style={{ color: '#334155' }}
          >
            Initiative Performance Overview
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: '#1e293b' }}>
            Select a workspace to activate the constellation
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#22c55e', animation: 'breathe 2s ease-in-out infinite', '--glow-color': '#22c55e55', '--glow-min': '2px', '--glow-max': '6px' } as React.CSSProperties}
          />
          <span className="text-[9px] font-[700]" style={{ color: '#22c55e' }}>LIVE</span>
        </div>
      </div>

      {/* Grid */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}
      >
        {workspaces.map(ws => {
          const pulse = healthPulse(ws)
          const isSelected = selectedWs?.id === ws.id
          const isActive = ws.active_count > 0
          const animSpeed = isActive ? Math.max(1.2, 3 - ws.active_count * 0.3) : 0

          return (
            <button
              key={ws.id}
              onClick={() => onSelectWs(ws)}
              className="text-left rounded-xl p-4 transition-all duration-200"
              style={{
                background: isSelected ? `${ws.color}0e` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isSelected ? ws.color + '45' : 'rgba(255,255,255,0.05)'}`,
                boxShadow: isSelected ? `0 0 24px ${ws.color}12` : 'none',
              }}
            >
              {/* Tile header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      background: ws.color,
                      boxShadow: `0 0 ${isActive ? 8 : 4}px ${ws.color}`,
                      animation: isActive ? `breathe ${animSpeed}s ease-in-out infinite` : 'none',
                      '--glow-color': ws.color + '88',
                      '--glow-min': '3px',
                      '--glow-max': '10px',
                    } as React.CSSProperties}
                  />
                  <span className="text-xs font-[700] truncate" style={{ color: ws.color }}>
                    {ws.name}
                  </span>
                </div>
                {isActive && (
                  <span className="text-[8px] font-[700] shrink-0" style={{ color: '#22c55e' }}>
                    ● LIVE
                  </span>
                )}
              </div>

              {/* Sparkline */}
              <div className="mb-3 -mx-1">
                <Sparkline seed={ws.id} color={ws.color} />
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-1 mb-3 text-center">
                {[
                  { label: 'ACTIVE', val: ws.active_count, color: '#00b4ff' },
                  { label: 'TO DO', val: ws.blocked_count, color: '#f59e0b' },
                  { label: 'IDEAS', val: ws.idea_count, color: '#475569' },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <p className="text-sm font-[800]" style={{ color }}>{val}</p>
                    <p className="text-[7px] font-[700] uppercase tracking-wider" style={{ color: '#1e293b' }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Health bar */}
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 h-0.5 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pulse}%`, background: ws.color, opacity: 0.65 }}
                  />
                </div>
                <span className="text-[8px] font-[700] shrink-0" style={{ color: '#334155' }}>
                  {pulse}%
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {workspaces.length === 0 && (
        <div className="flex items-center justify-center h-48">
          <p className="text-xs" style={{ color: '#1e293b' }}>No workspaces configured</p>
        </div>
      )}
    </div>
  )
}
