'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
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
        {/* Monogram */}
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

        {sent ? (
          <div className="text-center flex flex-col gap-2">
            <p className="font-semibold" style={{ color: '#e2e8f0' }}>
              Check your email
            </p>
            <p className="text-sm" style={{ color: '#64748b' }}>
              We sent a magic link to <span style={{ color: '#00b4ff' }}>{email}</span>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs uppercase tracking-wider"
                style={{ color: '#64748b' }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
