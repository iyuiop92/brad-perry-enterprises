import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import type { RedditStatus } from '@/lib/types'

export const runtime = 'nodejs'

const STATUSES: RedditStatus[] = ['idea', 'scripted', 'shot', 'posted']

// GET /api/reddit-engine — every mined post, newest first
export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data, error } = await supabase
    .from('bpe_reddit_engine')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/reddit-engine — mine a winning post into a video topic
export async function POST(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => null)
  const subreddit = String(body?.subreddit ?? '').trim()
  const post_title = String(body?.post_title ?? '').trim()

  if (!post_title) {
    return NextResponse.json({ error: 'Post title is required' }, { status: 400 })
  }

  const status: RedditStatus = STATUSES.includes(body?.status) ? body.status : 'idea'

  const { data, error } = await supabase
    .from('bpe_reddit_engine')
    .insert({
      subreddit,
      post_title,
      post_url: String(body?.post_url ?? '').trim(),
      signal: String(body?.signal ?? ''),
      video_topic: String(body?.video_topic ?? ''),
      script: String(body?.script ?? ''),
      status,
      sort_order: Number(body?.sort_order ?? 0),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
