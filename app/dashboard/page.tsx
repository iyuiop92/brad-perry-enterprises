'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Task, Workspace } from '@/lib/types'
import ParticleField from '@/components/ParticleField'
import CommandFeed from '@/components/CommandFeed'
import WendyPanel from '@/components/WendyPanel'
import ElliePanel from '@/components/ElliePanel'
import CleaverPanel from '@/components/CleaverPanel'
import SamPanel from '@/components/SamPanel'
import CodexPanel from '@/components/CodexPanel'
import TaskDetailModal from '@/components/TaskDetailModal'
import AddTaskPanel from '@/components/AddTaskPanel'
import AddWorkspacePanel from '@/components/AddWorkspacePanel'

type AssistantPanel = 'wendy' | 'ellie' | 'cleaver' | 'sam' | 'codex' | null

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
        <div className="dashboard-desktop-actions">
          <button
            onClick={() => setAssistantPanel(panel => panel === 'wendy' ? null : 'wendy')}
            style={{
              display: 'flex', alignItems: 'center',
              height: 28, padding: '0 4px', cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: assistantPanel === 'wendy' ? '#00b4ff' : '#64748b', letterSpacing: '0.05em' }}>
              Wendy
            </span>
          </button>

          <button
            onClick={() => setAssistantPanel(panel => panel === 'ellie' ? null : 'ellie')}
            style={{
              display: 'flex', alignItems: 'center',
              height: 28, padding: '0 4px', cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: assistantPanel === 'ellie' ? '#a78bfa' : '#64748b', letterSpacing: '0.05em' }}>
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

          <button
            onClick={() => setAssistantPanel(panel => panel === 'codex' ? null : 'codex')}
            style={{
              display: 'flex', alignItems: 'center',
              height: 28, padding: '0 4px', cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: assistantPanel === 'codex' ? '#fb923c' : '#64748b', letterSpacing: '0.05em' }}>
              Codex
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

        <details className="dashboard-team-menu">
          <summary>Team</summary>
          <div className="dashboard-team-menu-panel">
            <a href="/dashboard/bridge" style={{ color: '#00b4ff', fontWeight: 700 }}>
              Bridge ↗
            </a>
            <button
              type="button"
              onClick={() => setAssistantPanel(panel => panel === 'wendy' ? null : 'wendy')}
              style={{ color: assistantPanel === 'wendy' ? '#00b4ff' : '#94a3b8' }}
            >
              Wendy
            </button>
            <button
              type="button"
              onClick={() => setAssistantPanel(panel => panel === 'ellie' ? null : 'ellie')}
              style={{ color: assistantPanel === 'ellie' ? '#a78bfa' : '#94a3b8' }}
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
            <button
              type="button"
              onClick={() => setAssistantPanel(panel => panel === 'codex' ? null : 'codex')}
              style={{ color: assistantPanel === 'codex' ? '#fb923c' : '#94a3b8' }}
            >
              Codex
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
            onOpenAssistant={setAssistantPanel}
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
          borderLeft: `1px solid ${assistantPanel === 'ellie' ? 'rgba(167,139,250,0.16)' : assistantPanel === 'cleaver' ? 'rgba(34,197,94,0.16)' : assistantPanel === 'sam' ? 'rgba(45,212,191,0.16)' : assistantPanel === 'codex' ? 'rgba(251,146,60,0.16)' : 'rgba(0,180,255,0.12)'}`,
          boxShadow: assistantPanel
            ? `-30px 0 80px rgba(0,0,0,0.7), -8px 0 20px ${assistantPanel === 'ellie' ? 'rgba(167,139,250,0.06)' : assistantPanel === 'cleaver' ? 'rgba(34,197,94,0.06)' : assistantPanel === 'sam' ? 'rgba(45,212,191,0.06)' : assistantPanel === 'codex' ? 'rgba(251,146,60,0.06)' : 'rgba(0,180,255,0.05)'}`
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
              width: 34, height: 34, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#e2e8f0', cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
        {assistantPanel === 'wendy' && (
          <WendyPanel workspaces={workspaces} tasks={tasks} selectedWs={selectedWs} />
        )}
        {assistantPanel === 'ellie' && (
          <ElliePanel workspaces={workspaces} tasks={tasks} selectedWs={selectedWs} />
        )}
        {assistantPanel === 'cleaver' && (
          <CleaverPanel workspaces={workspaces} tasks={tasks} selectedWs={selectedWs} />
        )}
        {assistantPanel === 'sam' && (
          <SamPanel workspaces={workspaces} tasks={tasks} selectedWs={selectedWs} />
        )}
        {assistantPanel === 'codex' && (
          <CodexPanel workspaces={workspaces} tasks={tasks} selectedWs={selectedWs} />
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
