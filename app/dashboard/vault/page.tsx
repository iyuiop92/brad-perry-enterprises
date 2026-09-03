'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const ACCENT = '#00b4ff'

const CATEGORY_SUGGESTIONS = ['Words to Live By', 'Content Rules', 'Frameworks', 'Reminders']

type VaultNote = {
  id: string
  title: string
  body: string
  category: string
  pinned: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

const EMPTY: Partial<VaultNote> = { title: '', body: '', category: 'Reminders', pinned: false }

export default function VaultPage() {
  const [notes, setNotes] = useState<VaultNote[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<VaultNote> | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchNotes = useCallback(async () => {
    const res = await fetch('/api/vault')
    if (res.ok) setNotes(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchNotes()
  }, [fetchNotes])

  const save = useCallback(async () => {
    if (!editing?.title?.trim()) return
    setSaving(true)
    const isNew = !editing.id
    const res = await fetch(isNew ? '/api/vault' : `/api/vault/${editing.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editing.title,
        body: editing.body,
        category: editing.category,
        pinned: editing.pinned,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setEditing(null)
      void fetchNotes()
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Save failed' }))
      alert(error || 'Save failed')
    }
  }, [editing, fetchNotes])

  const remove = useCallback(async () => {
    if (!editing?.id) return
    if (!confirm('Delete this note?')) return
    const res = await fetch(`/api/vault/${editing.id}`, { method: 'DELETE' })
    if (res.ok) {
      setEditing(null)
      void fetchNotes()
    }
  }, [editing, fetchNotes])

  const togglePin = useCallback(
    async (note: VaultNote) => {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)))
      await fetch(`/api/vault/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !note.pinned }),
      })
      void fetchNotes()
    },
    [fetchNotes]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, VaultNote[]>()
    for (const n of notes) {
      const key = n.category || 'Reminders'
      const arr = map.get(key) ?? []
      arr.push(n)
      map.set(key, arr)
    }
    return Array.from(map.entries())
  }, [notes])

  return (
    <div style={{ flex: 1, minHeight: 0, padding: 16, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-outfit)', letterSpacing: '0.02em', margin: 0 }}>
            The Vault
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            The things worth remembering. Rules, words to live by, frameworks.
          </p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, background: ACCENT, color: '#000' }}>
          + New
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#64748b', fontSize: 13, padding: 24 }}>Loading…</div>
      ) : notes.length === 0 ? (
        <div style={{ border: '1px dashed rgba(0,180,255,0.15)', borderRadius: 10, padding: 28, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
          The Vault is empty. Hit New to save your first thing worth remembering.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {grouped.map(([category, list]) => (
            <div key={category}>
              <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'var(--font-outfit)' }}>
                {category} ({list.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {list.map((n) => (
                  <div key={n.id} style={{ background: 'rgba(13,13,26,0.7)', border: `1px solid ${n.pinned ? 'rgba(0,180,255,0.35)' : 'rgba(0,180,255,0.12)'}`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                      <button onClick={() => setEditing(n)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 14, fontWeight: 800, color: '#e2e8f0', fontFamily: 'var(--font-outfit)' }}>
                        {n.title}
                      </button>
                      <button onClick={() => void togglePin(n)} title={n.pinned ? 'Unpin' : 'Pin'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: n.pinned ? ACCENT : '#475569', flexShrink: 0 }}>
                        {n.pinned ? '★' : '☆'}
                      </button>
                    </div>
                    {n.body && (
                      <div onClick={() => setEditing(n)} style={{ fontSize: 12.5, color: '#c7ccd6', lineHeight: 1.6, whiteSpace: 'pre-wrap', cursor: 'pointer' }}>
                        {n.body}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditModal editing={editing} setEditing={setEditing} save={save} remove={remove} saving={saving} />
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,180,255,0.15)',
  borderRadius: 8, padding: '9px 11px', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, display: 'block',
}

function EditModal({
  editing, setEditing, save, remove, saving,
}: {
  editing: Partial<VaultNote>
  setEditing: (e: Partial<VaultNote> | null) => void
  save: () => void
  remove: () => void
  saving: boolean
}) {
  const set = (patch: Partial<VaultNote>) => setEditing({ ...editing, ...patch })

  return (
    <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', zIndex: 200, overflow: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: '#0a0a14', border: '1px solid rgba(0,180,255,0.2)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-outfit)', margin: 0 }}>
            {editing.id ? 'Edit note' : 'New note'}
          </h2>
          <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div>
          <label style={labelStyle}>Title</label>
          <input autoFocus value={editing.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="What is this?" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Category</label>
          <input list="vault-categories" value={editing.category ?? ''} onChange={(e) => set({ category: e.target.value })} placeholder="Reminders" style={inputStyle} />
          <datalist id="vault-categories">
            {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div>
          <label style={labelStyle}>Note</label>
          <textarea value={editing.body ?? ''} onChange={(e) => set({ body: e.target.value })} rows={8} placeholder="Write it down…" style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#c7ccd6' }}>
          <input type="checkbox" checked={!!editing.pinned} onChange={(e) => set({ pinned: e.target.checked })} />
          Pin to the top
        </label>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          {editing.id ? (
            <button onClick={remove} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(null)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#94a3b8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button onClick={save} disabled={saving || !editing.title?.trim()} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: ACCENT, color: '#000', fontSize: 12, fontWeight: 800, cursor: saving ? 'default' : 'pointer', opacity: saving || !editing.title?.trim() ? 0.5 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
