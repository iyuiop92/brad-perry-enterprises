import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

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
  const { supabase, unauthorized } = await requireAuth()
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

  const { data, error } = await supabase
    .from('bpe_video_ideas')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data?.[0]) {
    return NextResponse.json({ error: 'Video idea not found' }, { status: 404 })
  }

  return NextResponse.json(data[0])
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await params
  const { error } = await supabase
    .from('bpe_video_ideas')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
