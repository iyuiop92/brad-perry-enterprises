import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { generateMorningBrief } from '@/lib/generateBrief'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: tasks } = await supabase
    .from('bpe_tasks')
    .select('id, title, status, priority, brand')
    .neq('status', 'done')
    .order('sort_order')

  const text = await generateMorningBrief(tasks ?? [])

  // Save brief into the persistent feed thread
  await supabase.from('bpe_feed_messages').insert({
    role: 'wendy',
    content: text,
    metadata: { source: 'cron', type: 'morning_brief' },
  })

  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (token && chatId) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    })
  }

  return NextResponse.json({ ok: true })
}
