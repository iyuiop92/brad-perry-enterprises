import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const { supabase, unauthorized } = await requireAuth(); if (unauthorized) return unauthorized
  const { searchParams } = new URL(request.url)
  let query = supabase.from('agent_action_audit_log').select('*').order('created_at', { ascending: false }).limit(Math.min(Number(searchParams.get('limit') ?? 100), 250))
  if (searchParams.get('actor')) query = query.eq('actor_id', searchParams.get('actor')!)
  if (searchParams.get('action')) query = query.eq('action_type', searchParams.get('action')!)
  if (searchParams.get('success')) query = query.eq('success', searchParams.get('success') === 'true')
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
