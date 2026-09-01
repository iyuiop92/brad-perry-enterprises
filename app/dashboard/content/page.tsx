'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ContentItem,
  ContentPlatform,
  ContentStatus,
  ContentType,
} from '@/lib/types'

const ACCENT = '#00b4ff'

const STATUS_COLUMNS: { key: ContentStatus; label: string; color: string }[] = [
  { key: 'idea', label: 'Idea', color: '#64748b' },
  { key: 'draft', label: 'Draft', color: '#a855f7' },
  { key: 'ready', label: 'Ready', color: '#eab308' },
  { key: 'scheduled', label: 'Scheduled', color: ACCENT },
  { key: 'posted', label: 'Posted', color: '#22c55e' },
]

const TYPES: { key: ContentType; label: string; color: string }[] = [
  { key: 'social', label: 'Social', color: ACCENT },
  { key: 'video', label: 'Video', color: '#a855f7' },
  { key: 'article', label: 'Article', color: '#22c55e' },
]

const PLATFORMS: { key: ContentPlatform; label: string }[] = [
  { key: 'instagram', label: 'IG' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'facebook', label: 'FB' },
  { key: 'threads', label: 'Threads' },
  { key: 'linkedin', label: 'LinkedIn' },
]

const EMPTY: Partial<ContentItem> = {
  title: '',
  content_type: 'social',
  status: 'idea',
  brand: 'aether',
  caption: '',
  platforms: [],
  media_url: '',
  scheduled_at: null,
  notes: '',
}

function typeMeta(t: ContentType) {
  return TYPES.find((x) => x.key === t) ?? TYPES[0]
}
function statusMeta(s: ContentStatus) {
  return STATUS_COLUMNS.find((x) => x.key === s) ?? STATUS_COLUMNS[0]
}

// yyyy-mm-dd in Phoenix time, for grouping onto calendar days
function phoenixDayKey(iso: string | null): string | null {
  if (!iso) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}

