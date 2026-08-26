import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import { executeAgentAction } from '@/lib/agent-actions'

export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const [{ data: workspaces }, { data: tasks }] = await Promise.all([
    supabase.from('bpe_workspaces').select('*').order('sort_order'),
    supabase.from('bpe_tasks').select('workspace_id, status, priority'),
  ])

  const enriched = (workspaces ?? []).map((ws) => {
    const wt = (tasks ?? []).filter((t) => t.workspace_id === ws.id)
    return {
      ...ws,
      task_count:   wt.length,
      active_count: wt.filter((t) => t.status === 'in_progress').length,
      blocked_count: wt.filter((t) => t.status === 'blocked').length,
      idea_count:   wt.filter((t) => t.status === 'idea').length,
    }
  })

  return NextResponse.json(enriched)
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { name, type, url, color } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  try {
    const result = await executeAgentAction({ type: 'workspace.create', data: { name, type: type ?? 'brand', color: color ?? '#00b4ff', url: url || null } }, { actorId: 'brad', source: 'dashboard' })
    return NextResponse.json(result.data, { status: 201 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Workspace creation failed' }, { status: 400 }) }
}
