import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

const WENDY_SECRET = process.env.WENDY_SECRET

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-wendy-secret')
  if (!WENDY_SECRET || secret !== WENDY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  if (!body.title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('bpe_tasks')
    .insert({
      title: body.title,
      notes: body.notes ?? null,
      status: body.status ?? 'idea',
      type: body.type ?? 'internal',
      brand: body.brand ?? null,
      owner: 'brad',
      phase: body.phase ?? null,
      priority: body.priority ?? null,
      deliverables: body.deliverables ?? [],
      handoff_checklist: body.handoff_checklist ?? [],
      sort_order: 0,
      workspace_id: body.workspace_id ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, task: data }, { status: 201 })
}
