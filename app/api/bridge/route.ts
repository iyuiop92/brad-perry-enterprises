import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireAuth } from '@/lib/require-auth'

const THREAD = 'main'
const BUCKET = 'bridge-uploads'
const MAX_ATTACHMENTS = 8
const MAX_BYTES = 15 * 1024 * 1024 // 15MB per image

// What the DB stores per attachment.
type StoredAttachment = { storage_path: string; mime: string; filename: string }

// What the browser sends per attachment (image bytes as a data URL).
type IncomingAttachment = { data_url?: string; filename?: string; mime?: string }

// GET /api/bridge?since=<iso>  -> messages in the thread, newest activity last.
// Poll this from the dashboard; pass the created_at of the last message you have.
export async function GET(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const since = new URL(request.url).searchParams.get('since')

  let query = supabase
    .from('agent_bridge_messages')
    .select('id, role, target, content, status, error, attachments, created_at')
    .eq('thread', THREAD)
    .order('created_at', { ascending: true })
    .limit(200)

  if (since) query = query.gt('created_at', since)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// Decode a data URL (data:image/png;base64,AAAA...) into bytes + mime.
function decodeDataUrl(dataUrl: string): { bytes: Buffer; mime: string } | null {
  const m = dataUrl.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/)
  if (!m) return null
  const mime = m[1]
  const isBase64 = Boolean(m[2])
  const payload = m[3]
  const bytes = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload))
  return { bytes, mime }
}

function safeName(name: string): string {
  return (name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

// POST /api/bridge  { content, target, attachments? }  -> queues a user message
export async function POST(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => null)
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  const target = body?.target
  const incoming: IncomingAttachment[] = Array.isArray(body?.attachments) ? body.attachments : []

  if (!['claude', 'codex', 'both'].includes(target)) {
    return NextResponse.json({ error: 'target must be claude, codex, or both.' }, { status: 400 })
  }
  if (incoming.length > MAX_ATTACHMENTS) {
    return NextResponse.json({ error: `Too many attachments (max ${MAX_ATTACHMENTS}).` }, { status: 400 })
  }

  // Relax the empty guard: a message is valid if it has text OR at least one image.
  if (!content && incoming.length === 0) {
    return NextResponse.json({ error: 'Message is empty.' }, { status: 400 })
  }

  // Upload each image to the private bucket; collect metadata for the row.
  const stored: StoredAttachment[] = []
  for (const att of incoming) {
    if (typeof att?.data_url !== 'string') {
      return NextResponse.json({ error: 'Each attachment needs a data_url.' }, { status: 400 })
    }
    const decoded = decodeDataUrl(att.data_url)
    if (!decoded) {
      return NextResponse.json({ error: 'Malformed attachment data.' }, { status: 400 })
    }
    if (!decoded.mime.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image attachments are supported.' }, { status: 400 })
    }
    if (decoded.bytes.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 15MB).' }, { status: 400 })
    }

    const filename = safeName(att.filename || 'image')
    const storagePath = `${THREAD}/${randomUUID()}-${filename}`

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, decoded.bytes, { contentType: decoded.mime, upsert: false })

    if (upErr) {
      return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 })
    }

    stored.push({ storage_path: storagePath, mime: decoded.mime, filename })
  }

  const { data, error } = await supabase
    .from('agent_bridge_messages')
    .insert({ thread: THREAD, role: 'user', target, content, attachments: stored, status: 'pending' })
    .select('id, role, target, content, status, error, attachments, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
