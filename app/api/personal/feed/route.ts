import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data, error } = await supabase
    .from('bpe_feed_messages')
    .select('id, role, content, metadata, created_at')
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => ({}))

  if (body.all) {
    const { error } = await supabase
      .from('bpe_feed_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.id) {
    const { error } = await supabase
      .from('bpe_feed_messages')
      .delete()
      .eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'id or all required' }, { status: 400 })
}
