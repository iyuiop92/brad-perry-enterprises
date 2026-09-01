import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import type { ContentPlatform, ContentStatus, ContentType } from '@/lib/types'

const TYPES: ContentType[] = ['article', 'video', 'social']
const STATUSES: ContentStatus[] = ['idea', 'draft', 'ready', 'scheduled', 'posted']
const PLATFORMS: ContentPlatform[] = [
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'threads',
  'linkedin',
]

// PATCH /api/content/[id] — partial update (status drag, edits, scheduling)
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (typeof body.title === 'string' && body.title.trim()) update.title = body.title.trim()
  if (TYPES.includes(body.content_type)) update.content_type = body.content_type
  if (STATUSES.includes(body.status)) {
    update.status = body.status
    if (body.status === 'posted') update.posted_at = new Date().toISOString()
  }
  if (typeof body.brand === 'string' && body.brand.trim()) update.brand = body.brand.trim()
  if (typeof body.caption === 'string') update.caption = body.caption
  if (Array.isArray(body.platforms)) {
    update.platforms = body.platforms.filter((p: ContentPlatform) => PLATFORMS.includes(p))
  }
  if ('media_url' in body) update.media_url = body.media_url || null
  if ('scheduled_at' in body) update.scheduled_at = body.scheduled_at || null
  if (typeof body.notes === 'string') update.notes = body.notes
  if (typeof body.sort_order === 'number') update.sort_order = body.sort_order

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bpe_content_items')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/content/[id]
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const { error } = await supabase.from('bpe_content_items').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
