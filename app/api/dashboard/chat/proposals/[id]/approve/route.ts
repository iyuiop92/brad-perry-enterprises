import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import { actorScope } from '@/lib/dashboard-chat'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, unauthorized } = await requireAuth(); if (unauthorized) return unauthorized
  const actor = await actorScope(); if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { data } = await supabase.from('bpe_chat_action_proposals').select('id, status, conversation:bpe_chat_conversations!inner(actor_scope)').eq('id', id).maybeSingle()
  if (!data || (data.conversation as any)?.actor_scope !== actor) return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 })
  if (data.status !== 'pending') return NextResponse.json({ error: 'Proposal is not pending.' }, { status: 409 })
  const { error } = await supabase.from('bpe_chat_action_proposals').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', id)
  return error ? NextResponse.json({ error: 'Unable to record approval.' }, { status: 500 }) : NextResponse.json({ ok: true, execution: 'disabled' })
}
