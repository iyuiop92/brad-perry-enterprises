'use client'
import type { Task, TaskPriority } from '@/lib/types'
import StatusDot from './StatusDot'

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high:   '#22c55e',
  medium: '#f59e0b',
  low:    '#ef4444',
}

export default function TaskCard({
  task,
  onSelect,
}: {
  task: Task
  onSelect: (task: Task) => void
}) {
  const accentColor = PRIORITY_COLOR[task.priority] ?? '#334155'

  return (
    <div
      className="rounded-[8px] px-2.5 py-1.5 cursor-pointer transition-all flex items-center gap-2 min-w-0"
      style={{
        background: '#0d0d1a',
        border: '1px solid rgba(0,180,255,0.13)',
        borderLeft: `3px solid ${accentColor}`,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.borderColor = 'rgba(0,180,255,0.35)'
        el.style.borderLeftColor = accentColor
        el.style.boxShadow = '0 0 10px rgba(0,180,255,0.07)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.borderColor = 'rgba(0,180,255,0.13)'
        el.style.borderLeftColor = accentColor
        el.style.boxShadow = 'none'
      }}
      onClick={() => onSelect(task)}
    >
      <StatusDot brand={task.brand} />
      <p className="text-xs font-[600] leading-snug truncate flex-1" style={{ color: '#e2e8f0' }}>
        {task.title}
      </p>
      {task.phase && (
        <span
          className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0 capitalize"
          style={{ background: 'rgba(0,180,255,0.08)', color: '#00b4ff' }}
        >
          {task.phase}
        </span>
      )}
    </div>
  )
}
