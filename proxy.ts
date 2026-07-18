import { NextResponse, type NextRequest } from 'next/server'

const COOKIE_NAME = 'bpe_dashboard_session'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has(COOKIE_NAME)

  // Already signed in and landing on the marketing home page (which is what iOS
  // opens from the home-screen icon) — send straight to the dashboard so Brad
  // never has to re-navigate or re-login.
  if (pathname === '/' && hasSession) {
    const dashUrl = request.nextUrl.clone()
    dashUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashUrl)
  }

  if (pathname.startsWith('/dashboard') && !hasSession) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
}
