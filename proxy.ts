import { NextResponse, type NextRequest } from 'next/server'

const COOKIE_NAME = 'bpe_dashboard_session'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/dashboard') && !request.cookies.has(COOKIE_NAME)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
