import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import { callAetherContent } from '@/lib/aether-content'

export async function GET() {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    return NextResponse.json(await callAetherContent(''))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load Aether content' }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await request.json()
  const title = String(body.title ?? '').trim()

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  try {
    const data = await callAetherContent('', { method: 'POST', body: JSON.stringify({ ...body, title }) })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create Aether content' }, { status: 502 })
  }
}
