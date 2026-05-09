'use client'
import type { Task, TaskStatus, Workspace } from '@/lib/types'

const STATUS_GROUPS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'in_progress', label: 'In Progress', color: '#00b4ff' },
  { status: 'blocked',     label: 'Blocked',     color: '#f59e0b' },
  { status: 'idea',        label: 'Ideas',       color: '#475569' },
  { status: 'done',        label: 'Done',        color: '#22c55e' },
]

const PRIORITY_COLOR: Record<string, string> = {
  high: '#22c55e', medium: '#f59e0b', low: '#ef4444',
}

export default function WorkspaceTaskList({
  workspace,
  tasks,
  onSelectTask,
  onAddTask,
}: {
  workspace: Workspace
  tasks: Task[]
  onSelectTask: (task: Task) => void
  onAddTask: () => void
}) {
  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{ border: `1px solid ${workspace.color}30` }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          background: `${workspace.color}0c`,
          borderBottom: `1px solid ${workspace.color}20`,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: workspace.color, boxShadow: `0 0 6px ${workspace.color}` }}
          />
          <span
            className="text-sm font-[800] tracking-tight"
            style={{ color: workspace.color, fontFamily: 'var(--font-outfit)' }}
          >
            {workspace.name}
          </span>
          <span className="text-xs" style={{ color: '#334155' }}>
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onAddTask}
          className="text-xs font-[600] px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
          style={{ background: workspace.color, color: '#04040a' }}
        >
          + Add Task
        </button>
      </div>

      {/* Status groups */}
      <div className="p-4 grid grid-cols-2 gap-4" style={{ background: 'rgba(13,13,26,0.6)' }}>
        {STATUS_GROUPS.map(({ status, label, color }) => {
          const group = tasks.filter(t => t.status === status)
          return (
            <div key={status}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                <span className="text-[10px] uppercase tracking-wider font-[700]" style={{ color }}>
                  {label}
                </span>
                <span className="text-[10px]" style={{ color: '#334155' }}>{group.length}</span>
              </div>
              <div className="flex flex-col gap-1">
                {group.length === 0 ? (
                  <p className="text-[11px] px-2" style={{ color: '#1e293b' }}>—</p>
                ) : (
                  group.map(task => (
                    <button
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className="text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all group"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderLeft: `2px solid ${PRIORITY_COLOR[task.priority] ?? '#334155'}`,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                      }}
                    >
                      <span className="text-xs font-[500] truncate flex-1 leading-snug" style={{ color: '#cbd5e1' }}>
                        {task.title}
                      </span>
                      {task.phase && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0 capitalize"
                          style={{ background: 'rgba(0,180,255,0.08)', color: '#00b4ff' }}
                        >
                          {task.phase}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
