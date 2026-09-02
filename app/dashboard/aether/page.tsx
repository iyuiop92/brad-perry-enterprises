'use client'

import { useCallback, useEffect, useState } from 'react'

const ACCENT = '#00b4ff'
const AETHER_ADMIN = 'https://www.aetherhockey.com'

type Pulse = {
  updated_at: string
  members: { total: number; free: number; paid: number; comped: number; player: number; coach: number; business: number }
  new_signups_7d: number
  est_mrr: number
  unread_member_messages: number
  ask_coach_7d: number
  latest_signups: { full_name: string | null; email: string | null; tier: string | null; created_at: string }[]
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso))
}

export default function AetherSpokePage() {
  const [pulse, setPulse] = useState<Pulse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/aether/pulse')
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to load')
      }
      setPulse(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div style={{ flex: 1, minHeight: 0, padding: 16, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` }} />
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-outfit)', letterSpacing: '0.02em', margin: 0 }}>
              Aether Hockey
            </h1>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            Live pulse, read straight from the shared database. First spoke on the hub.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {pulse && (
            <span style={{ fontSize: 11, color: '#475569' }}>Updated {fmtDate(pulse.updated_at)}</span>
          )}
          <button onClick={() => void load()} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(0,180,255,0.2)', background: 'transparent', color: ACCENT, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#64748b', fontSize: 13, padding: 24 }}>Reading Aether…</div>
      ) : error ? (
        <div style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: 16, color: '#fca5a5', fontSize: 13 }}>
          {error}
        </div>
      ) : pulse ? (
        <>
          {/* Top stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
            <Stat label="Paying members" value={pulse.members.paid} accent />
            <Stat label="Est. MRR" value={`$${pulse.est_mrr.toLocaleString()}`} accent />
            <Stat label="Comped" value={pulse.members.comped} />
            <Stat label="Total members" value={pulse.members.total} />
            <Stat label="New signups · 7d" value={pulse.new_signups_7d} />
            <Stat label="Needs your reply" value={pulse.unread_member_messages} alert={pulse.unread_member_messages > 0} />
            <Stat label="Ask Coach · 7d" value={pulse.ask_coach_7d} />
          </div>

          {/* Member mix */}
          <div style={{ background: 'rgba(13,13,26,0.6)', border: '1px solid rgba(0,180,255,0.1)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Member mix</div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <MixItem label="Free" value={pulse.members.free} />
              <MixItem label="Player" value={pulse.members.player} />
              <MixItem label="Coach" value={pulse.members.coach} />
              <MixItem label="Business" value={pulse.members.business} />
            </div>
          </div>

          {/* Latest signups */}
          <div style={{ background: 'rgba(13,13,26,0.6)', border: '1px solid rgba(0,180,255,0.1)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Latest signups</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pulse.latest_signups.length === 0 ? (
                <span style={{ fontSize: 12, color: '#475569' }}>No members yet.</span>
              ) : (
                pulse.latest_signups.map((m, i) => (
                  <div key={m.email ?? i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name || m.email || 'Unknown'}</div>
                      {m.full_name && m.email && (
                        <div style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: m.tier && m.tier !== 'free' ? ACCENT : '#64748b', background: m.tier && m.tier !== 'free' ? `${ACCENT}22` : 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 4 }}>{m.tier || 'free'}</span>
                      <span style={{ fontSize: 11, color: '#475569' }}>{fmtDate(m.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Jump to Aether admin */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <LinkOut href={`${AETHER_ADMIN}/admin/members`} label="Members" />
            <LinkOut href={`${AETHER_ADMIN}/admin/comms`} label="Broadcasts" />
            <LinkOut href={`${AETHER_ADMIN}/admin/revenue`} label="Revenue" />
            <LinkOut href={`${AETHER_ADMIN}/admin/video-reviews`} label="Video reviews" />
          </div>
        </>
      ) : null}
    </div>
  )
}

function Stat({ label, value, accent, alert }: { label: string; value: string | number; accent?: boolean; alert?: boolean }) {
  const color = alert ? '#f59e0b' : accent ? ACCENT : '#e2e8f0'
  return (
    <div style={{ background: 'rgba(13,13,26,0.7)', border: `1px solid ${alert ? 'rgba(245,158,11,0.3)' : 'rgba(0,180,255,0.12)'}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'var(--font-outfit)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function MixItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0', fontFamily: 'var(--font-outfit)' }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

function LinkOut({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
      {label} ↗
    </a>
  )
}
