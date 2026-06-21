import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params

  const body = await request.json()

  const { data, error } = await supabase
    .from('bpe_tasks')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const updatedTask = Array.isArray(data) ? data[0] : data
  if (!updatedTask) {
    return NextResponse.json({ error: 'Task not found or no rows updated' }, { status: 404 })
  }

  return NextResponse.json(updatedTask)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params

  const { error } = await supabase.from('bpe_tasks').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
