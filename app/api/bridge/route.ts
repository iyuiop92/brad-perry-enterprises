import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

const THREAD = 'main'

// GET /api/bridge?since=<iso>  -> messages in the thread, newest activity last.
// Poll this from the dashboard; pass the created_at of the last message you have.
export async function GET(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const since = new URL(request.url).searchParams.get('since')

  let query = supabase
    .from('agent_bridge_messages')
    .select('id, role, target, content, status, error, created_at')
    .eq('thread', THREAD)
    .order('created_at', { ascending: true })
    .limit(200)

  if (since) query = query.gt('created_at', since)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// POST /api/bridge  { content, target }  -> queues a user message for the worker
export async function POST(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => null)
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  const target = body?.target

  if (!content) {
    return NextResponse.json({ error: 'Message is empty.' }, { status: 400 })
  }
  if (!['claude', 'codex', 'both'].includes(target)) {
    return NextResponse.json({ error: 'target must be claude, codex, or both.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('agent_bridge_messages')
    .insert({ thread: THREAD, role: 'user', target, content, status: 'pending' })
    .select('id, role, target, content, status, error, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
