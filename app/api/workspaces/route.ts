import { NextResponse, NextRequest } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export async function GET(request: NextRequest) {
  const wendySecret = request.headers.get('x-wendy-secret')
  const isWendy = wendySecret && wendySecret === process.env.WENDY_SECRET

  let supabase
  if (isWendy) {
    const { createAdminClient } = await import('@/lib/supabase-admin')
    supabase = createAdminClient()
  } else {
    const auth = await requireAuth()
    if (auth.unauthorized) return auth.unauthorized
    supabase = auth.supabase
  }

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

export async function DELETE(request: NextRequest) {
  const wendySecret = request.headers.get('x-wendy-secret')
  const isWendy = wendySecret && wendySecret === process.env.WENDY_SECRET

  let supabase
  if (isWendy) {
    const { createAdminClient } = await import('@/lib/supabase-admin')
    supabase = createAdminClient()
  } else {
    const auth = await requireAuth()
    if (auth.unauthorized) return auth.unauthorized
    supabase = auth.supabase
  }

  const { slug } = await request.json()
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 })

  // Find workspace first
  const { data: ws } = await supabase
    .from('bpe_workspaces')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  // Null out workspace_id on any attached tasks
  await supabase
    .from('bpe_tasks')
    .update({ workspace_id: null })
    .eq('workspace_id', ws.id)

  // Now delete the workspace
  const { error } = await supabase
    .from('bpe_workspaces')
    .delete()
    .eq('id', ws.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
