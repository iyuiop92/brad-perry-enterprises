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

export async function POST(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { name, type, url, color } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const { data: existing } = await supabase
    .from('bpe_workspaces')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  const sortOrder = (existing?.[0]?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from('bpe_workspaces')
    .insert({ name: name.trim(), slug, color: color ?? '#00b4ff', type: type ?? 'brand', url: url || null, sort_order: sortOrder })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
