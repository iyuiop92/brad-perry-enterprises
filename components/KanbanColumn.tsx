import type { Task, TaskStatus } from '@/lib/types'
import TaskCard from './TaskCard'

export default function KanbanColumn({
  status,
  label,
  color,
  tasks,
  onSelectTask,
}: {
  status: TaskStatus
  label: string
  color: string
  tasks: Task[]
  onSelectTask: (task: Task) => void
}) {
  const brandTasks  = tasks.filter((t) => t.type === 'internal')
  const clientTasks = tasks.filter((t) => t.type === 'client')

  return (
    <div
      className="flex flex-col rounded-[10px] w-72 shrink-0"
      style={{
        background: 'rgba(13,13,26,0.6)',
        border: '1px solid rgba(0,180,255,0.1)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-t-[10px]"
        style={{ borderBottom: '1px solid rgba(0,180,255,0.1)' }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span
            className="text-sm font-[800] uppercase tracking-wider"
            style={{ color, fontFamily: 'var(--font-outfit)' }}
          >
            {label}
          </span>
        </div>
        <span
          className="text-xs font-[600] px-2 py-0.5 rounded-full"
          style={{ background: `${color}22`, color }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 max-h-[calc(100vh-120px)]">
        {tasks.length === 0 ? (
          <div
            className="rounded-[10px] p-4 text-center text-xs"
            style={{ border: '1px dashed rgba(0,180,255,0.15)', color: '#64748b' }}
          >
            Nothing here
          </div>
        ) : (
          <>
            {brandTasks.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-wider px-1" style={{ color: '#64748b' }}>
                  My Brands
                </p>
                {brandTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onSelect={onSelectTask} />
                ))}
              </div>
            )}
            {clientTasks.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-xs uppercase tracking-wider px-1" style={{ color: '#64748b' }}>
                  Client Work
                </p>
                {clientTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onSelect={onSelectTask} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
