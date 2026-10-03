import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import { callAetherContent } from '@/lib/aether-content'

const allowedFields = [
  'title',
  'status',
  'social_media',
  'free_tier',
  'paid_tier',
  'notes',
  'research_notes',
  'sort_order',
] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await params
  const body = await request.json()
  const patch: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (field in body) patch[field] = body[field]
  }

  if ('title' in patch && !String(patch.title ?? '').trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 })
  }

  try {
    return NextResponse.json(await callAetherContent(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update Aether content' }, { status: 502 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await params
  return NextResponse.json({ error: 'Deletion is not available through the Aether integration' }, { status: 405 })
}
