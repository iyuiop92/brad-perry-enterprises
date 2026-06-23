import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data, error } = await supabase
    .from('bpe_video_ideas')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await request.json()
  const title = String(body.title ?? '').trim()

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bpe_video_ideas')
    .insert({
      title,
      status: body.status ?? 'idea',
      social_media: body.social_media ?? '',
      free_tier: body.free_tier ?? '',
      paid_tier: body.paid_tier ?? '',
      notes: body.notes ?? '',
      research_notes: body.research_notes ?? '',
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
