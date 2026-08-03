import { NextRequest, NextResponse } from 'next/server'
import { generateText, stepCountIs } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { requireAuth } from '@/lib/require-auth'
import { getDashboardContext } from '@/lib/dashboardContext'
import { buildAgentSystemPrompt } from '@/lib/agentSystemPrompt'
import { agentTaskAITools } from '@/lib/agent-task-ai-tools'
import { runEllieTaskToolLoop } from '@/lib/ellie-task-tool-loop'

// Fast conversational replies for the voice meeting room. Wendy = Anthropic,
// Ellie = OpenAI. Kept snappy (2-4s) — the heavy terminal agents live in the
// Bridge, not here.
//
// Both agents now share the exact same live brain as the text dashboard chats:
// getDashboardContext() -> buildAgentSystemPrompt(). The VOICE_RULES layer is
// appended AFTER the shared prompt so replies still sound spoken, not written.

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_BPE ?? process.env.ANTHROPIC_API_KEY,
})

const VOICE_RULES = `You are speaking OUT LOUD in a live voice meeting with Brad. Keep it conversational and short — usually 1 to 3 sentences, no markdown, no lists, no headers, no em-dashes. Lead with the answer. Talk directly to Brad as "you". If your teammate just spoke, you may reference them by name.`

type Message = { role: 'user' | 'assistant'; content: string }

async function wendyReply(text: string, history: Message[], system: string): Promise<string> {
  const { text: reply } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system,
    messages: [...history, { role: 'user', content: text }],
    tools: agentTaskAITools('wendy'),
    stopWhen: stepCountIs(5),
  })
  return reply
}

async function ellieReply(text: string, history: Message[], system: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY_BPE ?? process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY_BPE not set')
  const model = process.env.ELLIE_OPENAI_MODEL ?? 'gpt-5.6-terra'
  const input = [...history, { role: 'user' as const, content: text }].map(m => ({
    role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
    content: m.content,
  }))
  return runEllieTaskToolLoop({ apiKey, model, instructions: system, input })
}

export async function POST(req: NextRequest) {
  const { agent, text, history } = (await req.json()) as {
    agent: 'wendy' | 'ellie'
    text: string
    history?: Message[]
  }
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const dashboardContext = await getDashboardContext(supabase)
    const system = `${buildAgentSystemPrompt(agent, dashboardContext)}\n\n${VOICE_RULES}`
    const reply =
      agent === 'ellie'
        ? await ellieReply(text, history ?? [], system)
        : await wendyReply(text, history ?? [], system)
    return NextResponse.json({ reply: reply || 'Sorry, I did not catch that.' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
