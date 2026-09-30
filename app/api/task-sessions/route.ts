import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data, error } = await supabase
    .from('bpe_task_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await request.json()
  const { data, error } = await supabase
    .from('bpe_task_sessions')
    .insert({
      task_id: body.task_id,
      mode: body.mode,
      planned_minutes: body.planned_minutes,
      started_at: body.started_at,
      ended_at: body.ended_at,
      duration_seconds: body.duration_seconds,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
