import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { requireAuth } from '@/lib/require-auth'
import { buildPersonalSystemPrompt } from '@/lib/personalContext'

export const maxDuration = 60

export async function POST(request: Request) {
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { message } = await request.json()
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  const { data: history } = await supabase
    .from('bpe_feed_messages')
    .select('role, content')
    .order('created_at', { ascending: false })
    .limit(20)

  const recentMessages = (history ?? []).reverse().map((m) => ({
    role: m.role === 'brad' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }))

  await supabase.from('bpe_feed_messages').insert({
    role: 'brad',
    content: message.trim(),
    metadata: { source: 'dashboard' },
  })

  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: buildPersonalSystemPrompt(),
      messages: [
        ...recentMessages,
        { role: 'user', content: message.trim() },
      ],
    })

    await supabase.from('bpe_feed_messages').insert({
      role: 'wendy',
      content: text,
      metadata: { source: 'dashboard' },
    })

    return NextResponse.json({ reply: text })
  } catch (err) {
    console.error('[personal/chat] generateText error:', err)
    return NextResponse.json(
      { error: 'Wendy is unavailable right now. Try again in a moment.' },
      { status: 500 }
    )
  }
}
