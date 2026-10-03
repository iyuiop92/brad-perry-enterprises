import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import type { ContentAttachment } from '@/lib/types'

const BUCKET = 'content-attachments'

async function findAttachment(contentId: string, attachmentId: string) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return { unauthorized }
  const { data, error } = await supabase.from('bpe_content_items').select('attachments').eq('id', contentId).single()
  const attachments = Array.isArray(data?.attachments) ? data.attachments as ContentAttachment[] : []
  return { supabase, error, attachments, attachment: attachments.find((item) => item.id === attachmentId) }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; attachmentId: string }> }) {
  const { id, attachmentId } = await ctx.params
  const result = await findAttachment(id, attachmentId)
  if ('unauthorized' in result) return result.unauthorized
  if (result.error || !result.attachment) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 })
  const { data, error } = await result.supabase!.storage.from(BUCKET).createSignedUrl(result.attachment.storage_path, 60, { download: result.attachment.filename })
  if (error || !data) return NextResponse.json({ error: error?.message || 'Download failed.' }, { status: 500 })
  return NextResponse.redirect(data.signedUrl)
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; attachmentId: string }> }) {
  const { id, attachmentId } = await ctx.params
  const result = await findAttachment(id, attachmentId)
  if ('unauthorized' in result) return result.unauthorized
  if (result.error || !result.attachment) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 })
  const { error: storageError } = await result.supabase!.storage.from(BUCKET).remove([result.attachment.storage_path])
  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 })
  const attachments = result.attachments.filter((item) => item.id !== attachmentId)
  const { error } = await result.supabase!.from('bpe_content_items').update({ attachments }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attachments })
}
