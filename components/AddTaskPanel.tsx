'use client'

import { useState } from 'react'
import type { TaskStatus, TaskType, TaskOwner, TaskPhase, ChecklistItem } from '@/lib/types'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'To do' },
  { value: 'done', label: 'Done' },
]

const OWNER_OPTIONS: { value: TaskOwner; label: string }[] = [
  { value: 'brad', label: 'Brad' },
  { value: 'wendy', label: 'Wendy' },
  { value: 'ellie', label: 'Ellie' },
  { value: 'cleaver', label: 'Cleaver' },
  { value: 'sam', label: 'Sam' },
]

const PHASE_OPTIONS: { value: TaskPhase; label: string }[] = [
  { value: 'discovery', label: 'Discovery' },
  { value: 'design', label: 'Design' },
  { value: 'build', label: 'Build' },
  { value: 'launch', label: 'Launch' },
  { value: 'live', label: 'Live' },
]

const inputStyle = {
  background: '#04040a',
  border: '1px solid rgba(0, 180, 255, 0.13)',
  color: '#e2e8f0',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13,
  width: '100%',
  outline: 'none',
}

const labelStyle = {
  color: '#64748b',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  marginBottom: 4,
  display: 'block',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

export default function AddTaskPanel({
  onClose,
  onTaskAdded,
  defaultBrand,
  defaultWorkspaceId,
}: {
  onClose: () => void
  onTaskAdded: () => void
  defaultBrand?: string
  defaultWorkspaceId?: string
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TaskType>('internal')
  const [brand, setBrand] = useState(defaultBrand ?? '')
  const [status, setStatus] = useState<TaskStatus>('idea')
  const [owner, setOwner] = useState<TaskOwner>('brad')
  const [notes, setNotes] = useState('')
  const [phase, setPhase] = useState<TaskPhase | ''>('')
  const [deliverables, setDeliverables] = useState<ChecklistItem[]>([])
  const [handoff, setHandoff] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addDeliverable() {
    setDeliverables((prev) => [...prev, { label: '', done: false }])
  }

  function updateDeliverable(index: number, value: string) {
    setDeliverables((prev) =>
      prev.map((item, i) => (i === index ? { ...item, label: value } : item))
    )
  }

  function removeDeliverable(index: number) {
    setDeliverables((prev) => prev.filter((_, i) => i !== index))
  }

  function addHandoff() {
    setHandoff((prev) => [...prev, { label: '', done: false }])
  }

  function updateHandoff(index: number, value: string) {
    setHandoff((prev) =>
      prev.map((item, i) => (i === index ? { ...item, label: value } : item))
    )
  }

  function removeHandoff(index: number) {
    setHandoff((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !brand.trim()) {
      setError('Title and brand/client are required.')
      return
    }
    setLoading(true)
    setError(null)

    const body = {
      title: title.trim(),
      type,
      brand: brand.trim(),
      status,
      owner,
      notes: notes.trim() || null,
      phase: type === 'client' && phase ? phase : null,
      deliverables: deliverables.filter((d) => d.label.trim()),
      handoff_checklist: handoff.filter((h) => h.label.trim()),
      workspace_id: defaultWorkspaceId ?? null,
    }

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
      return
    }

    onTaskAdded()
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(4, 4, 10, 0.7)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-y-auto"
        style={{
          width: 400,
          background: '#0d0d1a',
          borderLeft: '2px solid #00b4ff',
        }}
      >
        {/* Panel header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(0, 180, 255, 0.13)' }}
        >
          <span
            className="font-[800] text-base"
            style={{ color: '#00b4ff', fontFamily: 'var(--font-outfit)' }}
          >
            New Task
          </span>
          <button
            onClick={onClose}
            className="text-lg leading-none"
            style={{ color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6 flex-1">
          <Field label="Title *">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              style={inputStyle}
              required
            />
          </Field>

          {/* Type toggle */}
          <Field label="Type">
            <div className="flex rounded-[10px] overflow-hidden" style={{ border: '1px solid rgba(0, 180, 255, 0.13)' }}>
              {(['internal', 'client'] as TaskType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className="flex-1 py-2 text-xs font-semibold capitalize transition-all"
                  style={{
                    background: type === t ? '#00b4ff' : '#04040a',
                    color: type === t ? '#04040a' : '#64748b',
                  }}
                >
                  {t === 'internal' ? 'Internal' : 'Client'}
                </button>
              ))}
            </div>
          </Field>

          <Field label={type === 'client' ? 'Client Name *' : 'Brand *'}>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder={type === 'client' ? 'Client name' : 'e.g. AetherHockey'}
              style={inputStyle}
              required
            />
          </Field>

          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              style={inputStyle}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Owner">
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value as TaskOwner)}
              style={inputStyle}
            >
              {OWNER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          {type === 'client' && (
            <Field label="Phase">
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as TaskPhase | '')}
                style={inputStyle}
              >
                <option value="">-- Select phase --</option>
                {PHASE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Deliverables */}
          <div>
            <p style={labelStyle}>Deliverables</p>
            <div className="flex flex-col gap-2">
              {deliverables.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateDeliverable(i, e.target.value)}
                    placeholder={`Deliverable ${i + 1}`}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeDeliverable(i)}
                    style={{ color: '#64748b', fontSize: 16 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addDeliverable}
                className="text-xs rounded-[10px] py-1.5 transition-all"
                style={{
                  border: '1px dashed rgba(0, 180, 255, 0.25)',
                  color: '#00b4ff',
                  background: 'transparent',
                }}
              >
                + Add Deliverable
              </button>
            </div>
          </div>

          {/* Handoff checklist */}
          <div>
            <p style={labelStyle}>Handoff Checklist</p>
            <div className="flex flex-col gap-2">
              {handoff.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateHandoff(i, e.target.value)}
                    placeholder={`Handoff item ${i + 1}`}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeHandoff(i)}
                    style={{ color: '#64748b', fontSize: 16 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addHandoff}
                className="text-xs rounded-[10px] py-1.5 transition-all"
                style={{
                  border: '1px dashed rgba(0, 180, 255, 0.25)',
                  color: '#00b4ff',
                  background: 'transparent',
                }}
              >
                + Add Handoff Item
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold"
              style={{
                border: '1px solid rgba(0, 180, 255, 0.13)',
                color: '#64748b',
                background: 'transparent',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: '#00b4ff', color: '#04040a' }}
            >
              {loading ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
