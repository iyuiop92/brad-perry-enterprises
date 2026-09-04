'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RedditOppStatus, RedditOpportunity } from '@/lib/types'

const ACCENT = '#00b4ff'
const RADIUS = 10

const SUBREDDITS = [
  'r/hockeyplayers',
  'r/hockeycoaches',
  'r/iceskating',
  'r/womenshockey',
  'r/hockey_parents',
]

const STATUS_COLUMNS: { key: RedditOppStatus; label: string; color: string }[] = [
  { key: 'spotted', label: 'Spotted', color: '#64748b' },
  { key: 'drafted', label: 'Drafted', color: '#a855f7' },
  { key: 'posted', label: 'Posted', color: '#22c55e' },
]

function nextStatus(s: RedditOppStatus): RedditOppStatus | null {
  const i = STATUS_COLUMNS.findIndex((x) => x.key === s)
  return i >= 0 && i < STATUS_COLUMNS.length - 1 ? STATUS_COLUMNS[i + 1].key : null
}
function statusMeta(s: RedditOppStatus) {
  return STATUS_COLUMNS.find((x) => x.key === s) ?? STATUS_COLUMNS[0]
}

const EMPTY = {
  subreddit: SUBREDDITS[0],
  question: '',
  post_url: '',
  context: '',
  draft_reply: '',
}

