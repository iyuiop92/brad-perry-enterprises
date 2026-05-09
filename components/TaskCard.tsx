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
      className="rounded-[10px] p-3 cursor-pointer transition-all"
      style={{
        background: '#0d0d1a',
        border: '1px solid rgba(0,180,255,0.13)',
        borderLeft: `3px solid ${accentColor}`,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.borderColor = 'rgba(0,180,255,0.35)'
        el.style.borderLeftColor = accentColor
        el.style.boxShadow = '0 0 12px rgba(0,180,255,0.08)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.borderColor = 'rgba(0,180,255,0.13)'
        el.style.borderLeftColor = accentColor
        el.style.boxShadow = 'none'
      }}
      onClick={() => onSelect(task)}
    >
      <div className="flex items-start gap-2">
        <StatusDot owner={task.owner} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-[600] leading-snug" style={{ color: '#e2e8f0' }}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.brand && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(100,116,139,0.15)', color: '#64748b' }}
              >
                {task.brand}
              </span>
            )}
            {task.phase && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full capitalize"
                style={{ background: 'rgba(0,180,255,0.08)', color: '#00b4ff' }}
              >
                {task.phase}
              </span>
            )}
          </div>
          {task.notes && (
            <p
              className="text-[11px] mt-1.5 leading-relaxed"
              style={{
                color: '#475569',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {task.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
