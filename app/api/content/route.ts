import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import type { ContentPlatform, ContentStatus, ContentType } from '@/lib/types'

const TYPES: ContentType[] = ['article', 'video', 'social']
const STATUSES: ContentStatus[] = ['idea', 'draft', 'ready', 'scheduled', 'posted']
const PLATFORMS: ContentPlatform[] = [
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'threads',
  'linkedin',
]

// GET /api/content — every content item, newest first
export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data, error } = await supabase
    .from('bpe_content_items')
    .select('*')
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/content — create a new item
export async function POST(req: NextRequest) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  if (!body?.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const content_type: ContentType = TYPES.includes(body.content_type)
    ? body.content_type
    : 'social'
  const status: ContentStatus = STATUSES.includes(body.status) ? body.status : 'idea'
  const platforms: ContentPlatform[] = Array.isArray(body.platforms)
    ? body.platforms.filter((p: ContentPlatform) => PLATFORMS.includes(p))
    : []

  const { data, error } = await supabase
    .from('bpe_content_items')
    .insert({
      title: body.title.trim(),
      content_type,
      status,
      brand: typeof body.brand === 'string' && body.brand.trim() ? body.brand.trim() : 'aether',
      requested_by: typeof body.requested_by === 'string' && body.requested_by.trim() ? body.requested_by.trim() : null,
      caption: typeof body.caption === 'string' ? body.caption : '',
      platforms,
      media_url: typeof body.media_url === 'string' && body.media_url.trim() ? body.media_url.trim() : null,
      scheduled_at: body.scheduled_at || null,
      notes: typeof body.notes === 'string' ? body.notes : '',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