export default function AnswerBoard() {
  const [items, setItems] = useState<RedditOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/reddit-opportunities')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const map: Record<RedditOppStatus, RedditOpportunity[]> = {
      spotted: [],
      drafted: [],
      posted: [],
    }
    for (const it of items) map[it.status]?.push(it)
    return map
  }, [items])

  const postedToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return items.filter((it) => it.status === 'posted' && (it.posted_at ?? '').slice(0, 10) === today).length
  }, [items])

  async function addOpp() {
    if (!draft.question.trim()) return
    setSaving(true)
    const res = await fetch('/api/reddit-opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    setSaving(false)
    if (res.ok) {
      setDraft({ ...EMPTY })
      await load()
    }
  }

  async function patch(id: string, body: Partial<RedditOpportunity>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...body } : it)))
    await fetch(`/api/reddit-opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
    await fetch(`/api/reddit-opportunities/${id}`, { method: 'DELETE' })
  }

  async function copyDraft(it: RedditOpportunity) {
    try {
      await navigator.clipboard.writeText(it.draft_reply ?? '')
      setCopiedId(it.id)
      window.setTimeout(() => setCopiedId((c) => (c === it.id ? null : c)), 1800)
    } catch {
      // clipboard blocked — no-op, the text is still visible to select manually
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: RADIUS,
    color: '#e2e8f0',
    fontSize: 13,
    padding: '8px 10px',
    outline: 'none',
    fontFamily: 'inherit',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 60px', color: '#e2e8f0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 6,
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>
              Answer real questions
            </h2>
            <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '6px 0 0', maxWidth: 640 }}>
              Log a question people are asking, draft a genuinely helpful reply in your voice, then
              copy it and post it yourself on Reddit. You stay the one who hits post, so your account
              stays safe. No links, no pitch, just help. That is what makes them come find you.
            </p>
          </div>
          <div
            style={{
              flexShrink: 0,
              textAlign: 'center',
              background: 'rgba(0,180,255,0.08)',
              border: `1px solid ${ACCENT}`,
              borderRadius: RADIUS,
              padding: '8px 14px',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT, lineHeight: 1 }}>
              {postedToday}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: '#94a3b8', marginTop: 3 }}>
              POSTED TODAY
            </div>
          </div>
        </div>

        {/* ── Log a question ── */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: RADIUS,
            padding: 16,
            margin: '18px 0 24px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Subreddit</label>
              <select
                value={draft.subreddit}
                onChange={(e) => setDraft({ ...draft, subreddit: e.target.value })}
                style={{ ...inputStyle, appearance: 'none' }}
              >
                {SUBREDDITS.map((s) => (
                  <option key={s} value={s} style={{ background: '#0f172a' }}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>The question</label>
              <input
                value={draft.question}
                onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                placeholder="How do I stop losing the puck on my backhand?"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Thread URL</label>
              <input
                value={draft.post_url}
                onChange={(e) => setDraft({ ...draft, post_url: e.target.value })}
                placeholder="reddit.com/r/..."
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Context — extra detail from the post, if any</label>
            <textarea
              value={draft.context}
              onChange={(e) => setDraft({ ...draft, context: e.target.value })}
              placeholder="Anything that helps you or Ellie draft the right answer."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          <button
            onClick={addOpp}
            disabled={saving || !draft.question.trim()}
            style={{
              background: ACCENT,
              color: '#04040a',
              border: 'none',
              borderRadius: RADIUS,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving || !draft.question.trim() ? 'default' : 'pointer',
              opacity: saving || !draft.question.trim() ? 0.5 : 1,
            }}
          >
            {saving ? 'Adding…' : 'Add question'}
          </button>
        </div>

        {/* ── Columns ── */}
        {loading ? (
          <p style={{ color: '#64748b', fontSize: 13 }}>Loading…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'start' }}>
            {STATUS_COLUMNS.map((col) => (
              <div key={col.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingLeft: 2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 8, background: col.color }} />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#94a3b8',
                    }}
                  >
                    {col.label}
                  </span>
                  <span style={{ fontSize: 11, color: '#475569' }}>{grouped[col.key].length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {grouped[col.key].map((it) => {
                    const isOpen = openId === it.id
                    const advance = nextStatus(it.status)
                    return (
                      <div
                        key={it.id}
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: RADIUS,
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            color: ACCENT,
                            marginBottom: 5,
                          }}
                        >
                          {it.subreddit || 'reddit'}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>{it.question}</div>

                        {it.draft_reply ? (
                          <div
                            style={{
                              fontSize: 12,
                              color: '#cbd5e1',
                              lineHeight: 1.4,
                              marginTop: 6,
                              maxHeight: isOpen ? 'none' : 54,
                              overflow: 'hidden',
                            }}
                          >
                            {it.draft_reply}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11.5, color: '#eab308', marginTop: 6 }}>
                            No draft yet
                          </div>
                        )}

                        <button
                          onClick={() => setOpenId(isOpen ? null : it.id)}
                          style={{
                            marginTop: 8,
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          {isOpen ? 'Hide' : 'Open'}
                        </button>

                        {isOpen && (
                          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {it.context && (
                              <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.4 }}>{it.context}</div>
                            )}
                            <div>
                              <label style={labelStyle}>Draft reply</label>
                              <textarea
                                defaultValue={it.draft_reply}
                                onBlur={(e) => patch(it.id, { draft_reply: e.target.value })}
                                rows={7}
                                placeholder="Write it here, or paste Ellie's draft. Then copy and post it yourself."
                                style={{ ...inputStyle, resize: 'vertical' }}
                              />
                            </div>
                            <button
                              onClick={() => remove(it.id)}
                              style={{
                                alignSelf: 'flex-start',
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => copyDraft(it)}
                            disabled={!it.draft_reply}
                            style={{
                              background: copiedId === it.id ? '#22c55e' : 'rgba(0,180,255,0.12)',
                              border: `1px solid ${copiedId === it.id ? '#22c55e' : ACCENT}`,
                              borderRadius: RADIUS,
                              color: copiedId === it.id ? '#04040a' : ACCENT,
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '5px 10px',
                              cursor: it.draft_reply ? 'pointer' : 'default',
                              opacity: it.draft_reply ? 1 : 0.4,
                            }}
                          >
                            {copiedId === it.id ? 'Copied' : 'Copy draft'}
                          </button>
                          {it.post_url && (
                            <a
                              href={it.post_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: RADIUS,
                                color: '#e2e8f0',
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '5px 10px',
                                textDecoration: 'none',
                              }}
                            >
                              Open thread ↗
                            </a>
                          )}
                          {advance && (
                            <button
                              onClick={() => patch(it.id, { status: advance })}
                              style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: RADIUS,
                                color: '#e2e8f0',
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '5px 10px',
                                cursor: 'pointer',
                              }}
                            >
                              → {statusMeta(advance).label}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {grouped[col.key].length === 0 && (
                    <div
                      style={{
                        border: '1px dashed rgba(255,255,255,0.07)',
                        borderRadius: RADIUS,
                        padding: '14px 10px',
                        fontSize: 11.5,
                        color: '#475569',
                        textAlign: 'center',
                      }}
                    >
                      Empty
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
