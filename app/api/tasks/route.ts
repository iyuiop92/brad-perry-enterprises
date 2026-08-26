import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import { executeAgentAction } from '@/lib/agent-actions'

export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data, error } = await supabase
    .from('bpe_tasks')
    .select('*')
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await request.json()

  try {
    const result = await executeAgentAction({ type: 'task.create', data: body }, { actorId: 'brad', source: 'dashboard', instruction: body.notes })
    return NextResponse.json(result.data, { status: 201 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Task creation failed' }, { status: 400 }) }
}
