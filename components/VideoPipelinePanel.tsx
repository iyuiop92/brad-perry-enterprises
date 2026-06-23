'use client'

import { useEffect, useMemo, useState } from 'react'
import type { VideoIdea, VideoIdeaStatus } from '@/lib/types'

const statusOptions: { value: VideoIdeaStatus; label: string; color: string }[] = [
  { value: 'idea', label: 'Idea', color: '#94a3b8' },
  { value: 'research', label: 'Research', color: '#38bdf8' },
  { value: 'planned', label: 'Planned', color: '#a78bfa' },
  { value: 'filmed', label: 'Filmed', color: '#22c55e' },
  { value: 'edited', label: 'Edited', color: '#f59e0b' },
  { value: 'published', label: 'Published', color: '#10b981' },
]

const emptyDraft = {
  title: '',
  social_media: '',
  free_tier: '',
  paid_tier: '',
  notes: '',
  research_notes: '',
}

function statusColor(status: VideoIdeaStatus) {
  return statusOptions.find(option => option.value === status)?.color ?? '#94a3b8'
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  rows?: number
}) {
  return (
    <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <span style={{ color: '#64748b', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          minWidth: 0,
          borderRadius: 5,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.22)',
          color: '#dbeafe',
          padding: '9px 10px',
          outline: 'none',
          resize: 'vertical',
          fontSize: 12,
          lineHeight: 1.45,
        }}
      />
    </label>
  )
}

