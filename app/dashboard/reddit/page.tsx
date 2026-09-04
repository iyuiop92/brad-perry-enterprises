'use client'

import { useState } from 'react'
import AnswerBoard from '@/components/reddit/AnswerBoard'
import MineBoard from '@/components/reddit/MineBoard'

const ACCENT = '#00b4ff'
const RADIUS = 10

type Mode = 'answer' | 'mine'

const MODES: { key: Mode; label: string; sub: string }[] = [
  { key: 'answer', label: 'Answer', sub: 'Reply to real questions' },
  { key: 'mine', label: 'Mine', sub: 'Winners into content' },
]

export default function RedditHubPage() {
  const [mode, setMode] = useState<Mode>('answer')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Mode toggle ── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 20px 0',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', margin: 0, color: '#e2e8f0' }}>
          Reddit Hub
        </h1>
        <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
          {MODES.map((m) => {
            const active = m.key === mode
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                title={m.sub}
                style={{
                  background: active ? ACCENT : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: RADIUS,
                  color: active ? '#04040a' : '#94a3b8',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '6px 14px',
                  cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {mode === 'answer' ? <AnswerBoard /> : <MineBoard />}
    </div>
  )
}
