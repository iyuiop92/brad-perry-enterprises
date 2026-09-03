import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

// PATCH /api/vault/[id] — edit or pin/unpin
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (typeof body.title === 'string' && body.title.trim()) update.title = body.title.trim()
  if (typeof body.body === 'string') update.body = body.body
  if (typeof body.category === 'string' && body.category.trim()) update.category = body.category.trim()
  if (typeof body.pinned === 'boolean') update.pinned = body.pinned
  if (typeof body.sort_order === 'number') update.sort_order = body.sort_order

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bpe_vault_notes')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/vault/[id]
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const { error } = await supabase.from('bpe_vault_notes').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
