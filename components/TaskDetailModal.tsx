'use client'
import { useState } from 'react'
import type { Task, TaskStatus, TaskOwner, TaskPhase, TaskPriority } from '@/lib/types'

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string; desc: string }[] = [
  { value: 'high',   label: 'High',  color: '#22c55e', desc: 'Do this now' },
  { value: 'medium', label: 'Good',  color: '#f59e0b', desc: 'Can wait'    },
  { value: 'low',    label: 'Hold',  color: '#ef4444', desc: 'Pause this'  },
]

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'idea',        label: 'Idea'        },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked',     label: 'Blocked'     },
  { value: 'done',        label: 'Done'        },
]

const OWNER_OPTIONS: TaskOwner[] = ['brad', 'wendy', 'ellie']
const PHASE_OPTIONS: (TaskPhase | '')[] = ['', 'discovery', 'design', 'build', 'launch', 'live']

async function patchTask(id: string, body: Partial<Task>) {
  await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export default function TaskDetailModal({
  task,
  onClose,
  onSaved,
  onDeleted,
}: {
  task: Task
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const [title, setTitle]     = useState(task.title)
  const [notes, setNotes]     = useState(task.notes ?? '')
  const [status, setStatus]   = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<TaskPriority>(task.priority ?? 'medium')
  const [owner, setOwner]     = useState<TaskOwner>(task.owner)
  const [brand, setBrand]     = useState(task.brand ?? '')
  const [phase, setPhase]     = useState<TaskPhase | ''>(task.phase ?? '')

  async function save(patch: Partial<Task>) {
    await patchTask(task.id, patch)
    onSaved()
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    onDeleted()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-y-auto"
        style={{
          width: 'min(480px, 100vw)',
          background: '#0d0d1a',
          borderLeft: '1px solid rgba(0,180,255,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(0,180,255,0.1)' }}
        >
          <span className="text-[10px] uppercase tracking-[0.2em] font-[600]" style={{ color: '#475569' }}>
            Task Detail
          </span>
          <button onClick={onClose} className="transition-colors hover:text-white" style={{ color: '#475569' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-6 px-6 py-5 flex-1">

          {/* Title */}
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && save({ title: title.trim() })}
            rows={2}
            className="w-full bg-transparent resize-none outline-none font-[700] leading-snug"
            style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', color: '#e2e8f0' }}
            placeholder="Task title..."
          />

          {/* Priority */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-[600] mb-2.5" style={{ color: '#475569' }}>
              Priority
            </div>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={async () => {
                    setPriority(opt.value)
                    await save({ priority: opt.value })
                  }}
                  className="flex-1 flex flex-col items-center py-2.5 px-2 rounded-lg border transition-all"
                  style={{
                    borderColor: priority === opt.value ? opt.color : 'rgba(255,255,255,0.06)',
                    background: priority === opt.value ? `${opt.color}18` : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full mb-1.5" style={{ background: opt.color }} />
                  <span className="text-xs font-[700]" style={{ color: priority === opt.value ? opt.color : '#475569' }}>
                    {opt.label}
                  </span>
                  <span className="text-[9px] mt-0.5" style={{ color: '#334155' }}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-[600] mb-1.5" style={{ color: '#475569' }}>Status</div>
              <select
                value={status}
                onChange={async (e) => {
                  const v = e.target.value as TaskStatus
                  setStatus(v)
                  await save({ status: v })
                }}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: '#04040a', border: '1px solid rgba(0,180,255,0.13)', color: '#e2e8f0' }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-[600] mb-1.5" style={{ color: '#475569' }}>Owner</div>
              <select
                value={owner}
                onChange={async (e) => {
                  const v = e.target.value as TaskOwner
                  setOwner(v)
                  await save({ owner: v })
                }}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none capitalize"
                style={{ background: '#04040a', border: '1px solid rgba(0,180,255,0.13)', color: '#e2e8f0' }}
              >
                {OWNER_OPTIONS.map((o) => (
                  <option key={o} value={o} className="capitalize">{o}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-[600] mb-1.5" style={{ color: '#475569' }}>Brand</div>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                onBlur={() => save({ brand: brand.trim() || null })}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: '#04040a', border: '1px solid rgba(0,180,255,0.13)', color: '#e2e8f0' }}
                placeholder="e.g. AetherHockey"
              />
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-[600] mb-1.5" style={{ color: '#475569' }}>Phase</div>
              <select
                value={phase}
                onChange={async (e) => {
                  const v = e.target.value as TaskPhase | ''
                  setPhase(v)
                  await save({ phase: v ? v as TaskPhase : null })
                }}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none capitalize"
                style={{ background: '#04040a', border: '1px solid rgba(0,180,255,0.13)', color: '#e2e8f0' }}
              >
                {PHASE_OPTIONS.map((o) => (
                  <option key={o} value={o} className="capitalize">{o || 'None'}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col flex-1">
            <div className="text-[10px] uppercase tracking-[0.2em] font-[600] mb-1.5" style={{ color: '#475569' }}>Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => save({ notes: notes.trim() || null })}
              rows={10}
              placeholder="Add context, links, next steps..."
              className="flex-1 rounded-lg px-3 py-2.5 text-sm leading-relaxed resize-none outline-none"
              style={{
                background: '#04040a',
                border: '1px solid rgba(0,180,255,0.13)',
                color: '#94a3b8',
                minHeight: '160px',
              }}
            />
          </div>

          {/* Timestamps */}
          <div className="text-[10px]" style={{ color: '#334155' }}>
            Created {new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {task.updated_at !== task.created_at && (
              <> &middot; Updated {new Date(task.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 shrink-0"
          style={{ borderTop: '1px solid rgba(0,180,255,0.08)' }}
        >
          <button
            onClick={handleDelete}
            className="text-xs transition-colors"
            style={{ color: '#ef4444' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fca5a5')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#ef4444')}
          >
            Delete task
          </button>
        </div>
      </div>
    </>
  )
}
