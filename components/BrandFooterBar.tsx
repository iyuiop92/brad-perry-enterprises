'use client'
import type { Workspace } from '@/lib/types'

function DonutChart({
  value,
  color,
  size = 38,
}: {
  value: number
  color: string
  size?: number
}) {
  const r = (size - 7) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const filled = Math.max(0, Math.min(1, value / 100)) * circ

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3.5" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3.5"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </svg>
  )
}

function healthPulse(ws: Workspace): number {
  if (ws.task_count === 0) return 50
  return Math.min(100, Math.round(
    ((ws.active_count * 2 + (ws.task_count - ws.blocked_count)) / (ws.task_count * 3)) * 100
  ))
}

export default function BrandFooterBar({
  workspaces,
  onSelectWs,
}: {
  workspaces: Workspace[]
  onSelectWs: (ws: Workspace) => void
}) {
  if (workspaces.length === 0) return null

  return (
    <div
      className="shrink-0 relative z-10 flex items-center gap-3 px-5 overflow-x-auto"
      style={{
        height: 88,
        background: 'rgba(2,2,10,0.85)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {workspaces.map(ws => {
        const pulse = healthPulse(ws)
        return (
          <button
            key={ws.id}
            onClick={() => onSelectWs(ws)}
            className="shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${ws.color}20`,
              minWidth: 155,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${ws.color}0a`
              e.currentTarget.style.borderColor = `${ws.color}40`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
              e.currentTarget.style.borderColor = `${ws.color}20`
            }}
          >
            <DonutChart value={pulse} color={ws.color} />
            <div className="text-left min-w-0">
              <p className="text-xs font-[700] truncate" style={{ color: ws.color }}>
                {ws.name}
              </p>
              <p className="text-[9px] mt-0.5" style={{ color: '#334155' }}>
                <span style={{ color: '#00b4ff' }}>{ws.active_count}</span>{' '}
                active
                {ws.blocked_count > 0 && (
                  <span style={{ color: '#f59e0b' }}> · {ws.blocked_count} blocked</span>
                )}
              </p>
              <p className="text-[8px] mt-0.5 font-[600]" style={{ color: '#283044' }}>
                {pulse}% health
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
