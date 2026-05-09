'use client'
import type { Workspace } from '@/lib/types'

function glowVars(color: string, active: number, blocked: number) {
  const min  = blocked > 0 ? '10px' : active > 0 ? '8px' : '5px'
  const max  = blocked > 0 ? '28px' : active > 0 ? '20px' : '10px'
  const dur  = blocked > 0 ? '1.8s' : active > 0 ? '2.6s' : '4.5s'
  const hex  = color
  return {
    '--glow-color': `${hex}55`,
    '--glow-min':   min,
    '--glow-max':   max,
    animationName:     'breathe',
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

  return (
    <button
      onClick={() => onSelect(workspace)}
      className="text-left rounded-[12px] p-4 transition-all w-full"
      style={{
        background: selected ? `${color}0f` : 'rgba(13,13,26,0.7)',
        border: `1px solid ${selected ? color + '55' : 'rgba(0,180,255,0.1)'}`,
        borderLeft: `3px solid ${color}`,
        ...glowVars(color, active_count, blocked_count),
        transform: selected ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      {/* Name row */}
      <div className="flex items-center justify-between mb-2.5">
        <span
          className="text-sm font-[800] tracking-tight leading-none"
          style={{ color, fontFamily: 'var(--font-outfit)' }}
        >
          {workspace.name}
        </span>
        {workspace.url && (
          <span className="text-[9px]" style={{ color: '#334155' }}>
            {workspace.url}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-2 flex-wrap">
        {active_count > 0 && (
          <Pill count={active_count} label="active" color="#00b4ff" />
        )}
        {blocked_count > 0 && (
          <Pill count={blocked_count} label="blocked" color="#f59e0b" />
        )}
        {idea_count > 0 && (
          <Pill count={idea_count} label="ideas" color="#475569" />
        )}
        {task_count === 0 && (
          <span className="text-[10px]" style={{ color: '#334155' }}>No tasks yet</span>
        )}
      </div>
    </button>
  )
}

function Pill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <span
      className="text-[10px] font-[600] px-1.5 py-0.5 rounded-full"
      style={{ background: `${color}18`, color }}
    >
      {count} {label}
    </span>
  )
}