export default function VideoPipelinePanel() {
  const [videos, setVideos] = useState<VideoIdea[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [status, setStatus] = useState<VideoIdeaStatus>('idea')
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadVideos() {
    const res = await fetch('/api/video-ideas')
    if (!res.ok) return
    const data: VideoIdea[] = await res.json()
    setVideos(data)
    if (!selectedId && data[0]) {
      selectVideo(data[0])
    }
  }

  useEffect(() => {
    void loadVideos()
  }, [])

  function selectVideo(video: VideoIdea) {
    setSelectedId(video.id)
    setStatus(video.status)
    setDraft({
      title: video.title,
      social_media: video.social_media ?? '',
      free_tier: video.free_tier ?? '',
      paid_tier: video.paid_tier ?? '',
      notes: video.notes ?? '',
      research_notes: video.research_notes ?? '',
    })
  }

  function resetDraft() {
    setSelectedId(null)
    setStatus('idea')
    setDraft(emptyDraft)
  }

  async function saveVideo() {
    const title = draft.title.trim()
    if (!title || saving) return
    setSaving(true)
    try {
      const body = JSON.stringify({ ...draft, title, status })
      const res = await fetch(selectedId ? `/api/video-ideas/${selectedId}` : '/api/video-ideas', {
        method: selectedId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!res.ok) return
      const saved: VideoIdea = await res.json()
      setVideos(current => {
        const exists = current.some(video => video.id === saved.id)
        return exists
          ? current.map(video => video.id === saved.id ? saved : video)
          : [saved, ...current]
      })
      selectVideo(saved)
    } finally {
      setSaving(false)
    }
  }

  const filteredVideos = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return videos
    return videos.filter(video => [
      video.title,
      video.social_media,
      video.free_tier,
      video.paid_tier,
      video.notes,
      video.research_notes,
    ].join(' ').toLowerCase().includes(term))
  }, [query, videos])

  const selected = videos.find(video => video.id === selectedId)
  const plannedCount = videos.filter(video => video.status !== 'idea' && video.status !== 'published').length
  const socialReady = videos.filter(video => video.social_media.trim()).length
  const paidReady = videos.filter(video => video.paid_tier.trim()).length

  return (
    <section
      style={{
        borderRadius: 5,
        border: '1px solid rgba(70,125,245,0.18)',
        background: `
          radial-gradient(circle at 8% 0%, rgba(70,125,245,0.18), transparent 34%),
          radial-gradient(circle at 92% 20%, rgba(34,197,94,0.12), transparent 32%),
          linear-gradient(180deg, rgba(8,16,29,0.92), rgba(5,8,14,0.84))
        `,
        overflow: 'hidden',
        boxShadow: '0 18px 60px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.045)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 850, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f8fafc' }}>Video pipeline</p>
          <p style={{ marginTop: 3, fontSize: 11, color: '#8fa0b7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {videos.length} ideas · {plannedCount} moving · {socialReady} social hooks · {paidReady} paid lessons
          </p>
        </div>
        <button
          onClick={resetDraft}
          style={{
            height: 32,
            padding: '0 12px',
            borderRadius: 5,
            border: '1px solid rgba(56,189,248,0.32)',
            background: 'rgba(56,189,248,0.10)',
            color: '#38bdf8',
            fontSize: 11,
            fontWeight: 850,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          New video
        </button>
      </div>

      <div className="dashboard-video-pipeline-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.82fr) minmax(0, 1.18fr)', minHeight: 430 }}>
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', minWidth: 0 }}>
          <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search titles, tiers, notes..."
              style={{
                width: '100%',
                minWidth: 0,
                height: 36,
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(0,0,0,0.22)',
                color: '#f8fafc',
                padding: '0 10px',
                outline: 'none',
                fontSize: 12,
              }}
            />
          </div>
          <div style={{ maxHeight: 468, overflow: 'auto', padding: 8, display: 'grid', gap: 7 }}>
            {filteredVideos.map(video => {
              const active = video.id === selectedId
              const color = statusColor(video.status)
              return (
                <button
                  key={video.id}
                  onClick={() => selectVideo(video)}
                  style={{
                    width: '100%',
                    display: 'grid',
                    gap: 7,
                    textAlign: 'left',
                    borderRadius: 5,
                    border: `1px solid ${active ? color : 'rgba(255,255,255,0.07)'}`,
                    background: active ? `${color}14` : 'rgba(255,255,255,0.025)',
                    padding: '9px 10px',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ color: '#f8fafc', fontSize: 12, fontWeight: 850, lineHeight: 1.25 }}>
                    {video.title}
                  </span>
                  <span style={{ color, fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {video.status} {video.paid_tier ? '· paid' : video.free_tier ? '· free' : video.social_media ? '· social' : ''}
                  </span>
                </button>
              )
            })}
            {!filteredVideos.length && (
              <p style={{ color: '#64748b', fontSize: 12, padding: 8 }}>No video ideas match that search.</p>
            )}
          </div>
        </div>

        <div style={{ minWidth: 0, padding: 14, display: 'grid', gap: 12, alignContent: 'start' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 132px', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
              <span style={{ color: '#64748b', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Title</span>
              <input
                value={draft.title}
                onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
                placeholder="Video title..."
                style={{
                  width: '100%',
                  minWidth: 0,
                  height: 38,
                  borderRadius: 5,
                  border: '1px solid rgba(70,125,245,0.22)',
                  background: 'rgba(0,0,0,0.24)',
                  color: '#f8fafc',
                  padding: '0 11px',
                  outline: 'none',
                  fontSize: 12,
                  fontWeight: 750,
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: '#64748b', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Status</span>
              <select
                value={status}
                onChange={event => setStatus(event.target.value as VideoIdeaStatus)}
                style={{
                  width: '100%',
                  height: 38,
                  borderRadius: 5,
                  border: `1px solid ${statusColor(status)}44`,
                  background: 'rgba(0,0,0,0.32)',
                  color: '#f8fafc',
                  padding: '0 9px',
                  outline: 'none',
                  fontSize: 12,
                }}
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="dashboard-video-tier-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <Field
              label="Social"
              value={draft.social_media}
              onChange={value => setDraft(current => ({ ...current, social_media: value }))}
              placeholder="Short hook, clip, caption, what to show fast..."
              rows={5}
            />
            <Field
              label="Free"
              value={draft.free_tier}
              onChange={value => setDraft(current => ({ ...current, free_tier: value }))}
              placeholder="What they get after signup..."
              rows={5}
            />
            <Field
              label="Paid"
              value={draft.paid_tier}
              onChange={value => setDraft(current => ({ ...current, paid_tier: value }))}
              placeholder="Deeper lesson, drills, progressions, member-only cuts..."
              rows={5}
            />
          </div>

          <Field
            label="Shot notes"
            value={draft.notes}
            onChange={value => setDraft(current => ({ ...current, notes: value }))}
            placeholder="Angles, slow motion, glass view, common mistakes, teaching points..."
            rows={5}
          />

          <Field
            label="Research"
            value={draft.research_notes}
            onChange={value => setDraft(current => ({ ...current, research_notes: value }))}
            placeholder="Most-viewed reference videos, what they miss, how Brad’s version improves it..."
            rows={3}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={saveVideo}
              disabled={!draft.title.trim() || saving}
              style={{
                height: 34,
                padding: '0 13px',
                borderRadius: 5,
                border: '1px solid rgba(34,197,94,0.35)',
                background: 'rgba(34,197,94,0.12)',
                color: '#22c55e',
                fontSize: 11,
                fontWeight: 900,
                cursor: !draft.title.trim() || saving ? 'default' : 'pointer',
                opacity: !draft.title.trim() || saving ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving...' : selected ? 'Save video' : 'Add video'}
            </button>
            {selected && (
              <span style={{ color: '#64748b', fontSize: 11 }}>
                Editing: {selected.title}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
