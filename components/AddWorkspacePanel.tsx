'use client'

import { useState } from 'react'

const COLORS = [
  '#00b4ff', '#22c55e', '#f59e0b', '#ef4444',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
]

const inputStyle = {
  background: '#04040a',
  border: '1px solid rgba(0,180,255,0.13)',
  color: '#e2e8f0',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13,
  width: '100%',
  outline: 'none',
} as React.CSSProperties

const labelStyle = {
  color: '#64748b',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  marginBottom: 4,
  display: 'block',
}

export default function AddWorkspacePanel({
  onClose,
  onAdded,
}: {
  onClose: () => void
  onAdded: () => void
}) {
  const [name, setName]   = useState('')
  const [url, setUrl]     = useState('')
  const [type, setType]   = useState<'brand' | 'client'>('brand')
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), type, url: url.trim() || null, color }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Something went wrong')
      setSaving(false)
      return
    }
    onAdded()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0a0f1a', border: '1px solid rgba(0,180,255,0.15)',
          borderRadius: 14, padding: 28, width: 400, maxWidth: '90vw',
          boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(0,180,255,0.05)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: '#00b4ff', fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
            New Panel
          </p>
          <h2 style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 800, margin: '4px 0 0' }}>
            Add Workspace
          </h2>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="AetherHockey, Client Site, etc."
              autoFocus
              required
            />
          </div>

          <div>
            <label style={labelStyle}>URL</label>
            <input
              style={inputStyle}
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com"
              type="url"
            />
          </div>

          <div>
            <label style={labelStyle}>Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['brand', 'client'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'capitalize',
                    background: type === t ? 'rgba(0,180,255,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${type === t ? 'rgba(0,180,255,0.4)' : 'rgba(255,255,255,0.07)'}`,
                    color: type === t ? '#00b4ff' : '#64748b',
                    transition: 'all 0.15s',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                    background: c, border: `2px solid ${color === c ? '#fff' : 'transparent'}`,
                    boxShadow: color === c ? `0 0 10px ${c}` : 'none',
                    transition: 'all 0.15s',
                  }}
                />
              ))}
            </div>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                color: '#64748b', fontSize: 13, fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              style={{
                flex: 2, padding: '9px 0', borderRadius: 8, cursor: 'pointer',
                background: '#00b4ff', border: 'none',
                color: '#04040a', fontSize: 13, fontWeight: 800,
                opacity: saving || !name.trim() ? 0.5 : 1,
                boxShadow: '0 0 16px rgba(0,180,255,0.4)',
                transition: 'opacity 0.15s',
              }}
            >
              {saving ? 'Creating...' : 'Create Panel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
