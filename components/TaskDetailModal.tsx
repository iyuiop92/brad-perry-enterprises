'use client'
import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { Task, TaskStatus, TaskOwner, TaskPhase, TaskPriority } from '@/lib/types'

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string; desc: string }[] = [
  { value: 'high',   label: 'High',  color: '#22c55e', desc: 'Do this now' },
  { value: 'medium', label: 'Good',  color: '#f59e0b', desc: 'Can wait'    },
  { value: 'low',    label: 'Hold',  color: '#ef4444', desc: 'Pause this'  },
]

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'idea',        label: 'Idea'        },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked',     label: 'To do'       },
  { value: 'done',        label: 'Done'        },
]

const OWNER_OPTIONS: TaskOwner[] = ['brad', 'wendy', 'ellie']
const PHASE_OPTIONS: (TaskPhase | '')[] = ['', 'discovery', 'design', 'build', 'launch', 'live']

async function patchTask(id: string, body: Partial<Task>) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.error ?? 'Could not save task')
  }
  return await res.json() as Task
}

export default function TaskDetailModal({
  task,
  onClose,
  onSaved,
  onDeleted,
}: {
  task: Task
  onClose: () => void
  onSaved: (task?: Task) => void
  onDeleted: () => void
}) {
  const [tab, setTab]               = useState<'detail' | 'chat'>('detail')
  const [title, setTitle]           = useState(task.title)
  const [notes, setNotes]           = useState(task.notes ?? '')
  const [status, setStatus]         = useState<TaskStatus>(task.status)
  const [priority, setPriority]     = useState<TaskPriority>(task.priority ?? 'medium')
  const [owner, setOwner]           = useState<TaskOwner>(task.owner)
  const [brand, setBrand]           = useState(task.brand ?? '')
  const [phase, setPhase]           = useState<TaskPhase | ''>(task.phase ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  async function save(patch: Partial<Task>) {
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await patchTask(task.id, patch)
      onSaved(updated)
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1200)
      return updated
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save task')
      throw error
    } finally {
      setSaving(false)
    }
  }

  async function saveAll() {
    const cleanTitle = title.trim()
    if (!cleanTitle || saving) return
    await save({
      title: cleanTitle,
      notes: notes.trim() || null,
      status,
      priority,
      owner,
      brand: brand.trim() || null,
      phase: phase || null,
    })
  }

  async function handleDelete() {
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    onDeleted()
  }

  useEffect(() => {
    setTitle(task.title)
    setNotes(task.notes ?? '')
    setStatus(task.status)
    setPriority(task.priority ?? 'medium')
    setOwner(task.owner)
    setBrand(task.brand ?? '')
    setPhase(task.phase ?? '')
  }, [task])

  const hasChanges =
    title.trim() !== task.title ||
    notes !== (task.notes ?? '') ||
    status !== task.status ||
    priority !== (task.priority ?? 'medium') ||
    owner !== task.owner ||
    brand !== (task.brand ?? '') ||
    phase !== (task.phase ?? '')

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />

      <div
        className="task-detail-drawer fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{ width: 'min(500px, 100vw)', background: '#08080f', borderLeft: '1px solid rgba(0,180,255,0.12)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-6 pt-5 pb-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-[700] uppercase tracking-[0.2em]" style={{ color: '#334155' }}>Task</p>
            <div className="flex items-center gap-2">
              {saveError && <span className="text-[10px] font-[700]" style={{ color: '#ef4444' }}>{saveError}</span>}
              {savedFlash && !saveError && <span className="text-[10px] font-[700]" style={{ color: '#22c55e' }}>Saved</span>}
              {hasChanges && !saveError && <span className="text-[10px] font-[700]" style={{ color: '#f59e0b' }}>Unsaved</span>}
              <button
                onClick={saveAll}
                disabled={!hasChanges || !title.trim() || saving}
                className="text-[11px] font-[800] transition-opacity disabled:opacity-40"
                style={{
                  height: 28,
                  padding: '0 12px',
                  borderRadius: 5,
                  border: '1px solid rgba(34,197,94,0.35)',
                  background: hasChanges ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.03)',
                  color: hasChanges ? '#22c55e' : '#475569',
                  cursor: hasChanges && !saving ? 'pointer' : 'default',
                }}
              >
                {saving ? 'Saving' : 'Save'}
              </button>
              <button onClick={onClose} className="transition-opacity hover:opacity-60" style={{ color: '#475569' }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Title (always visible) */}
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            rows={2}
            className="w-full bg-transparent resize-none outline-none font-[700] leading-snug mb-4"
            style={{ fontSize: 'clamp(1rem, 2.5vw, 1.1rem)', color: '#e2e8f0' }}
            placeholder="Task title..."
          />

          {/* Tab switcher */}
          <div className="flex gap-0">
            {(['detail', 'chat'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-4 py-2 text-xs font-[700] uppercase tracking-wider transition-all"
                style={{
                  color: tab === t ? '#00b4ff' : '#334155',
                  borderBottom: tab === t ? '2px solid #00b4ff' : '2px solid transparent',
                }}
              >
                {t === 'chat' ? 'Ask Wendy' : 'Detail'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {tab === 'detail' ? (
          <DetailTab
            task={task}
            notes={notes} setNotes={setNotes}
            status={status} setStatus={setStatus}
            priority={priority} setPriority={setPriority}
            owner={owner} setOwner={setOwner}
            brand={brand} setBrand={setBrand}
            phase={phase} setPhase={setPhase}
            save={save}
            handleDelete={handleDelete}
            confirmDelete={confirmDelete}
            setConfirmDelete={setConfirmDelete}
          />
        ) : (
          <ChatTab taskId={task.id} />
        )}
      </div>
    </>
  )
}

function DetailTab({
  task, notes, setNotes, status, setStatus, priority, setPriority,
  owner, setOwner, brand, setBrand, phase, setPhase, save, handleDelete,
  confirmDelete, setConfirmDelete,
}: {
  task: Task
  notes: string; setNotes: (v: string) => void
  status: TaskStatus; setStatus: (v: TaskStatus) => void
  priority: TaskPriority; setPriority: (v: TaskPriority) => void
  owner: TaskOwner; setOwner: (v: TaskOwner) => void
  brand: string; setBrand: (v: string) => void
  phase: TaskPhase | ''; setPhase: (v: TaskPhase | '') => void
  save: (patch: Partial<Task>) => void
  handleDelete: () => void
  confirmDelete: boolean
  setConfirmDelete: (v: boolean) => void
}) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
      {/* Priority */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-[600] mb-2.5" style={{ color: '#334155' }}>Priority</p>
        <div className="flex gap-2">
          {PRIORITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={async () => { setPriority(opt.value); await save({ priority: opt.value }) }}
              className="flex-1 flex flex-col items-center py-2.5 px-2 rounded-lg border transition-all"
              style={{
                borderColor: priority === opt.value ? opt.color : 'rgba(255,255,255,0.06)',
                background: priority === opt.value ? `${opt.color}15` : 'rgba(255,255,255,0.02)',
              }}
            >
              <span className="w-2 h-2 rounded-full mb-1.5" style={{ background: opt.color }} />
              <span className="text-xs font-[700]" style={{ color: priority === opt.value ? opt.color : '#334155' }}>{opt.label}</span>
              <span className="text-[9px] mt-0.5" style={{ color: '#1e293b' }}>{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select value={status} onChange={async e => { const v = e.target.value as TaskStatus; setStatus(v); await save({ status: v }) }} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: '#04040a', border: '1px solid rgba(255,255,255,0.07)', color: '#e2e8f0' }}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Owner">
          <select value={owner} onChange={async e => { const v = e.target.value as TaskOwner; setOwner(v); await save({ owner: v }) }} className="w-full rounded-lg px-3 py-2 text-sm outline-none capitalize" style={{ background: '#04040a', border: '1px solid rgba(255,255,255,0.07)', color: '#e2e8f0' }}>
            {OWNER_OPTIONS.map(o => <option key={o} value={o} className="capitalize">{o}</option>)}
          </select>
        </Field>
        <Field label="Brand">
          <input value={brand} onChange={e => setBrand(e.target.value)} onBlur={() => save({ brand: brand.trim() || null })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: '#04040a', border: '1px solid rgba(255,255,255,0.07)', color: '#e2e8f0' }} placeholder="e.g. AetherHockey" />
        </Field>
        <Field label="Phase">
          <select value={phase} onChange={async e => { const v = e.target.value as TaskPhase | ''; setPhase(v); await save({ phase: v ? v as TaskPhase : null }) }} className="w-full rounded-lg px-3 py-2 text-sm outline-none capitalize" style={{ background: '#04040a', border: '1px solid rgba(255,255,255,0.07)', color: '#e2e8f0' }}>
            {PHASE_OPTIONS.map(o => <option key={o} value={o} className="capitalize">{o || 'None'}</option>)}
          </select>
        </Field>
      </div>

      {/* Notes */}
      <NotesEditor
        notes={notes}
        setNotes={setNotes}
        onSave={v => save({ notes: v || null })}
      />

      {/* Timestamps */}
      <p className="text-[10px]" style={{ color: '#1e293b' }}>
        Created {new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        {task.updated_at !== task.created_at && (
          <> · Updated {new Date(task.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
        )}
      </p>

      {/* Delete */}
      {confirmDelete ? (
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#94a3b8' }}>Delete this task?</span>
          <button
            onClick={handleDelete}
            className="text-xs font-[700] px-3 py-1 rounded-md"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            Yes, delete
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-xs px-3 py-1 rounded-md"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#8899aa', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="text-xs w-fit transition-colors"
          style={{ color: '#475569' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
        >
          Delete task
        </button>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] font-[600] mb-1.5" style={{ color: '#334155' }}>{label}</p>
      {children}
    </div>
  )
}

// ── Notes helpers ─────────────────────────────────────────────────────────────

type AnnotPart = { type: 'text'; content: string } | { type: 'annot'; content: string; note: string }

function parseAnnotations(text: string): AnnotPart[] {
  const parts: AnnotPart[] = []
  const pattern = /\{\{ANNOT:([\s\S]*?)\|\|([\s\S]*?)\}\}/g
  let lastIdx = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push({ type: 'text', content: text.slice(lastIdx, match.index) })
    parts.push({ type: 'annot', content: match[1], note: match[2] })
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < text.length) parts.push({ type: 'text', content: text.slice(lastIdx) })
  return parts
}

function AnnotSpan({ text, note, onRemove }: { text: string; note: string; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline' }}>
      <span
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        style={{
          background: 'rgba(0,180,255,0.13)', borderBottom: '1.5px solid rgba(0,180,255,0.45)',
          color: '#7dd3fc', cursor: 'pointer', padding: '0 1px', borderRadius: 2,
        }}
      >
        {text}
        <span style={{ fontSize: 8, marginLeft: 2, verticalAlign: 'super', color: '#00b4ff' }}>📌</span>
      </span>
      {open && (
        <span
          style={{
            position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, zIndex: 200,
            background: '#0d1626', border: '1px solid rgba(0,180,255,0.25)',
            borderRadius: 7, padding: '7px 10px',
            fontSize: 12, color: '#94a3b8', lineHeight: '1.5',
            whiteSpace: 'normal', width: 210,
            boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
            display: 'flex', flexDirection: 'column', gap: 5,
          }}
          onClick={e => e.stopPropagation()}
        >
          <span>{note}</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { onRemove(); setOpen(false) }}
              style={{ fontSize: 9, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >Remove pin</button>
            <button
              onClick={() => setOpen(false)}
              style={{ fontSize: 9, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 'auto' }}
            >✕</button>
          </span>
        </span>
      )}
    </span>
  )
}

function NotesEditor({
  notes,
  setNotes,
  onSave,
}: {
  notes: string
  setNotes: (v: string) => void
  onSave: (v: string) => void
}) {
  const [mode, setMode] = useState<'view' | 'edit'>(notes ? 'view' : 'edit')
  const [selInfo, setSelInfo] = useState<{ text: string; rect: DOMRect } | null>(null)
  const [annotInput, setAnnotInput] = useState('')
  const [showAnnotInput, setShowAnnotInput] = useState(false)
  const viewRef = useRef<HTMLDivElement>(null)
  const annotInputRef = useRef<HTMLInputElement>(null)

  // Detect text selection in view mode
  useEffect(() => {
    if (mode !== 'view') return
    function onSelChange() {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !viewRef.current) { setSelInfo(null); return }
      if (!viewRef.current.contains(sel.anchorNode)) { setSelInfo(null); return }
      const text = sel.toString().trim()
      if (text.length < 2) { setSelInfo(null); return }
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelInfo({ text, rect })
    }
    document.addEventListener('selectionchange', onSelChange)
    return () => document.removeEventListener('selectionchange', onSelChange)
  }, [mode])

  function handlePinClick() {
    setShowAnnotInput(true)
    setTimeout(() => annotInputRef.current?.focus(), 50)
  }

  function saveAnnotation() {
    if (!selInfo || !annotInput.trim()) return
    const escaped = selInfo.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped)
    const markup = `{{ANNOT:${selInfo.text}||${annotInput.trim()}}}`
    const updated = notes.replace(regex, markup)
    setNotes(updated)
    onSave(updated)
    setSelInfo(null)
    setAnnotInput('')
    setShowAnnotInput(false)
    window.getSelection()?.removeAllRanges()
  }

  function removeAnnotation(phrase: string, note: string) {
    const updated = notes.replace(`{{ANNOT:${phrase}||${note}}}`, phrase)
    setNotes(updated)
    onSave(updated)
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter') return
    const ta = e.currentTarget
    const pos = ta.selectionStart
    const before = notes.slice(0, pos)
    const lastLine = before.split('\n').pop() ?? ''
    if (lastLine.startsWith('- ') && lastLine.length > 2) {
      e.preventDefault()
      const after = notes.slice(pos)
      const updated = before + '\n- ' + after
      setNotes(updated)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = pos + 3
      })
    }
  }

  function renderNotes() {
    if (!notes.trim()) {
      return <p style={{ color: '#334155', fontSize: 13 }}>No notes yet. Tap Edit to add.</p>
    }
    return notes.split('\n').map((line, i) => {
      if (!line) return <div key={i} style={{ height: 6 }} />
      const isBullet = line.startsWith('- ')
      const content = isBullet ? line.slice(2) : line
      const parts = parseAnnotations(content)
      return (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 3 }}>
          {isBullet && <span style={{ color: '#00b4ff', flexShrink: 0, lineHeight: '1.6', fontSize: 14 }}>•</span>}
          <span style={{ fontSize: 13, color: '#94a3b8', lineHeight: '1.65', flex: 1, wordBreak: 'break-word' }}>
            {parts.map((part, j) =>
              part.type === 'annot' ? (
                <AnnotSpan
                  key={j}
                  text={part.content}
                  note={part.note}
                  onRemove={() => removeAnnotation(part.content, part.note)}
                />
              ) : (
                <span key={j}>{part.content}</span>
              )
            )}
          </span>
        </div>
      )
    })
  }

  function switchToView() {
    onSave(notes.trim() || '')
    setMode('view')
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Label + mode toggle */}
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-[0.2em] font-[600]" style={{ color: '#334155' }}>Notes</p>
        <div className="flex items-center gap-3">
          {mode === 'view' && notes && (
            <span className="text-[9px]" style={{ color: '#1e293b' }}>Select text to pin a note</span>
          )}
          <button
            onClick={() => mode === 'view' ? setMode('edit') : switchToView()}
            style={{
              fontSize: 10, fontWeight: 700, color: mode === 'edit' ? '#00b4ff' : '#475569',
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {mode === 'view' ? '✏️ Edit' : '✓ Done'}
          </button>
        </div>
      </div>

      {/* View mode */}
      {mode === 'view' ? (
        <div
          ref={viewRef}
          style={{
            flex: 1, minHeight: 140, padding: '10px 12px',
            background: '#04040a', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, overflowY: 'auto', userSelect: 'text', cursor: 'text',
          }}
          onClick={() => { if (!window.getSelection()?.toString()) setMode('edit') }}
        >
          {renderNotes()}
        </div>
      ) : (
        /* Edit mode */
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={switchToView}
          onKeyDown={handleEditKeyDown}
          rows={8}
          autoFocus
          placeholder={"Add context, links, next steps...\nStart a line with '- ' for bullets"}
          className="flex-1 rounded-lg px-3 py-2.5 text-sm leading-relaxed resize-none outline-none"
          style={{
            background: '#04040a', border: '1px solid rgba(0,180,255,0.3)',
            color: '#94a3b8', minHeight: '140px',
          }}
        />
      )}

      {/* Floating "Pin Note" button on selection */}
      {selInfo && !showAnnotInput && (
        <div
          style={{
            position: 'fixed',
            top: Math.max(10, selInfo.rect.top - 38),
            left: Math.max(10, Math.min(window.innerWidth - 140, selInfo.rect.left + selInfo.rect.width / 2 - 55)),
            zIndex: 300,
          }}
        >
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={handlePinClick}
            style={{
              background: '#00b4ff', color: '#04040a', fontSize: 11, fontWeight: 800,
              padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              boxShadow: '0 3px 14px rgba(0,180,255,0.5)',
              whiteSpace: 'nowrap',
            }}
          >
            📌 Pin Note
          </button>
        </div>
      )}

      {/* Annotation input popup */}
      {showAnnotInput && selInfo && (
        <div
          style={{
            position: 'fixed',
            top: Math.max(10, selInfo.rect.top - 90),
            left: Math.max(10, Math.min(window.innerWidth - 260, selInfo.rect.left + selInfo.rect.width / 2 - 120)),
            width: 250, zIndex: 300,
            background: '#0d1626', border: '1px solid rgba(0,180,255,0.25)',
            borderRadius: 9, padding: '10px 12px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.7)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <p style={{ fontSize: 10, color: '#475569', marginBottom: 7 }}>
            Note for: <span style={{ color: '#7dd3fc' }}>"{selInfo.text.slice(0, 35)}{selInfo.text.length > 35 ? '…' : ''}"</span>
          </p>
          <input
            ref={annotInputRef}
            value={annotInput}
            onChange={e => setAnnotInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveAnnotation()
              if (e.key === 'Escape') { setShowAnnotInput(false); setSelInfo(null); setAnnotInput('') }
            }}
            placeholder="Type your note..."
            style={{
              width: '100%', background: '#04040a',
              border: '1px solid rgba(0,180,255,0.2)',
              borderRadius: 5, padding: '6px 9px',
              color: '#e2e8f0', fontSize: 12, outline: 'none', marginBottom: 8,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={saveAnnotation}
              style={{
                flex: 1, fontSize: 11, fontWeight: 700, padding: '5px 0',
                background: '#00b4ff', color: '#04040a', border: 'none',
                borderRadius: 5, cursor: 'pointer',
              }}
            >Save</button>
            <button
              onClick={() => { setShowAnnotInput(false); setSelInfo(null); setAnnotInput('') }}
              style={{
                flex: 1, fontSize: 11, padding: '5px 0',
                background: 'rgba(255,255,255,0.06)', color: '#8899aa',
                border: 'none', borderRadius: 5, cursor: 'pointer',
              }}
            >Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChatTab({ taskId }: { taskId: string }) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: `/api/tasks/${taskId}/chat` }),
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    const text = input.trim()
    if (!text || status !== 'ready') return
    sendMessage({ text })
    setInput('')
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,180,255,0.1)', border: '1px solid rgba(0,180,255,0.2)' }}>
              <span className="text-sm">W</span>
            </div>
            <p className="text-sm font-[600]" style={{ color: '#475569' }}>Ask Wendy anything about this task</p>
            <p className="text-xs" style={{ color: '#283044' }}>Draft copy, brainstorm strategy, get next steps</p>
          </div>
        )}
        {messages.map(message => (
          <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-[700]"
              style={{
                background: message.role === 'user' ? 'rgba(0,180,255,0.15)' : 'rgba(139,92,246,0.15)',
                border: `1px solid ${message.role === 'user' ? 'rgba(0,180,255,0.3)' : 'rgba(139,92,246,0.3)'}`,
                color: message.role === 'user' ? '#00b4ff' : '#8b5cf6',
              }}
            >
              {message.role === 'user' ? 'B' : 'W'}
            </div>
            <div
              className="flex-1 text-sm leading-relaxed rounded-xl px-4 py-3 min-w-0"
              style={{
                background: message.role === 'user' ? 'rgba(0,180,255,0.07)' : 'rgba(139,92,246,0.06)',
                border: `1px solid ${message.role === 'user' ? 'rgba(0,180,255,0.12)' : 'rgba(139,92,246,0.1)'}`,
                color: '#cbd5e1',
                whiteSpace: 'pre-wrap',
                maxWidth: '85%',
              }}
            >
              {message.parts.map((part, i) =>
                part.type === 'text' ? <span key={i}>{part.text}</span> : null
              )}
            </div>
          </div>
        ))}
        {status === 'submitted' && (
          <div className="flex gap-3">
            <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-[700]" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6' }}>W</div>
            <div className="flex items-center gap-1.5 px-4 py-3 rounded-xl" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)' }}>
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: '#8b5cf6', opacity: 0.6, animation: `breathe 1.2s ease-in-out ${i * 0.2}s infinite`, '--glow-color': '#8b5cf699', '--glow-min': '0px', '--glow-max': '4px' } as React.CSSProperties} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-6 pb-5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={2}
            placeholder="Ask anything or request work... (Enter to send)"
            className="flex-1 rounded-xl px-4 py-3 text-sm resize-none outline-none leading-relaxed"
            style={{ background: '#04040a', border: '1px solid rgba(255,255,255,0.07)', color: '#e2e8f0', caretColor: '#00b4ff' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || status !== 'ready'}
            className="shrink-0 rounded-xl px-4 py-3 text-xs font-[700] transition-all disabled:opacity-30"
            style={{ background: '#8b5cf6', color: '#fff' }}
          >
            ↑
          </button>
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: '#1e293b' }}>Shift+Enter for new line</p>
      </div>
    </div>
  )
}
