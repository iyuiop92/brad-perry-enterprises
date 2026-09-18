import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireAuth } from '@/lib/require-auth'
import type { ContentAttachment } from '@/lib/types'

const BUCKET = 'content-attachments'
const MAX_BYTES = 50 * 1024 * 1024

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'attachment'
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id: contentId } = await ctx.params
  const body = await req.json().catch(() => null)
  const action = body?.action

  if (action === 'sign') {
    const filename = typeof body.filename === 'string' ? body.filename.trim() : ''
    const mime = typeof body.mime === 'string' && body.mime ? body.mime : 'application/octet-stream'
    const size = typeof body.size === 'number' ? body.size : 0
    if (!filename || size < 1 || size > MAX_BYTES) {
      return NextResponse.json({ error: 'Choose a file up to 50 MB.' }, { status: 400 })
    }

    const attachmentId = randomUUID()
    const storage_path = `${contentId}/${attachmentId}-${safeName(filename)}`
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storage_path)
    if (error || !data) return NextResponse.json({ error: error?.message || 'Could not prepare upload.' }, { status: 500 })

    return NextResponse.json({
      path: storage_path,
      token: data.token,
      attachment: { id: attachmentId, filename: filename.slice(0, 160), mime, size, storage_path },
    })
  }

  if (action === 'complete') {
    const attachment = body.attachment as ContentAttachment | undefined
    if (!attachment || !isUuid(attachment.id) || typeof attachment.filename !== 'string' || typeof attachment.mime !== 'string' || typeof attachment.size !== 'number' || !attachment.storage_path.startsWith(`${contentId}/${attachment.id}-`)) {
      return NextResponse.json({ error: 'Invalid attachment.' }, { status: 400 })
    }
    const objectName = attachment.storage_path.slice(contentId.length + 1)
    const { data: objects, error: objectError } = await supabase.storage.from(BUCKET).list(contentId, { search: objectName })
    const object = objects?.find((item) => item.name === objectName)
    if (objectError || !object) {
      return NextResponse.json({ error: 'Uploaded file was not found.' }, { status: 400 })
    }
    const { data: item, error: readError } = await supabase.from('bpe_content_items').select('attachments').eq('id', contentId).single()
    if (readError || !item) return NextResponse.json({ error: readError?.message || 'Content card not found.' }, { status: 404 })
    const storedAttachment: ContentAttachment = {
      ...attachment,
      size: typeof object.metadata?.size === 'number' ? object.metadata.size : attachment.size,
      mime: typeof object.metadata?.mimetype === 'string' ? object.metadata.mimetype : attachment.mime,
    }
    const attachments = Array.isArray(item.attachments) ? item.attachments as ContentAttachment[] : []
    const { error } = await supabase.from('bpe_content_items').update({ attachments: [...attachments, storedAttachment] }).eq('id', contentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ attachments: [...attachments, storedAttachment] })
  }

  return NextResponse.json({ error: 'Unknown attachment action.' }, { status: 400 })
}
