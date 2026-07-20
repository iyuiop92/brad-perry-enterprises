import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const maxDuration = 30

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createAdminClient()
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_BRAD_CHAT_ID

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const toDateStr = (d: Date) => d.toISOString().split('T')[0]

  // Fetch subscriptions due within the next 7 days
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('*')
    .lte('next_billing_date', toDateStr(in7Days))
    .gte('next_billing_date', toDateStr(today))

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: string[] = []

  for (const sub of subs ?? []) {
    const billingDate = new Date(sub.next_billing_date + 'T00:00:00')
    const diffMs = billingDate.getTime() - today.getTime()
    const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24))

    const costDisplay =
      sub.cost_cents === 0
        ? 'usage-based'
        : `$${(sub.cost_cents / 100).toFixed(2)}/mo`

    const urlLine = sub.billing_url ? `\n${sub.billing_url}` : ''

    // 7-day alert
    if (daysUntil === 7 && !sub.alert_sent_7d) {
      const msg = `💳 *${sub.service}* — ${costDisplay} — due in 7 days${urlLine}`

      if (token && chatId) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
        })
      }

      await supabase
        .from('subscriptions')
        .update({ alert_sent_7d: true })
        .eq('id', sub.id)

      results.push(`7d alert sent: ${sub.service}`)
    }

    // 1-day alert
    if (daysUntil === 1 && !sub.alert_sent_1d) {
      const msg = `💳 *${sub.service}* — ${costDisplay} — due tomorrow${urlLine}`

      if (token && chatId) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
        })
      }

      await supabase
        .from('subscriptions')
        .update({ alert_sent_1d: true })
        .eq('id', sub.id)

      results.push(`1d alert sent: ${sub.service}`)
    }
  }

  return NextResponse.json({ ok: true, sent: results })
}
