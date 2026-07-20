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

  if (body.markPaid) {
    // Fetch current subscription to get billing cycle and current date
    const { data: sub, error: fetchError } = await supabase
      .from('subscriptions')
      .select('billing_cycle, next_billing_date')
      .eq('id', id)
      .single()

    if (fetchError || !sub) {
      return NextResponse.json({ error: fetchError?.message ?? 'Not found' }, { status: 404 })
    }

    const current = new Date(sub.next_billing_date)
    if (sub.billing_cycle === 'annual') {
      current.setFullYear(current.getFullYear() + 1)
    } else {
      current.setMonth(current.getMonth() + 1)
    }
    const nextDate = current.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        next_billing_date: nextDate,
        alert_sent_7d: false,
        alert_sent_1d: false,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  }

  // General update (edit form)
  const { markPaid: _markPaid, ...fields } = body
  const { data, error } = await supabase
    .from('subscriptions')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await params

  const { error } = await supabase.from('subscriptions').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
