import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('next_billing_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await request.json()

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      service: body.service,
      cost_cents: body.cost_cents,
      billing_cycle: body.billing_cycle,
      next_billing_date: body.next_billing_date,
      billing_url: body.billing_url ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
