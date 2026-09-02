import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export const runtime = 'nodejs'

// Aether Hockey shares this same Supabase project, so the BPE hub reads its
// tables directly with the service-role client. Read-only — this never writes to
// the live site. First spoke; the shape here is the template every other brand copies.

const TIER_PRICE: Record<string, number> = {
  player: 39,
  coach: 79,
  business: 175,
  parent: 29,
}

function sevenDaysAgoISO() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
}

type Supa = NonNullable<Awaited<ReturnType<typeof requireAuth>>['supabase']>

// Count rows in `profiles` after applying the given filters. The builder is typed
// loosely because Supabase's chained filter generics don't survive a callback param.
async function count(
  supabase: Supa,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: (q: any) => any
): Promise<number> {
  const base = supabase.from('profiles').select('*', { count: 'exact', head: true })
  const { count: c } = await build(base)
  return (c as number | null) ?? 0
}

export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const since = sevenDaysAgoISO()

  try {
    const [
      total,
      free,
      player,
      coach,
      business,
      newSignups7d,
      unreadMessages,
      askCoach7d,
      latest,
    ] = await Promise.all([
      count(supabase, (q) => q.eq('suspended', false)),
      count(supabase, (q) => q.eq('suspended', false).eq('tier', 'free')),
      count(supabase, (q) => q.eq('tier', 'player')),
      count(supabase, (q) => q.eq('tier', 'coach')),
      count(supabase, (q) => q.eq('tier', 'business')),
      count(supabase, (q) => q.gte('created_at', since)),
      // member_messages: a member wrote and admin hasn't read it yet = needs Brad
      supabase
        .from('member_messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_role', 'member')
        .is('read_by_admin_at', null)
        .then(({ count: c }) => c ?? 0),
      supabase
        .from('ask_coach_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since)
        .then(({ count: c }) => c ?? 0),
      supabase
        .from('profiles')
        .select('full_name, email, tier, created_at')
        .eq('suspended', false)
        .order('created_at', { ascending: false })
        .limit(6)
        .then(({ data }) => data ?? []),
    ])

    const paid = player + coach + business
    const estMrr =
      player * TIER_PRICE.player + coach * TIER_PRICE.coach + business * TIER_PRICE.business

    return NextResponse.json({
      updated_at: new Date().toISOString(),
      members: { total, free, paid, player, coach, business },
      new_signups_7d: newSignups7d,
      est_mrr: estMrr,
      unread_member_messages: unreadMessages,
      ask_coach_7d: askCoach7d,
      latest_signups: latest,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load Aether pulse'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
