import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()

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
