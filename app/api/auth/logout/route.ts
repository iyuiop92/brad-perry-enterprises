import { NextResponse } from 'next/server'
import { getDashboardCookieOptions } from '@/lib/password-auth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    ...getDashboardCookieOptions(),
    value: '',
    maxAge: 0,
  })

  return response
}
