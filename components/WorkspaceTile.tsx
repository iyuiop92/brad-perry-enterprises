'use client'
import type { Workspace } from '@/lib/types'

function glowVars(color: string, active: number, blocked: number): React.CSSProperties {
  const min = blocked > 0 ? '12px' : active > 0 ? '8px' : '4px'
  const max = blocked > 0 ? '32px' : active > 0 ? '22px' : '10px'
  const dur = blocked > 0 ? '1.6s' : active > 0 ? '2.4s' : '5s'
  return {
    '--glow-color': `${color}44`,
    '--glow-min': min,
    '--glow-max': max,
    animationName: 'breathe',
    animationDuration: dur,
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  } as React.CSSProperties
}

export default function WorkspaceTile({
  workspace,
  selected,
  onSelect,
}: {
  workspace: Workspace
  selected: boolean
  onSelect: (ws: Workspace) => void
}) {
  const { color, active_count, blocked_count, idea_count, task_count } = workspace
  const total   = task_count || 1
  const done    = total - active_count - blocked_count - idea_count
  const pct     = Math.round(((done + active_count * 0.5) / total) * 100)

  return (
    <button
      onClick={() => onSelect(workspace)}
      className="text-left w-full transition-all duration-200 group"
      style={{
        borderRadius: 14,
        background: selected
          ? `linear-gradient(135deg, ${color}14 0%, ${color}06 100%)`
          : 'rgba(13,13,26,0.8)',
        border: `1px solid ${selected ? color + '40' : 'rgba(255,255,255,0.06)'}`,
        borderTop: `2px solid ${selected ? color : color + '60'}`,
        transform: selected ? 'translateY(-2px)' : 'translateY(0)',
        ...glowVars(color, active_count, blocked_count),
      }}
    >
      {/* Top section */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span
            className="font-[800] leading-tight tracking-tight"
            style={{
              color: selected ? color : '#e2e8f0',
              fontFamily: 'var(--font-outfit)',
              fontSize: 'clamp(0.85rem, 1.5vw, 1rem)',
              transition: 'color 0.2s',
            }}
          >
            {workspace.name}
          </span>
          {/* Live indicator if active */}
          {active_count > 0 && (
            <span
              className="shrink-0 w-1.5 h-1.5 rounded-full mt-1"
              style={{
                background: color,
                boxShadow: `0 0 6px ${color}`,
                animation: 'breathe 1.8s ease-in-out infinite',
                '--glow-color': `${color}88`,
                '--glow-min': '2px',
                '--glow-max': '8px',
              } as React.CSSProperties}
            />
          )}
        </div>
        {workspace.url && (
          <p className="text-[10px] font-[500]" style={{ color: '#334155' }}>
            {workspace.url}
          </p>
        )}
      </div>

      {/* KPI row */}
      <div
        className="grid grid-cols-3 text-center py-3 mx-4 rounded-lg"
        style={{ background: 'rgba(0,0,0,0.25)', marginBottom: 12 }}
      >
        <KPI value={active_count} label="ACTIVE" color={active_count > 0 ? '#00b4ff' : '#1e293b'} />
        <KPI value={blocked_count} label="BLOCKED" color={blocked_count > 0 ? '#f59e0b' : '#1e293b'} divider />
        <KPI value={idea_count} label="IDEAS" color={idea_count > 0 ? '#475569' : '#1e293b'} divider />
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-[600] uppercase tracking-wider" style={{ color: '#1e293b' }}>
            Progress
          </span>
          <span className="text-[9px] font-[700]" style={{ color: task_count === 0 ? '#1e293b' : color }}>
            {task_count === 0 ? 'No tasks' : `${pct}%`}
          </span>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.05)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${task_count === 0 ? 0 : pct}%`,
              background: `linear-gradient(90deg, ${color}88, ${color})`,
            }}
          />
        </div>
      </div>
    </button>
  )
}

function KPI({ value, label, color, divider }: { value: number; label: string; color: string; divider?: boolean }) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 py-1"
      style={{ borderLeft: divider ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
    >
      <span className="text-base font-[800]" style={{ color, fontFamily: 'var(--font-outfit)', lineHeight: 1 }}>
        {value}
      </span>
      <span className="text-[8px] font-[700] tracking-widest" style={{ color: '#1e293b' }}>
        {label}
      </span>
    </div>
  )
}
