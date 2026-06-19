import { NextResponse } from 'next/server'
import {
  createDashboardSessionValue,
  getDashboardCookieOptions,
  isPasswordAuthConfigured,
  verifyDashboardPassword,
} from '@/lib/password-auth'

export async function POST(request: Request) {
  const { password } = await request.json()

  if (!isPasswordAuthConfigured()) {
    return NextResponse.json(
      { error: 'Password login is not configured.' },
      { status: 500 }
    )
  }

  if (!verifyDashboardPassword(String(password ?? ''))) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    ...getDashboardCookieOptions(),
    value: createDashboardSessionValue(),
  })

  return response
}
