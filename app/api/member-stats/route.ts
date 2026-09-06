import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export const runtime = 'nodejs'

// GET /api/member-stats — current signups + net change over the recorded history.
export async function GET() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  // Live count straight from the source, so "current" is never stale.
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  // Snapshot history (most recent first) for trend + net change.
  const { data: snapshots } = await supabase
    .from('bpe_member_snapshots')
    .select('snapshot_date, member_count')
    .order('snapshot_date', { ascending: false })
    .limit(30)

  const history = snapshots ?? []
  const current = count ?? history[0]?.member_count ?? 0

  const yesterday = history[1]?.member_count ?? null
  const weekAgo = history.find((_, i) => i >= 7)?.member_count ?? history[history.length - 1]?.member_count ?? null

  return NextResponse.json({
    current,
    net_day: yesterday === null ? null : current - yesterday,
    net_week: weekAgo === null ? null : current - weekAgo,
    history,
  })
}
