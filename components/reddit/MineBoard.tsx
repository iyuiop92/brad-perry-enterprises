'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ContentPlatform, RedditEngineItem, RedditStatus } from '@/lib/types'

const ACCENT = '#00b4ff'
const RADIUS = 10

const SUBREDDITS = [
  'r/hockeyplayers',
  'r/hockeycoaches',
  'r/iceskating',
  'r/womenshockey',
  'r/hockey_parents',
]

const STATUS_COLUMNS: { key: RedditStatus; label: string; color: string }[] = [
  { key: 'idea', label: 'Mined', color: '#64748b' },
  { key: 'scripted', label: 'Scripted', color: '#a855f7' },
  { key: 'shot', label: 'Shot', color: '#eab308' },
  { key: 'posted', label: 'Posted', color: '#22c55e' },
]

const ALL_PLATFORMS: ContentPlatform[] = [
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'threads',
  'linkedin',
]

function statusMeta(s: RedditStatus) {
  return STATUS_COLUMNS.find((x) => x.key === s) ?? STATUS_COLUMNS[0]
}

function nextStatus(s: RedditStatus): RedditStatus | null {
  const i = STATUS_COLUMNS.findIndex((x) => x.key === s)
  return i >= 0 && i < STATUS_COLUMNS.length - 1 ? STATUS_COLUMNS[i + 1].key : null
}

const EMPTY = {
  subreddit: SUBREDDITS[0],
  post_title: '',
  post_url: '',
  signal: '',
  video_topic: '',
  script: '',
}

export default function MineBoard() {
  const [items, setItems] = useState<RedditEngineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/reddit-engine')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const map: Record<RedditStatus, RedditEngineItem[]> = {
      idea: [],
      scripted: [],
      shot: [],
      posted: [],
    }
    for (const it of items) map[it.status]?.push(it)
    return map
  }, [items])

  async function addPost() {
    if (!draft.post_title.trim()) return
    setSaving(true)
    const res = await fetch('/api/reddit-engine', {
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

  async function patch(id: string, body: Partial<RedditEngineItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...body } : it)))
    await fetch(`/api/reddit-engine/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
    await fetch(`/api/reddit-engine/${id}`, { method: 'DELETE' })
  }

  // Hand the winning topic to the shared content pipeline (all 6 platforms)
  async function cutForAll(it: RedditEngineItem) {
    const title = (it.video_topic || it.post_title).trim()
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content_type: 'video',
        status: 'idea',
        brand: 'aether',
        platforms: ALL_PLATFORMS,
        caption: it.script || '',
        notes: `From Reddit ${it.subreddit}: ${it.post_title}\n${it.post_url}\n\nSignal: ${it.signal}`,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      await patch(it.id, { content_id: created.id ?? null })
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
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '18px 20px 60px',
        color: '#e2e8f0',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 6 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>
            Mine winners into content
          </h2>
          <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '6px 0 0', maxWidth: 620 }}>
            Paste a winning post and the comment driving it. The machine holds the topic, the
            script, and the status so you never run out of Reddit material. When one wins, cut it
            for all six platforms.
          </p>
        </div>

        {/* ── Mine a post ── */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: RADIUS,
            padding: 16,
            margin: '18px 0 24px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 1fr 1fr',
              gap: 12,
              marginBottom: 12,
            }}
          >
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
              <label style={labelStyle}>Winning post title</label>
              <input
                value={draft.post_title}
                onChange={(e) => setDraft({ ...draft, post_title: e.target.value })}
                placeholder="At what point does equipment matter?"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Post URL</label>
              <input
                value={draft.post_url}
                onChange={(e) => setDraft({ ...draft, post_url: e.target.value })}
                placeholder="reddit.com/r/..."
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Signal — top comment or the argument</label>
              <textarea
                value={draft.signal}
                onChange={(e) => setDraft({ ...draft, signal: e.target.value })}
                placeholder="The comment or debate that tells you what people want next."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Video topic it generated</label>
              <textarea
                value={draft.video_topic}
                onChange={(e) => setDraft({ ...draft, video_topic: e.target.value })}
                placeholder="The angle you'll film to answer it."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </div>
          <button
            onClick={addPost}
            disabled={saving || !draft.post_title.trim()}
            style={{
              background: ACCENT,
              color: '#04040a',
              border: 'none',
              borderRadius: RADIUS,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving || !draft.post_title.trim() ? 'default' : 'pointer',
              opacity: saving || !draft.post_title.trim() ? 0.5 : 1,
            }}
          >
            {saving ? 'Mining…' : 'Mine into topic'}
          </button>
        </div>

        {/* ── Columns ── */}
        {loading ? (
          <p style={{ color: '#64748b', fontSize: 13 }}>Loading…</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              alignItems: 'start',
            }}
          >
            {STATUS_COLUMNS.map((col) => (
              <div key={col.key}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                    paddingLeft: 2,
                  }}
                >
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
                          {it.subreddit}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            lineHeight: 1.35,
                            marginBottom: it.video_topic ? 6 : 0,
                          }}
                        >
                          {it.post_title}
                        </div>
                        {it.video_topic && (
                          <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
                            → {it.video_topic}
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
                          {isOpen ? 'Hide' : 'Details'}
                        </button>

                        {isOpen && (
                          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {it.post_url && (
                              <a
                                href={it.post_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 11.5, color: ACCENT, wordBreak: 'break-all' }}
                              >
                                Open post ↗
                              </a>
                            )}
                            <div>
                              <label style={labelStyle}>Signal</label>
                              <textarea
                                defaultValue={it.signal}
                                onBlur={(e) => patch(it.id, { signal: e.target.value })}
                                rows={3}
                                style={{ ...inputStyle, resize: 'vertical' }}
                              />
                            </div>
                            <div>
                              <label style={labelStyle}>Video topic</label>
                              <textarea
                                defaultValue={it.video_topic}
                                onBlur={(e) => patch(it.id, { video_topic: e.target.value })}
                                rows={2}
                                style={{ ...inputStyle, resize: 'vertical' }}
                              />
                            </div>
                            <div>
                              <label style={labelStyle}>Script</label>
                              <textarea
                                defaultValue={it.script}
                                onBlur={(e) => patch(it.id, { script: e.target.value })}
                                rows={5}
                                placeholder="Wendy drops the 60-sec script here."
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
                          {it.content_id ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#22c55e',
                                padding: '5px 4px',
                              }}
                            >
                              ✓ In pipeline
                            </span>
                          ) : (
                            <button
                              onClick={() => cutForAll(it)}
                              style={{
                                background: 'rgba(0,180,255,0.12)',
                                border: `1px solid ${ACCENT}`,
                                borderRadius: RADIUS,
                                color: ACCENT,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '5px 10px',
                                cursor: 'pointer',
                              }}
                            >
                              Cut for all 6
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
