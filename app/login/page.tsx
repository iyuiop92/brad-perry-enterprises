'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        window.location.assign('/dashboard')
        return
      }

      const data = await res.json()
      setError(data.error ?? 'Could not sign in.')
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#04040a' }}
    >
      <div
        className="w-full max-w-sm rounded-[10px] p-8 flex flex-col items-center gap-6"
        style={{
          background: '#0d0d1a',
          border: '1px solid rgba(0, 180, 255, 0.13)',
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <span
            className="text-5xl font-[800] tracking-tight"
            style={{ color: '#00b4ff', fontFamily: 'var(--font-outfit)' }}
          >
            BPE
          </span>
          <span
            className="text-sm uppercase tracking-[0.2em]"
            style={{ color: '#64748b' }}
          >
            Command Center
          </span>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs uppercase tracking-wider"
              style={{ color: '#64748b' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter dashboard password"
              autoComplete="current-password"
              className="w-full rounded-[10px] px-4 py-2.5 text-sm outline-none transition-all"
              style={{
                background: '#04040a',
                border: '1px solid rgba(0, 180, 255, 0.13)',
                color: '#e2e8f0',
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = '1px solid rgba(0, 180, 255, 0.5)'
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 180, 255, 0.08)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = '1px solid rgba(0, 180, 255, 0.13)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[10px] py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              background: '#00b4ff',
              color: '#04040a',
            }}
          >
            {loading ? 'Entering...' : 'Enter Dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}
