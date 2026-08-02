import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { requireAuth } from '@/lib/require-auth'
import { buildPersonalSystemPrompt } from '@/lib/personalContext'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_BPE ?? process.env.ANTHROPIC_API_KEY,
})

export const maxDuration = 60

type Attachment = { filename?: string; mediaType?: string; url?: string }

export async function POST(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { message, attachments = [] } = await request.json() as { message?: string; attachments?: Attachment[] }
  if (!message?.trim() && !attachments.length) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }
  const content = message?.trim() || 'I attached a photo for context.'

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
    content,
    metadata: { source: 'dashboard' },
  })

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: buildPersonalSystemPrompt(),
    messages: [
      ...recentMessages,
      {
        role: 'user',
        content: [
          { type: 'text' as const, text: content },
          ...attachments
            .filter(attachment => attachment.mediaType?.startsWith('image/') && attachment.url)
            .map(attachment => ({ type: 'file' as const, mediaType: attachment.mediaType!, data: attachment.url!, filename: attachment.filename })),
        ],
      },
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
