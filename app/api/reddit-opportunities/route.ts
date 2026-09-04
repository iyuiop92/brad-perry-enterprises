import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import type { RedditOppStatus } from '@/lib/types'

export const runtime = 'nodejs'

const STATUSES: RedditOppStatus[] = ['spotted', 'drafted', 'posted']

// GET /api/reddit-opportunities — questions to answer, newest first
export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data, error } = await supabase
    .from('bpe_reddit_opportunities')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/reddit-opportunities — log a question Brad can answer
export async function POST(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => null)
  const question = String(body?.question ?? '').trim()

  if (!question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  }

  const status: RedditOppStatus = STATUSES.includes(body?.status) ? body.status : 'spotted'

  const { data, error } = await supabase
    .from('bpe_reddit_opportunities')
    .insert({
      subreddit: String(body?.subreddit ?? '').trim(),
      question,
      post_url: String(body?.post_url ?? '').trim(),
      context: String(body?.context ?? ''),
      draft_reply: String(body?.draft_reply ?? ''),
      status,
      sort_order: Number(body?.sort_order ?? 0),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
