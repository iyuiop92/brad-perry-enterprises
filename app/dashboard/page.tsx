'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Task, Workspace } from '@/lib/types'
import ParticleField from '@/components/ParticleField'
import CommandFeed from '@/components/CommandFeed'
import WendyPanel from '@/components/WendyPanel'
import TaskDetailModal from '@/components/TaskDetailModal'
import AddTaskPanel from '@/components/AddTaskPanel'
import AddWorkspacePanel from '@/components/AddWorkspacePanel'

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [tasks, setTasks]           = useState<Task[]>([])
  const [loading, setLoading]       = useState(true)
  const [selectedWs, setSelectedWs] = useState<Workspace | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [showAddWorkspace, setShowAddWorkspace] = useState(false)
  const [wendyOpen, setWendyOpen]   = useState(false)

  const fetchAll = useCallback(async () => {
    const [wsRes, taskRes] = await Promise.all([
      fetch('/api/workspaces'),
      fetch('/api/tasks'),
    ])
    if (wsRes.ok)   setWorkspaces(await wsRes.json())
    if (taskRes.ok) setTasks(await taskRes.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchAll() }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchAll])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && wendyOpen) setWendyOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wendyOpen])

  return (
    <div className="dashboard-page-shell" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <ParticleField />

      {/* ── Nav actions ── */}
      <div
        style={{
          position: 'fixed',
          top: 5,
          right: 20,
          zIndex: 120,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button
          onClick={() => setWendyOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center',
            height: 28, padding: '0 4px', cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: wendyOpen ? '#00b4ff' : '#64748b', letterSpacing: '0.05em' }}>
            Wendy
          </span>
        </button>

        <button
          onClick={() => setShowAddPanel(true)}
          style={{
            height: 28, padding: '0 4px', cursor: 'pointer',
            background: 'transparent', color: '#64748b',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
            border: 'none',
            boxShadow: 'none',
          }}
        >
          New
        </button>
      </div>

      {/* ── Activity ticker ── */}
      {tasks.length > 0 && (() => {
        const recentTasks = [...tasks]
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .slice(0, 10)
        const btnStyle: React.CSSProperties = {
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, lineHeight: '1', color: '#8899aa', padding: '0 2px',
          whiteSpace: 'nowrap', fontFamily: 'var(--font-outfit)',
        }
        const sepStyle: React.CSSProperties = { fontSize: 11, color: '#1e293b', padding: '0 10px', userSelect: 'none' }
        function TickerSet({ prefix }: { prefix: string }) {
          return (
            <>
              {recentTasks.map((t, i) => (
                <span key={`${prefix}-${t.id}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    style={btnStyle}
                    onClick={() => setSelectedTask(t)}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#00b4ff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#8899aa' }}
                  >
                    {t.title} — {t.status === 'blocked' ? 'to do' : t.status.replace('_', ' ')}
                  </button>
                  {i < recentTasks.length - 1 && <span style={sepStyle}>·</span>}
                </span>
              ))}
              <span style={{ paddingRight: 60 }} />
            </>
          )
        }
        return (
          <div style={{
            flexShrink: 0, height: 28, display: 'flex', alignItems: 'center', overflow: 'hidden',
            background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(0,180,255,0.06)',
            position: 'relative', zIndex: 20,
          }}>
            <style>{`@keyframes dash-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
            <div
              data-ticker
              style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', animation: 'dash-ticker 50s linear infinite', paddingLeft: 12 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.animationPlayState = 'paused' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.animationPlayState = 'running' }}
            >
              <TickerSet prefix="a" />
              <TickerSet prefix="b" />
            </div>
          </div>
        )
      })()}

      {/* ── Body ── */}
      <main className="dashboard-page-main" style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="animate-pulse"
                    style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#00b4ff',
                      boxShadow: '0 0 8px rgba(0,180,255,0.6)',
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', color: '#334155', textTransform: 'uppercase' }}>
                Initializing
              </span>
            </div>
          </div>
        ) : (
          <CommandFeed
            tasks={tasks}
            workspaces={workspaces}
            selectedWs={selectedWs}
            onSelectTask={setSelectedTask}
            onSelectWs={ws => setSelectedWs(prev => prev?.id === ws.id ? null : ws)}
            onAddTask={() => setShowAddPanel(true)}
            onAddWorkspace={() => setShowAddWorkspace(true)}
            onRefresh={fetchAll}
          />
        )}
      </main>

      {/* ── Wendy drawer (slides in from right) ── */}
      <div
        style={{
          position: 'fixed', top: 38, right: 0, bottom: 0, width: 320, zIndex: 50,
          transform: wendyOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'rgba(4,4,10,0.98)',
          borderLeft: '1px solid rgba(0,180,255,0.12)',
          boxShadow: wendyOpen
            ? '-30px 0 80px rgba(0,0,0,0.7), -8px 0 20px rgba(0,180,255,0.05)'
            : 'none',
        }}
      >
        <WendyPanel workspaces={workspaces} tasks={tasks} selectedWs={selectedWs} />
      </div>

      {/* Backdrop */}
      {wendyOpen && (
        <div
          onClick={() => setWendyOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ── Modals ── */}
      {showAddPanel && (
        <AddTaskPanel
          onClose={() => setShowAddPanel(false)}
          onTaskAdded={() => { setShowAddPanel(false); fetchAll() }}
          defaultBrand={selectedWs?.name}
          defaultWorkspaceId={selectedWs?.id}
        />
      )}
      {showAddWorkspace && (
        <AddWorkspacePanel
          onClose={() => setShowAddWorkspace(false)}
          onAdded={() => { setShowAddWorkspace(false); fetchAll() }}
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
    </div>
  )
}
