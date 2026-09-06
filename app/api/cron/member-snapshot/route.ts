import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Phoenix-local yyyy-mm-dd so a snapshot maps to Brad's calendar day.
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

// GET /api/cron/member-snapshot — record today's Aether signup count.
// Runs daily via vercel.json cron. Also callable manually (with the secret) to
// seed today's number immediately.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createAdminClient()

  // Total signups = every Aether member account.
  const { count, error: countError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  if (countError || count === null) {
    return NextResponse.json({ error: countError?.message ?? 'count failed' }, { status: 500 })
  }

  const day = phoenixDate()

  const { data, error } = await supabase
    .from('bpe_member_snapshots')
    .upsert({ snapshot_date: day, member_count: count }, { onConflict: 'snapshot_date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, snapshot: data })
}
