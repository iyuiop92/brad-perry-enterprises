import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import { generateMorningBrief } from '@/lib/generateBrief'
import { getDashboardContext } from '@/lib/dashboardContext'
import { buildAgentSystemPrompt } from '@/lib/agentSystemPrompt'

export const maxDuration = 60

export async function POST() {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data: tasks } = await supabase
    .from('bpe_tasks')
    .select('id, title, status, priority, brand')
    .neq('status', 'done')
    .order('sort_order')

  // Same Wendy brain as the dashboard chat + voice, so the brief never drifts
  // into a separate-sounding assistant.
  const context = await getDashboardContext(supabase)
  const persona = buildAgentSystemPrompt('wendy', context)

  const text = await generateMorningBrief(tasks ?? [], null, persona)

  return NextResponse.json({ text })
}
