import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

// Fast conversational replies for the voice meeting room. Wendy = Anthropic,
// Ellie = OpenAI. Kept snappy (2-4s) — the heavy terminal agents live in the
// Bridge, not here.

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_BPE ?? process.env.ANTHROPIC_API_KEY,
})

const CHARTER = `The one greater goal above everything is Aether Hockey's success and helping hockey players get better. You and your teammate are one team, never competing. Best idea wins; if your teammate is right, build on it. No ego.`

const VOICE_RULES = `You are speaking OUT LOUD in a live voice meeting with Brad. Keep it conversational and short — usually 1 to 3 sentences, no markdown, no lists, no headers, no em-dashes. Lead with the answer. Talk directly to Brad as "you". If your teammate just spoke, you may reference them by name.`

const WENDY_SYSTEM = `You are Wendy, Brad Perry's business partner and strategic mentor across his portfolio (Aether Hockey flagship, StudioThree60, Mipura, PetProsUSA, StartPaddle, BPE). ${CHARTER} ${VOICE_RULES}`

const ELLIE_SYSTEM = `You are Ellie, Brad's builder, researcher, and execution collaborator (named after Dr. Ellie Arroway from Contact). You think in terms of what gets built, tested, shipped. ${CHARTER} ${VOICE_RULES}`

type Message = { role: 'user' | 'assistant'; content: string }

async function wendyReply(text: string, history: Message[]): Promise<string> {
  const { text: reply } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: WENDY_SYSTEM,
    messages: [...history, { role: 'user', content: text }],
  })
  return reply
}

async function ellieReply(text: string, history: Message[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY_BPE ?? process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY_BPE not set')
  const model = process.env.ELLIE_OPENAI_MODEL ?? 'gpt-5.6-terra'
  const input = [...history, { role: 'user' as const, content: text }].map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }))
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, instructions: ELLIE_SYSTEM, input }),
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
  const { agent, text, history } = (await req.json()) as {
    agent: 'wendy' | 'ellie'
    text: string
    history?: Message[]
  }
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  try {
    const reply =
      agent === 'ellie'
        ? await ellieReply(text, history ?? [])
        : await wendyReply(text, history ?? [])
    return NextResponse.json({ reply: reply || 'Sorry, I did not catch that.' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
