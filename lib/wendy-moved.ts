import { NextResponse } from 'next/server'

export function legacyWendyResponse(agent: unknown) {
  return agent === 'wendy' ? NextResponse.json({ error: 'Wendy now uses the persistent Command Room. Reload the dashboard to continue with her saved business conversation.', destination: '/dashboard' }, { status: 409 }) : null
}
