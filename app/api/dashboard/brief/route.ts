import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import { generateMorningBrief } from '@/lib/generateBrief'

export const maxDuration = 60

export async function POST() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data: tasks } = await supabase
    .from('bpe_tasks')
    .select('id, title, status, priority, brand')
    .neq('status', 'done')
    .order('sort_order')

  const text = await generateMorningBrief(tasks ?? [])

  return NextResponse.json({ text })
}
