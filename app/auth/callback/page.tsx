'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const supabase = createClient()

    async function handle() {
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          router.replace(searchParams.get('next') ?? '/dashboard')
          return
        }
      }

      // Implicit flow: Supabase puts tokens in the hash fragment
      const hash = window.location.hash.slice(1)
      if (hash) {
        const p = new URLSearchParams(hash)
        const accessToken = p.get('access_token')
        const refreshToken = p.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!error) {
            router.replace(searchParams.get('next') ?? '/dashboard')
            return
          }
        }
      }

      // OTP flow: token_hash + type in query params
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as 'email' | 'signup' | 'invite' | 'recovery' | 'email_change',
        })
        if (!error) {
          router.replace(searchParams.get('next') ?? '/dashboard')
          return
        }
      }

      router.replace('/login?error=auth_error')
    }

    handle()
  }, [router, searchParams])

  return (
    <div
      style={{
        background: '#04040a',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <p style={{ color: '#64748b', fontFamily: 'var(--font-outfit)', fontSize: '14px' }}>
        Signing you in...
      </p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  )
}
