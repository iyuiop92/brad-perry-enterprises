import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export const runtime = 'nodejs'

type Item = { text: string; done: boolean }

function phoenixDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const g = (t: string) => parts.find((p) => p.type === t)?.value
  return `${g('year')}-${g('month')}-${g('day')}`
}

const EMPTY: Item[] = [
  { text: '', done: false },
  { text: '', done: false },
  { text: '', done: false },
]

function cleanItems(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return EMPTY
  const items = raw
    .slice(0, 6)
    .map((r) => ({
      text: typeof (r as Item)?.text === 'string' ? (r as Item).text : '',
      done: !!(r as Item)?.done,
    }))
  return items.length ? items : EMPTY
}

// GET /api/big-three — today's three (creates the row if missing)
export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const day = phoenixDate()
  const { data: existing } = await supabase
    .from('bpe_big_three')
    .select('day, items, updated_at')
    .eq('day', day)
    .maybeSingle()

  if (existing) return NextResponse.json(existing)

  const { data, error } = await supabase
    .from('bpe_big_three')
    .insert({ day, items: EMPTY })
    .select('day, items, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/big-three — save today's three
export async function PATCH(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const day = phoenixDate()
  const items = cleanItems(body.items)

  const { data, error } = await supabase
    .from('bpe_big_three')
    .upsert({ day, items, updated_at: new Date().toISOString() }, { onConflict: 'day' })
    .select('day, items, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
