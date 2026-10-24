'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Task, Workspace } from '@/lib/types'
import ParticleField from '@/components/ParticleField'
import CommandFeed from '@/components/CommandFeed'
import CleaverPanel from '@/components/CleaverPanel'
import SamPanel from '@/components/SamPanel'
import TaskDetailModal from '@/components/TaskDetailModal'
import AddTaskPanel from '@/components/AddTaskPanel'
import AddWorkspacePanel from '@/components/AddWorkspacePanel'
import DashboardVoiceDock from '@/components/DashboardVoiceDock'

// Wendy and Ellie moved out of this drawer on 2026-10-24 and into the
// persistent layout rail (components/WendyRail.tsx). Cleaver and Sam are
// parked workers and stay here, where an on-demand drawer is the right shape.
type AssistantPanel = 'cleaver' | 'sam' | null

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [tasks, setTasks]           = useState<Task[]>([])
  const [loading, setLoading]       = useState(true)
  const [selectedWs, setSelectedWs] = useState<Workspace | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [showAddWorkspace, setShowAddWorkspace] = useState(false)
  const [assistantPanel, setAssistantPanel] = useState<AssistantPanel>(null)

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
      if (e.key === 'Escape' && assistantPanel) setAssistantPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [assistantPanel])

  // The conversation rail lives in the layout and cannot see this page's state,
  // so the selected workspace is mirrored to localStorage. The rail uses it to
  // tag outgoing messages and to file new cards against the right workspace.
  useEffect(() => {
    if (selectedWs) window.localStorage.setItem('bpe.selectedWorkspace', JSON.stringify({ id: selectedWs.id, name: selectedWs.name }))
    else window.localStorage.removeItem('bpe.selectedWorkspace')
    window.dispatchEvent(new Event('bpe:workspace'))
  }, [selectedWs])

  // Cards created from the conversation rail land in Supabase, not in this
  // page's state. Refetch so a new card appears on the board immediately.
  useEffect(() => {
    const onTasks = () => { void fetchAll() }
    window.addEventListener('bpe:tasks', onTasks)
    return () => window.removeEventListener('bpe:tasks', onTasks)
  }, [fetchAll])

  // The Assistants menu still opens Wendy and Ellie, but they now live in the
  // layout rail rather than this page's drawer, so the menu asks the rail to
  // open rather than setting local state.
  const openRail = (agent: 'wendy' | 'ellie') =>
    window.dispatchEvent(new CustomEvent('bpe:rail', { detail: { agent } }))

  return (
    <div className="dashboard-page-shell" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <ParticleField />

      {/* ── Nav actions ── */}
      <div
        className="dashboard-top-actions"
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
        <DashboardVoiceDock />
        <div className="dashboard-desktop-actions" style={{ display: 'none' }}>
          <Link
            href="/dashboard/bridge"
            aria-label="Open Command Bridge"
            style={{
              height: 28, padding: '0 4px', display: 'flex', alignItems: 'center',
              color: '#00b4ff', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
              textDecoration: 'none',
            }}
          >
            Bridge
          </Link>
          <details style={{ position: 'relative' }}>
            <summary style={{ listStyle: 'none', height: 28, padding: '0 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>Assistants ▾</summary>
            <div style={{ position: 'absolute', right: 0, top: 34, width: 150, padding: 6, background: '#080b13', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 9, boxShadow: '0 16px 40px rgba(0,0,0,0.4)', display: 'grid', gap: 2 }}>
          <button
            onClick={() => openRail('wendy')}
            style={{
              display: 'flex', alignItems: 'center',
              height: 28, padding: '0 4px', cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: '#00b4ff', letterSpacing: '0.05em' }}>
              Wendy
            </span>
          </button>

          <button
            onClick={() => openRail('ellie')}
            style={{
              display: 'flex', alignItems: 'center',
              height: 28, padding: '0 4px', cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.05em' }}>
              Ellie
            </span>
          </button>

          <button
            onClick={() => setAssistantPanel(panel => panel === 'cleaver' ? null : 'cleaver')}
            style={{
              display: 'flex', alignItems: 'center',
              height: 28, padding: '0 4px', cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: assistantPanel === 'cleaver' ? '#22c55e' : '#64748b', letterSpacing: '0.05em' }}>
              Cleaver
            </span>
          </button>

          <button
            onClick={() => setAssistantPanel(panel => panel === 'sam' ? null : 'sam')}
            style={{
              display: 'flex', alignItems: 'center',
              height: 28, padding: '0 4px', cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: assistantPanel === 'sam' ? '#2dd4bf' : '#64748b', letterSpacing: '0.05em' }}>
              Sam
            </span>
          </button>
            </div>
          </details>

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

        <button
          onClick={() => setShowAddPanel(true)}
          aria-label="Create a task"
          style={{ height: 28, padding: '0 4px', cursor: 'pointer', background: 'transparent', color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', border: 'none', boxShadow: 'none' }}
        >
          New
        </button>
        <details className="dashboard-team-menu" style={{ display: 'none' }}>
          <summary>Assistants</summary>
          <div className="dashboard-team-menu-panel">
            <Link href="/dashboard/bridge" style={{ color: '#00b4ff', textDecoration: 'none' }}>
              Command Bridge
            </Link>
            <button
              type="button"
              onClick={() => openRail('wendy')}
              style={{ color: '#00b4ff' }}
            >
              Wendy
            </button>
            <button
              type="button"
              onClick={() => openRail('ellie')}
              style={{ color: '#a78bfa' }}
            >
              Ellie
            </button>
            <button
              type="button"
              onClick={() => setAssistantPanel(panel => panel === 'cleaver' ? null : 'cleaver')}
              style={{ color: assistantPanel === 'cleaver' ? '#22c55e' : '#94a3b8' }}
            >
              Cleaver
            </button>
            <button
              type="button"
              onClick={() => setAssistantPanel(panel => panel === 'sam' ? null : 'sam')}
              style={{ color: assistantPanel === 'sam' ? '#2dd4bf' : '#94a3b8' }}
            >
              Sam
            </button>
            <button type="button" onClick={() => setShowAddPanel(true)}>
              New task
            </button>
          </div>
        </details>
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

      {/* ── Assistant drawer (slides in from right) ── */}
      <div
        className="dashboard-assistant-drawer"
        style={{
          position: 'fixed', top: 38, right: 0, bottom: 0, width: 320, zIndex: 50,
          transform: assistantPanel ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'rgba(4,4,10,0.98)',
          borderLeft: `1px solid ${assistantPanel === 'cleaver' ? 'rgba(34,197,94,0.16)' : assistantPanel === 'sam' ? 'rgba(45,212,191,0.16)' : 'rgba(0,180,255,0.12)'}`,
          boxShadow: assistantPanel
            ? `-30px 0 80px rgba(0,0,0,0.7), -8px 0 20px ${assistantPanel === 'cleaver' ? 'rgba(34,197,94,0.06)' : 'rgba(45,212,191,0.06)'}`
            : 'none',
        }}
      >
        {/* Always-visible close button — the backdrop sits behind the drawer,
            so on mobile (full-screen drawer) this is the only way out. */}
        {assistantPanel && (
          <button
            onClick={() => setAssistantPanel(null)}
            aria-label="Close panel"
            style={{
              position: 'absolute', top: 8, right: 8, zIndex: 60,
              width: 44, height: 44, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#e2e8f0', cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
        {assistantPanel === 'cleaver' && (
          <CleaverPanel workspaces={workspaces} tasks={tasks} selectedWs={selectedWs} />
        )}
        {assistantPanel === 'sam' && (
          <SamPanel workspaces={workspaces} tasks={tasks} selectedWs={selectedWs} />
        )}
      </div>

      {/* Backdrop */}
      {assistantPanel && (
        <div
          onClick={() => setAssistantPanel(null)}
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
          onSaved={task => { if (task) setSelectedTask(task); fetchAll() }}
          onDeleted={() => { setSelectedTask(null); fetchAll() }}
        />
      )}
    </div>
  )
}
