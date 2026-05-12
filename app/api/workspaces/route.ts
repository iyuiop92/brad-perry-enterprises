import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

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
