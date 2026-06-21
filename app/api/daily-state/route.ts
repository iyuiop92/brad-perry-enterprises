import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

type RecurringItem = { id: string; label: string; done: boolean }

const DEFAULT_RECURRING_ITEMS: RecurringItem[] = [
  { id: 'bp', label: 'Blood pressure', done: false },
  { id: 'food', label: 'Log food', done: false },
  { id: 'workout', label: 'Workout or walk', done: false },
  { id: 'calendar', label: 'Check calendar', done: false },
  { id: 'money', label: 'Money/client follow-up', done: false },
]

function phoenixDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

async function ensureDailyState(supabase: NonNullable<Awaited<ReturnType<typeof requireAuth>>['supabase']>) {
  const stateDate = phoenixDate()

  const { data: existing, error: selectError } = await supabase
    .from('bpe_daily_state')
    .select('*')
    .eq('state_date', stateDate)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing) return existing

  const { data, error } = await supabase
    .from('bpe_daily_state')
    .insert({
      state_date: stateDate,
      recurring_items: DEFAULT_RECURRING_ITEMS,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const data = await ensureDailyState(supabase)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load daily state' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const current = await ensureDailyState(supabase)
    const body = await request.json()

    const patch = {
      tomorrow_focus_task_id: body.tomorrow_focus_task_id ?? current.tomorrow_focus_task_id ?? null,
      closeout_note: body.closeout_note ?? current.closeout_note ?? '',
      calendar_items: body.calendar_items ?? current.calendar_items ?? [],
      recurring_items: body.recurring_items ?? current.recurring_items ?? DEFAULT_RECURRING_ITEMS,
    }

    const { data, error } = await supabase
      .from('bpe_daily_state')
      .update(patch)
      .eq('id', current.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save daily state' },
      { status: 500 }
    )
  }
}
