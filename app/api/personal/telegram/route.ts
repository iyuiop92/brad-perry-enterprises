import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createAdminClient } from '@/lib/supabase-admin'
import { buildPersonalSystemPrompt } from '@/lib/personalContext'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_BPE ?? process.env.ANTHROPIC_API_KEY,
})

export const maxDuration = 60

export async function POST(request: Request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const message = body?.message
  if (!message?.text) return NextResponse.json({ ok: true })

  const chatId = String(message.chat.id)
  const allowedChatId = process.env.TELEGRAM_CHAT_ID
  if (allowedChatId && chatId !== allowedChatId) {
    return NextResponse.json({ ok: true })
  }

  const userText = message.text.trim()
  const supabase = createAdminClient()

  // Fetch recent context
  const { data: history } = await supabase
    .from('bpe_feed_messages')
    .select('role, content')
    .order('created_at', { ascending: false })
    .limit(20)

  const recentMessages = (history ?? []).reverse().map((m) => ({
    role: m.role === 'brad' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }))

  // Save Brad's message
  await supabase.from('bpe_feed_messages').insert({
    role: 'brad',
    content: userText,
    metadata: { source: 'telegram', telegram_message_id: message.message_id },
  })

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: buildPersonalSystemPrompt(),
    messages: [
      ...recentMessages,
      { role: 'user', content: userText },
    ],
  })

  // Save Wendy's reply
  await supabase.from('bpe_feed_messages').insert({
    role: 'wendy',
    content: text,
    metadata: { source: 'telegram' },
  })

  // Send reply back to Telegram
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (botToken) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  }

  return NextResponse.json({ ok: true })
}
