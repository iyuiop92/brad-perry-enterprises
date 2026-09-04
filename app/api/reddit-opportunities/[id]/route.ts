import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import type { RedditOppStatus } from '@/lib/types'

export const runtime = 'nodejs'

const STATUSES: RedditOppStatus[] = ['spotted', 'drafted', 'posted']

// PATCH /api/reddit-opportunities/[id] — edit a question or its draft reply
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
  if (typeof body.question === 'string') patch.question = body.question.trim()
  if (typeof body.post_url === 'string') patch.post_url = body.post_url.trim()
  if (typeof body.context === 'string') patch.context = body.context
  if (typeof body.draft_reply === 'string') patch.draft_reply = body.draft_reply
  if (STATUSES.includes(body.status)) {
    patch.status = body.status
    // stamp the moment it goes live so we can track cadence
    patch.posted_at = body.status === 'posted' ? new Date().toISOString() : null
  }
  if (typeof body.sort_order === 'number') patch.sort_order = body.sort_order

  const { data, error } = await supabase
    .from('bpe_reddit_opportunities')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/reddit-opportunities/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await params
  const { error } = await supabase.from('bpe_reddit_opportunities').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
