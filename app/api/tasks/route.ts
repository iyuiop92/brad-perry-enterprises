import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bpe_tasks')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const body = await request.json()

  const { data, error } = await supabase
    .from('bpe_tasks')
    .insert({
      title: body.title,
      notes: body.notes ?? null,
      status: body.status ?? 'idea',
      type: body.type ?? 'internal',
      brand: body.brand ?? null,
      owner: body.owner ?? 'brad',
      phase: body.phase ?? null,
      deliverables: body.deliverables ?? [],
      handoff_checklist: body.handoff_checklist ?? [],
      sort_order: body.sort_order ?? 0,
      workspace_id: body.workspace_id ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
