'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Task, TaskStatus } from '@/lib/types'
import KanbanColumn from '@/components/KanbanColumn'
import AddTaskPanel from '@/components/AddTaskPanel'
import TaskDetailModal from '@/components/TaskDetailModal'

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'idea',        label: 'Ideas',       color: '#64748b' },
  { status: 'in_progress', label: 'In Progress',  color: '#00b4ff' },
  { status: 'blocked',     label: 'Blocked',      color: '#f59e0b' },
  { status: 'done',        label: 'Done',         color: '#22c55e' },
]

export default function DashboardPage() {
  const [tasks, setTasks]               = useState<Task[]>([])
  const [loading, setLoading]           = useState(true)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const fetchTasks = useCallback(async () => {
    const res = await fetch('/api/tasks')
    if (res.ok) {
      const data: Task[] = await res.json()
      setTasks(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  function handleTaskSaved() {
    fetchTasks()
    // keep modal open so user can continue editing
  }

  function handleTaskDeleted() {
    setSelectedTask(null)
    fetchTasks()
  }

  return (
    <>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ background: '#0d0d1a', borderBottom: '1px solid rgba(0,180,255,0.13)' }}
      >
        <span
          className="text-lg font-[800] tracking-tight"
          style={{ color: '#00b4ff', fontFamily: 'var(--font-outfit)' }}
        >
          BPE Command Center
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: '#64748b' }}>{today}</span>
          <button
            onClick={() => setShowAddPanel(true)}
            className="rounded-[10px] px-4 py-2 text-sm font-[600] transition-all hover:opacity-90"
            style={{ background: '#00b4ff', color: '#04040a' }}
          >
            + Add Task
          </button>
        </div>
      </header>

      {/* Board */}
      <main className="flex-1 overflow-x-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="text-sm" style={{ color: '#64748b' }}>Loading...</span>
          </div>
        ) : (
          <div className="flex gap-5 min-w-max h-full">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                label={col.label}
                color={col.color}
                tasks={tasks.filter((t) => t.status === col.status)}
                onSelectTask={setSelectedTask}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add Task Panel */}
      {showAddPanel && (
        <AddTaskPanel
          onClose={() => setShowAddPanel(false)}
          onTaskAdded={() => { setShowAddPanel(false); fetchTasks() }}
        />
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSaved={handleTaskSaved}
          onDeleted={handleTaskDeleted}
        />
      )}
    </>
  )
}
