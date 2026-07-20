'use client'
import { useState, useEffect, useRef } from 'react'

const SECTION_KEYS = ['WORKOUT', 'FOOD', 'FOCUS', 'SCHEDULE', 'HEALTH CHECK', 'AFFIRMATION'] as const
type SectionKey = typeof SECTION_KEYS[number]

const todayKey = () => `bpe_brief_${new Date().toISOString().slice(0, 10)}`

function parseSections(text: string): Partial<Record<SectionKey, string>> {
  const out: Partial<Record<SectionKey, string>> = {}
  let cur: SectionKey | null = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if ((SECTION_KEYS as readonly string[]).includes(line)) {
      cur = line as SectionKey
      out[cur] = ''
    } else if (cur && line && !line.startsWith('—')) {
      out[cur] = out[cur] ? `${out[cur]}\n${line}` : line
    }
  }
  return out
}

export default function MorningBrief() {
  const [brief, setBrief]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState(false)
  const initialized             = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const cached = localStorage.getItem(todayKey())
    if (cached) {
      setBrief(cached)
      return
    }

    setLoading(true)
    fetch('/api/dashboard/brief', { method: 'POST' })
      .then(r => r.json())
      .then(({ text }: { text: string }) => {
        setBrief(text)
        localStorage.setItem(todayKey(), text)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function regenerate() {
    localStorage.removeItem(todayKey())
    setBrief('')
    setLoading(true)
    setExpanded(true)
    fetch('/api/dashboard/brief', { method: 'POST' })
      .then(r => r.json())
      .then(({ text }: { text: string }) => {
        setBrief(text)
        localStorage.setItem(todayKey(), text)
      })
      .catch(() => setBrief(''))
      .finally(() => setLoading(false))
  }

  const sections = parseSections(brief)
  const hasContent = Object.keys(sections).length > 0
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })

  return (
    <div
      style={{
        flexShrink: 0,
        position: 'relative',
        zIndex: 15,
        background: 'rgba(3,5,8,0.98)',
        borderBottom: `1px solid rgba(0,180,255,${expanded ? '0.09' : '0.05'})`,
        transition: 'border-color 0.2s',
      }}
    >
      {/* ── Collapsed strip ── */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 10,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* pulse icon */}
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            flexShrink: 0,
            background: 'rgba(0,180,255,0.06)',
            border: `1px solid rgba(0,180,255,${loading ? '0.4' : '0.16'})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: loading ? '0 0 10px rgba(0,180,255,0.2)' : 'none',
            transition: 'all 0.3s',
          }}
        >
          <span style={{ fontSize: 9, color: '#00b4ff' }}>✦</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#00b4ff', letterSpacing: '0.15em' }}>
              BRIEF
            </span>
            <span style={{ fontSize: 9, color: '#1e293b', letterSpacing: '0.04em' }}>{today}</span>
            {loading && (
              <span style={{ fontSize: 8, color: '#00b4ff', opacity: 0.5 }}>generating...</span>
            )}
          </div>
          {!expanded && hasContent && sections['WORKOUT'] && (
            <p
              style={{
                fontSize: 9,
                color: '#334155',
                marginTop: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 520,
              }}
            >
              {sections['WORKOUT']!.split('\n')[0]}
            </p>
          )}
        </div>

        {/* regen */}
        {hasContent && (
          <button
            onClick={e => { e.stopPropagation(); regenerate() }}
            title="Regenerate today's brief"
            style={{
              fontSize: 13,
              color: '#1e293b',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#00b4ff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#1e293b')}
          >
            ↺
          </button>
        )}

        <span style={{ fontSize: 10, color: '#1e293b', marginLeft: 2 }}>
          {expanded ? '↑' : '↓'}
        </span>
      </div>

      {/* ── Expanded content ── */}
      {expanded && (
        <div style={{ padding: '0 20px 14px' }}>
          {loading && !hasContent && (
            <div style={{ display: 'flex', gap: 5, paddingBottom: 10 }}>
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#00b4ff',
                    boxShadow: '0 0 6px rgba(0,180,255,0.5)',
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          )}

          {hasContent && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Data sections grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                  gap: 8,
                }}
              >
                {SECTION_KEYS.filter(k => k !== 'AFFIRMATION').map(key => {
                  const content = sections[key]
                  if (!content) return null
                  return (
                    <div
                      key={key}
                      style={{
                        background: 'rgba(255,255,255,0.018)',
                        border: '1px solid rgba(255,255,255,0.042)',
                        borderRadius: 7,
                        padding: '9px 11px',
                      }}
                    >
                      <p
                        style={{
                          fontSize: 7,
                          fontWeight: 800,
                          color: '#00b4ff',
                          letterSpacing: '0.2em',
                          marginBottom: 5,
                        }}
                      >
                        {key}
                      </p>
                      <p
                        style={{
                          fontSize: 10,
                          color: '#64748b',
                          lineHeight: 1.65,
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {content}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Affirmation — full width, styled for reading aloud */}
              {sections['AFFIRMATION'] && (
                <div
                  style={{
                    background: 'rgba(0,180,255,0.03)',
                    border: '1px solid rgba(0,180,255,0.08)',
                    borderRadius: 7,
                    padding: '14px 16px',
                  }}
                >
                  <p
                    style={{
                      fontSize: 7,
                      fontWeight: 800,
                      color: '#00b4ff',
                      letterSpacing: '0.2em',
                      marginBottom: 10,
                    }}
                  >
                    I AM BRAD PERRY
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: '#94a3b8',
                      lineHeight: 2,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {sections['AFFIRMATION']}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
