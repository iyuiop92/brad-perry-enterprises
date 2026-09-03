import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import type { RedditStatus } from '@/lib/types'

export const runtime = 'nodejs'

const STATUSES: RedditStatus[] = ['idea', 'scripted', 'shot', 'posted']

// PATCH /api/reddit-engine/[id] — edit a mined post
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.subreddit === 'string') patch.subreddit = body.subreddit.trim()
  if (typeof body.post_title === 'string') patch.post_title = body.post_title.trim()
  if (typeof body.post_url === 'string') patch.post_url = body.post_url.trim()
  if (typeof body.signal === 'string') patch.signal = body.signal
  if (typeof body.video_topic === 'string') patch.video_topic = body.video_topic
  if (typeof body.script === 'string') patch.script = body.script
  if (STATUSES.includes(body.status)) patch.status = body.status
  if (typeof body.content_id === 'string' || body.content_id === null) patch.content_id = body.content_id
  if (typeof body.sort_order === 'number') patch.sort_order = body.sort_order

  const { data, error } = await supabase
    .from('bpe_reddit_engine')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/reddit-engine/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await params
  const { error } = await supabase.from('bpe_reddit_engine').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
