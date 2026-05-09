'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Task, Workspace } from '@/lib/types'
import ParticleField from '@/components/ParticleField'
import InboxStrip from '@/components/InboxStrip'
import WorkspaceTile from '@/components/WorkspaceTile'
import WorkspaceTaskList from '@/components/WorkspaceTaskList'
import AddTaskPanel from '@/components/AddTaskPanel'
import TaskDetailModal from '@/components/TaskDetailModal'

export default function DashboardPage() {
  const [workspaces, setWorkspaces]     = useState<Workspace[]>([])
  const [tasks, setTasks]               = useState<Task[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedWs, setSelectedWs]     = useState<Workspace | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)

  const fetchAll = useCallback(async () => {
    const [wsRes, taskRes] = await Promise.all([
      fetch('/api/workspaces'),
      fetch('/api/tasks'),
    ])
    if (wsRes.ok)   setWorkspaces(await wsRes.json())
    if (taskRes.ok) setTasks(await taskRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const myBrands = workspaces.filter(w => w.type === 'brand')
  const clients  = workspaces.filter(w => w.type === 'client')
  const wsTasks  = selectedWs ? tasks.filter(t => t.workspace_id === selectedWs.id) : []

  function handleSelectWs(ws: Workspace) {
    setSelectedWs(prev => prev?.id === ws.id ? null : ws)
  }

  return (
    <>
      <ParticleField />

      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 shrink-0 relative z-10"
        style={{
          background: 'rgba(4,4,10,0.85)',
          borderBottom: '1px solid rgba(0,180,255,0.13)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span
          className="text-lg font-[800] tracking-tight"
          style={{ color: '#00b4ff', fontFamily: 'var(--font-outfit)' }}
        >
          BPE Command Center
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: '#475569' }}>{today}</span>
          <button
            onClick={() => setShowAddPanel(true)}
            className="rounded-[10px] px-4 py-2 text-sm font-[600] transition-all hover:opacity-90"
            style={{ background: '#00b4ff', color: '#04040a' }}
          >
            + Add Task
          </button>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto relative z-10">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="text-sm" style={{ color: '#475569' }}>Loading...</span>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-8" style={{ maxWidth: 1400, margin: '0 auto' }}>

            <InboxStrip />

            {/* My Brands */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.2em] font-[700] mb-4" style={{ color: '#334155' }}>
                My Brands
              </p>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {myBrands.map(ws => (
                  <WorkspaceTile
                    key={ws.id}
                    workspace={ws}
                    selected={selectedWs?.id === ws.id}
                    onSelect={handleSelectWs}
                  />
                ))}
              </div>
            </section>

            {/* Client Work */}
            {clients.length > 0 && (
              <section>
                <p className="text-[10px] uppercase tracking-[0.2em] font-[700] mb-4" style={{ color: '#334155' }}>
                  Client Work
                </p>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                  {clients.map(ws => (
                    <WorkspaceTile
                      key={ws.id}
                      workspace={ws}
                      selected={selectedWs?.id === ws.id}
                      onSelect={handleSelectWs}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Selected workspace task list */}
            {selectedWs && (
              <WorkspaceTaskList
                workspace={selectedWs}
                tasks={wsTasks}
                onSelectTask={setSelectedTask}
                onAddTask={() => setShowAddPanel(true)}
              />
            )}

          </div>
        )}
      </main>

      {showAddPanel && (
        <AddTaskPanel
          onClose={() => setShowAddPanel(false)}
          onTaskAdded={() => { setShowAddPanel(false); fetchAll() }}
          defaultBrand={selectedWs?.name}
          defaultWorkspaceId={selectedWs?.id}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSaved={() => fetchAll()}
          onDeleted={() => { setSelectedTask(null); fetchAll() }}
        />
      )}
    </>
  )
}
