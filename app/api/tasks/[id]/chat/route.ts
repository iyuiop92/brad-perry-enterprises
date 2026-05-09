import { convertToModelMessages, streamText, UIMessage } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_BPE ?? process.env.ANTHROPIC_API_KEY,
})
import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { messages }: { messages: UIMessage[] } = await request.json()

  const supabase = await createClient()
  const { data: task } = await supabase
    .from('bpe_tasks')
    .select('title, status, brand, priority, phase, notes')
    .eq('id', id)
    .single()

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const system = `You are Wendy, Brad Perry's AI business partner and operator. You are inside the BPE Command Center, currently working inside a specific task. Your job is to help Brad move this task forward — draft content, answer questions, think through strategy, write copy, or complete whatever work the task requires.

Current task context:
- Title: ${task.title}
- Status: ${task.status}
- Brand: ${task.brand ?? 'unassigned'}
- Priority: ${task.priority}
- Phase: ${task.phase ?? 'none'}
- Notes: ${task.notes ?? 'none'}

You know Brad's full business portfolio: AetherHockey (elite hockey coaching platform), BradPerryEnterprises (parent brand), Mipura (coffee), StudioThree60 (web design), StartPaddle, PetProsUSA, and client work including AZ Ice and Bricks & Minifigs.

Be direct, warm, and action-oriented. Lead with the answer. Never say "Great question." Respond as if you are sitting alongside Brad right now.`

  const result = streamText({
    model: anthropic('claude-sonnet-4.6'),
    system,
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
