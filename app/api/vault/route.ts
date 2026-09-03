import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

// GET /api/vault — all notes, pinned first then newest
export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data, error } = await supabase
    .from('bpe_vault_notes')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/vault — create a note
export async function POST(req: NextRequest) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  if (!body?.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bpe_vault_notes')
    .insert({
      title: body.title.trim(),
      body: typeof body.body === 'string' ? body.body : '',
      category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Reminders',
      pinned: !!body.pinned,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
