import { NextRequest, NextResponse } from 'next/server'
import { legacyWendyResponse } from '@/lib/wendy-moved'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { requireAuth } from '@/lib/require-auth'
import { getDashboardContext } from '@/lib/dashboardContext'
import { buildAgentSystemPrompt } from '@/lib/agentSystemPrompt'

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
type Attachment = { filename?: string; mediaType?: string; url?: string }

async function roundtableHistory(supabase: any) {
  const { data, error } = await supabase
    .from('agent_bridge_messages')
    .select('role, content')
    .eq('thread', 'main')
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(24)
  if (error || !data?.length) return ''
  const name = (role: string) => role === 'user' ? 'Brad' : role === 'claude' ? 'Wendy' : role === 'codex' ? 'Ellie' : 'System'
  return data.reverse().map((row: any) => `${name(row.role)}: ${String(row.content).slice(0, 1400)}`).join('\n')
}

async function recordRoomMessage(supabase: any, role: 'user' | 'claude' | 'codex', content: string) {
  const { error } = await supabase.from('agent_bridge_messages').insert({ thread: 'main', role, content, status: 'done' })
  if (error) throw new Error(`Could not record room message: ${error.message}`)
}

async function wendyReply(text: string, history: Message[], system: string, attachments: Attachment[]): Promise<string> {
  const { text: reply } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system,
    messages: [...history, {
      role: 'user',
      content: [
        { type: 'text' as const, text },
        ...attachments
          .filter(attachment => attachment.mediaType?.startsWith('image/') && attachment.url)
          .map(attachment => ({ type: 'file' as const, mediaType: attachment.mediaType!, data: attachment.url!, filename: attachment.filename })),
      ],
    }],
  })
  return reply
}

async function ellieReply(text: string, history: Message[], system: string, attachments: Attachment[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY_BPE ?? process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY_BPE not set')
  const model = process.env.ELLIE_OPENAI_MODEL ?? 'gpt-5.6-terra'
  const input: any[] = history.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }))
  input.push({
    role: 'user',
    content: [
      { type: 'input_text', text },
      ...attachments
        .filter(attachment => attachment.mediaType?.startsWith('image/') && attachment.url)
        .map(attachment => ({ type: 'input_image', image_url: attachment.url! })),
    ],
  } as any)
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, instructions: system, input }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}`)
  const data = await res.json()
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text
  const out = Array.isArray(data.output) ? data.output : []
  return out
    .flatMap((it: { content?: { text?: string }[] }) => (Array.isArray(it.content) ? it.content : []))
    .map((c: { text?: string }) => c?.text ?? '')
    .filter(Boolean)
    .join('\n')
}

export async function POST(req: NextRequest) {
  const { agent, text, history, attachments } = (await req.json()) as {
    agent: 'wendy' | 'ellie'
    text: string
    history?: Message[]
    attachments?: Attachment[]
  }
  if (agent !== 'wendy' && agent !== 'ellie') return NextResponse.json({ error: 'agent must be wendy or ellie' }, { status: 400 })
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  const moved = legacyWendyResponse(agent); if (moved) return moved

  try {
    const [dashboardContext, sharedHistory] = await Promise.all([
      getDashboardContext(supabase),
      roundtableHistory(supabase),
    ])
    const transcript = sharedHistory
      ? `\n\nSHARED COMMAND ROOM TRANSCRIPT:\n${sharedHistory}\n\nThis is one team conversation. Build on earlier answers when useful. Do not repeat them.`
      : ''
    const system = `${buildAgentSystemPrompt(agent, dashboardContext)}\n\n${VOICE_RULES}${transcript}`
    await recordRoomMessage(supabase, 'user', text)
    const reply =
      agent === 'ellie'
        ? await ellieReply(text, history ?? [], system, attachments ?? [])
        : await wendyReply(text, history ?? [], system, attachments ?? [])
    const spokenReply = reply || 'Sorry, I did not catch that.'
    await recordRoomMessage(supabase, agent === 'ellie' ? 'codex' : 'claude', spokenReply)
    return NextResponse.json({ reply: spokenReply })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
