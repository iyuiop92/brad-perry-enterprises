import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { requireAuth } from '@/lib/require-auth'
import { buildPersonalSystemPrompt } from '@/lib/personalContext'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_BPE ?? process.env.ANTHROPIC_API_KEY,
})

export const maxDuration = 60

export async function POST(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { message } = await request.json()
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  // Fetch recent thread for context (last 20 messages)
  const { data: history } = await supabase
    .from('bpe_feed_messages')
    .select('role, content')
    .order('created_at', { ascending: false })
    .limit(20)

  const recentMessages = (history ?? []).reverse().map((m) => ({
    role: m.role === 'brad' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }))

  // Add Brad's new message
  await supabase.from('bpe_feed_messages').insert({
    role: 'brad',
    content: message.trim(),
    metadata: { source: 'dashboard' },
  })

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: buildPersonalSystemPrompt(),
    messages: [
      ...recentMessages,
      { role: 'user', content: message.trim() },
    ],
  })

  // Save Wendy's reply
  await supabase.from('bpe_feed_messages').insert({
    role: 'wendy',
    content: text,
    metadata: { source: 'dashboard' },
  })

  return NextResponse.json({ reply: text })
}