function shortTime(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

// value for <input type="datetime-local"> from an ISO string (Phoenix local)
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`
}

// datetime-local (Phoenix wall time) back to an ISO string. Phoenix is UTC-7, no DST.
function fromLocalInput(local: string): string | null {
  if (!local) return null
  return new Date(`${local}:00-07:00`).toISOString()
}

export default function ContentBoardPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'pipeline' | 'calendar'>('pipeline')
  const [editing, setEditing] = useState<Partial<ContentItem> | null>(null)
  const [saving, setSaving] = useState(false)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return { y: now.getFullYear(), m: now.getMonth() } // m is 0-based
  })

  const fetchItems = useCallback(async () => {
    const res = await fetch('/api/content')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  const save = useCallback(async () => {
    if (!editing?.title?.trim()) return
    setSaving(true)
    const isNew = !editing.id
    const payload = {
      title: editing.title,
      content_type: editing.content_type,
      status: editing.status,
      brand: editing.brand,
      caption: editing.caption,
      platforms: editing.platforms,
      media_url: editing.media_url,
      scheduled_at: editing.scheduled_at,
      notes: editing.notes,
    }
    const res = await fetch(isNew ? '/api/content' : `/api/content/${editing.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      setEditing(null)
      void fetchItems()
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Save failed' }))
      alert(error || 'Save failed')
    }
  }, [editing, fetchItems])

  const remove = useCallback(async () => {
    if (!editing?.id) return
    if (!confirm('Delete this item? This cannot be undone.')) return
    const res = await fetch(`/api/content/${editing.id}`, { method: 'DELETE' })
    if (res.ok) {
      setEditing(null)
      void fetchItems()
    }
  }, [editing, fetchItems])

  const setStatus = useCallback(
    async (item: ContentItem, status: ContentStatus) => {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status } : i)))
      await fetch(`/api/content/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      void fetchItems()
    },
    [fetchItems]
  )

  const byStatus = useMemo(() => {
    const map: Record<ContentStatus, ContentItem[]> = {
      idea: [], draft: [], ready: [], scheduled: [], posted: [],
    }
    for (const it of items) map[it.status]?.push(it)
    return map
  }, [items])

  return (
    <div style={{ flex: 1, minHeight: 0, padding: '16px', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-outfit)', letterSpacing: '0.02em', margin: 0 }}>
            Content Command
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            Every article, video, and post in one place. Plan it, schedule it, ship it.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'rgba(13,13,26,0.6)', borderRadius: 8, padding: 3, border: '1px solid rgba(0,180,255,0.1)' }}>
            {(['pipeline', 'calendar'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
                  background: view === v ? ACCENT : 'transparent',
                  color: view === v ? '#000' : '#94a3b8',
                }}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => setEditing({ ...EMPTY })}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, background: ACCENT, color: '#000' }}>
            + New
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#64748b', fontSize: 13, padding: 24 }}>Loading…</div>
      ) : view === 'pipeline' ? (
        <PipelineView byStatus={byStatus} onOpen={setEditing} onSetStatus={setStatus} />
      ) : (
        <CalendarView items={items} month={month} setMonth={setMonth} onOpen={setEditing} />
      )}

      {editing && (
        <EditModal
          editing={editing}
          setEditing={setEditing}
          save={save}
          remove={remove}
          saving={saving}
        />
      )}
    </div>
  )
}

function TypeBadge({ type }: { type: ContentType }) {
  const m = typeMeta(type)
  return (
    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: m.color, background: `${m.color}22`, padding: '2px 6px', borderRadius: 4 }}>
      {m.label}
    </span>
  )
}

function PlatformChips({ platforms }: { platforms: ContentPlatform[] }) {
  if (!platforms?.length) return null
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {platforms.map((p) => (
        <span key={p} style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3 }}>
          {PLATFORMS.find((x) => x.key === p)?.label ?? p}
        </span>
      ))}
    </div>
  )
}

function Card({ item, onOpen }: { item: ContentItem; onOpen: (i: ContentItem) => void }) {
  return (
    <button onClick={() => onOpen(item)}
      style={{
        textAlign: 'left', width: '100%', cursor: 'pointer',
        background: 'rgba(13,13,26,0.8)', border: '1px solid rgba(0,180,255,0.12)',
        borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6,
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>{item.title}</span>
        <TypeBadge type={item.content_type} />
      </div>
      <PlatformChips platforms={item.platforms} />
      {item.scheduled_at && (
        <span style={{ fontSize: 10, color: ACCENT, fontWeight: 700 }}>
          {phoenixDayKey(item.scheduled_at)} · {shortTime(item.scheduled_at)}
        </span>
      )}
    </button>
  )
}

function PipelineView({
  byStatus, onOpen, onSetStatus,
}: {
  byStatus: Record<ContentStatus, ContentItem[]>
  onOpen: (i: ContentItem) => void
  onSetStatus: (i: ContentItem, s: ContentStatus) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
      {STATUS_COLUMNS.map((col) => {
        const list = byStatus[col.key]
        return (
          <div key={col.key} style={{ width: 260, flexShrink: 0, background: 'rgba(13,13,26,0.6)', border: '1px solid rgba(0,180,255,0.1)', borderRadius: 10, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid rgba(0,180,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: col.color }} />
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: col.color, fontFamily: 'var(--font-outfit)' }}>{col.label}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: col.color, background: `${col.color}22`, padding: '1px 7px', borderRadius: 99 }}>{list.length}</span>
            </div>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60 }}>
              {list.length === 0 ? (
                <div style={{ border: '1px dashed rgba(0,180,255,0.15)', borderRadius: 10, padding: 12, textAlign: 'center', fontSize: 11, color: '#475569' }}>Nothing here</div>
              ) : (
                list.map((item) => (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Card item={item} onOpen={onOpen} />
                    <select
                      value={item.status}
                      onChange={(e) => onSetStatus(item, e.target.value as ContentStatus)}
                      style={{ fontSize: 10, background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '3px 6px', cursor: 'pointer' }}>
                      {STATUS_COLUMNS.map((s) => (
                        <option key={s.key} value={s.key}>Move to {s.label}</option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CalendarView({
  items, month, setMonth, onOpen,
}: {
  items: ContentItem[]
  month: { y: number; m: number }
  setMonth: (m: { y: number; m: number }) => void
  onOpen: (i: ContentItem) => void
}) {
  const first = new Date(month.y, month.m, 1)
  const startWeekday = first.getDay() // 0 Sun
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate()
  const monthLabel = first.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const grouped = useMemo(() => {
    const map: Record<string, ContentItem[]> = {}
    for (const it of items) {
      const key = phoenixDayKey(it.scheduled_at)
      if (!key) continue
      ;(map[key] ??= []).push(it)
    }
    return map
  }, [items])

  const unscheduled = items.filter((i) => !i.scheduled_at)

  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prev = () => setMonth(month.m === 0 ? { y: month.y - 1, m: 11 } : { y: month.y, m: month.m - 1 })
  const next = () => setMonth(month.m === 11 ? { y: month.y + 1, m: 0 } : { y: month.y, m: month.m + 1 })

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button onClick={prev} style={navBtn}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-outfit)', minWidth: 160, textAlign: 'center' }}>{monthLabel}</span>
        <button onClick={next} style={navBtn}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 4px' }}>{d}</div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e${idx}`} />
          const key = `${month.y}-${pad(month.m + 1)}-${pad(day)}`
          const dayItems = grouped[key] ?? []
          return (
            <div key={key} style={{ minHeight: 92, background: 'rgba(13,13,26,0.5)', border: '1px solid rgba(0,180,255,0.08)', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>{day}</span>
              {dayItems.map((it) => {
                const m = typeMeta(it.content_type)
                return (
                  <button key={it.id} onClick={() => onOpen(it)}
                    style={{ textAlign: 'left', cursor: 'pointer', background: `${m.color}1f`, border: `1px solid ${m.color}55`, borderRadius: 5, padding: '3px 5px', fontSize: 10, color: '#e2e8f0', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {shortTime(it.scheduled_at)} {it.title}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {unscheduled.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Unscheduled ({unscheduled.length})</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {unscheduled.map((it) => (
              <div key={it.id} style={{ width: 220 }}><Card item={it} onOpen={onOpen} /></div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
  background: 'rgba(13,13,26,0.6)', border: '1px solid rgba(0,180,255,0.15)',
  color: ACCENT, fontSize: 18, lineHeight: 1,
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
  editing: Partial<ContentItem>
  setEditing: (e: Partial<ContentItem> | null) => void
  save: () => void
  remove: () => void
  saving: boolean
}) {
  const set = (patch: Partial<ContentItem>) => setEditing({ ...editing, ...patch })
  const platforms = editing.platforms ?? []
  const togglePlatform = (p: ContentPlatform) =>
    set({ platforms: platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p] })

  return (
    <div
      onClick={() => setEditing(null)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', zIndex: 200, overflow: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 540, background: '#0a0a14', border: '1px solid rgba(0,180,255,0.2)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-outfit)', margin: 0 }}>
            {editing.id ? 'Edit content' : 'New content'}
          </h2>
          <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div>
          <label style={labelStyle}>Title</label>
          <input autoFocus value={editing.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="What is this piece?" style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Type</label>
            <select value={editing.content_type ?? 'social'} onChange={(e) => set({ content_type: e.target.value as ContentType })} style={inputStyle}>
              {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Status</label>
            <select value={editing.status ?? 'idea'} onChange={(e) => set({ status: e.target.value as ContentStatus })} style={inputStyle}>
              {STATUS_COLUMNS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Brand</label>
            <input value={editing.brand ?? ''} onChange={(e) => set({ brand: e.target.value })} placeholder="aether" style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Platforms</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PLATFORMS.map((p) => {
              const on = platforms.includes(p.key)
              return (
                <button key={p.key} onClick={() => togglePlatform(p.key)}
                  style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, border: `1px solid ${on ? ACCENT : 'rgba(255,255,255,0.1)'}`, background: on ? `${ACCENT}22` : 'transparent', color: on ? ACCENT : '#94a3b8' }}>
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Caption / body</label>
          <textarea value={editing.caption ?? ''} onChange={(e) => set({ caption: e.target.value })} rows={5} placeholder="The post copy or article draft…" style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Media URL</label>
            <input value={editing.media_url ?? ''} onChange={(e) => set({ media_url: e.target.value })} placeholder="Mux / image link" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Scheduled (Phoenix)</label>
            <input type="datetime-local" value={toLocalInput(editing.scheduled_at ?? null)} onChange={(e) => set({ scheduled_at: fromLocalInput(e.target.value) })} style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <input value={editing.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Anything to remember" style={inputStyle} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          {editing.id ? (
            <button onClick={remove} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(null)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#94a3b8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button onClick={save} disabled={saving || !editing.title?.trim()}
              style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: ACCENT, color: '#000', fontSize: 12, fontWeight: 800, cursor: saving ? 'default' : 'pointer', opacity: saving || !editing.title?.trim() ? 0.5 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
