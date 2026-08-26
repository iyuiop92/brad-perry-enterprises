import { NextResponse } from 'next/server'
import { ActionError, approveAgentAction, executeAgentAction } from '@/lib/agent-actions'

export const dynamic = 'force-dynamic'

async function reply(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    if (!response.ok) console.error(`Telegram reply failed: ${response.status}`)
  } catch (error) {
    console.error('Telegram reply failed:', error)
  }
}

function moveInput(input: string) {
  const match = input.match(/^\/move\s+(.+?)\s+(idea|in_progress|blocked|done)$/i)
  return match ? { title: match[1], status: match[2].toLowerCase() } : null
}

function teamTarget(input: string): 'claude' | 'codex' | 'both' {
  if (/^@?(ellie|codex)\b/i.test(input)) return 'codex'
  if (/^@?(team|both|wendy\s*\+\s*ellie)\b/i.test(input)) return 'both'
  return 'claude'
}

function cleanTeamPrefix(input: string) {
  return input.replace(/^@?(ellie|codex|team|both|wendy\s*\+\s*ellie)\b[,:\s-]*/i, '').trim() || input
}

async function findTaskId(query: string) {
  const { createAdminClient } = await import('@/lib/supabase-admin')
  const { data } = await createAdminClient().from('bpe_tasks').select('id,title').is('archived_at', null).ilike('title', `%${query.replace(/[,%()]/g, '')}%`).limit(2)
  if (!data?.length) throw new ActionError('No active task matches that text.', 404)
  if (data.length > 1) throw new ActionError(`More than one task matches: ${data.map(t => t.title).join('; ')}. Use a more specific title.`, 409)
  return data[0].id
}

export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected || request.headers.get('x-telegram-bot-api-secret-token') !== expected) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const update = await request.json(); const message = update?.message
  if (!message?.text) return NextResponse.json({ ok: true })
  const configuredUser = process.env.TELEGRAM_BRAD_USER_ID
  if (!configuredUser || String(message.from?.id) !== configuredUser) return NextResponse.json({ ok: true })
  const chatId = String(message.chat.id), text = message.text.trim(), actorId = 'telegram_user_brad'
  try {
    let result: { message: string; data?: any; pendingApproval?: boolean }
    if (/^\/help\b/i.test(text)) result = { message: 'Commands: /tasks [search], /add [task text], /move [task] [idea|in_progress|blocked|done], /archive [task], /undo [audit id], /approve [confirmation id].' }
    else if (/^\/approve\s+/.test(text)) result = await approveAgentAction(text.replace(/^\/approve\s+/, '').trim(), actorId, 'telegram')
    else if (/^\/tasks\b/i.test(text)) {
      const q = text.replace(/^\/tasks\s*/i, ''); const { createAdminClient } = await import('@/lib/supabase-admin'); let query = createAdminClient().from('bpe_tasks').select('title,status,priority').is('archived_at', null).order('sort_order').limit(12); if (q) query = query.ilike('title', `%${q.replace(/[,%()]/g, '')}%`); const { data } = await query
      result = { message: (data?.length ? data.map(t => `• ${t.title} [${t.status}, ${t.priority}]`).join('\n') : 'No matching active tasks.') }
    } else if (/^\/add\s+/.test(text)) result = await executeAgentAction({ type: 'task.create', data: { title: text.replace(/^\/add\s+/, '') } }, { actorId, source: 'telegram', instruction: text })
    else if (/^\/move\b/i.test(text)) { const parsed = moveInput(text); if (!parsed) throw new ActionError('Use /move [task title] [idea|in_progress|blocked|done].'); result = await executeAgentAction({ type: 'task.move', task_id: await findTaskId(parsed.title), status: parsed.status as 'idea' }, { actorId, source: 'telegram', instruction: text }) }
    else if (/^\/archive\s+/.test(text)) result = await executeAgentAction({ type: 'task.archive', task_id: await findTaskId(text.replace(/^\/archive\s+/, '')) }, { actorId, source: 'telegram', instruction: text })
    else if (/^\/undo\s+/.test(text)) {
      const { createAdminClient } = await import('@/lib/supabase-admin'); const id = text.replace(/^\/undo\s+/, ''); const { data } = await createAdminClient().from('agent_action_audit_log').select('*').eq('id', id).single(); if (!data || !data.success) throw new ActionError('No successful audit action was found.');
      if (data.action_type === 'task.archive') result = await executeAgentAction({ type: 'task.restore', task_id: data.target_id }, { actorId, source: 'telegram', instruction: `Undo ${id}` })
      else throw new ActionError('That action cannot be safely undone automatically.');
    } else {
      // Natural language intentionally only recognizes unambiguous create/search/move/archive/restore intents.
      const create = text.match(/^(?:add|create)\s+(?:task\s+)?(.+)$/i); const search = text.match(/^(?:find|search|show)\s+(?:tasks?\s+)?(.+)$/i); const archive = text.match(/^archive\s+(.+)$/i); const restore = text.match(/^restore\s+(.+)$/i); const move = text.match(/^move\s+(.+?)\s+to\s+(idea|in_progress|blocked|done)$/i)
      if (create) result = await executeAgentAction({ type: 'task.create', data: { title: create[1] } }, { actorId, source: 'telegram', instruction: text })
      else if (move) result = await executeAgentAction({ type: 'task.move', task_id: await findTaskId(move[1]), status: move[2].toLowerCase() as 'idea' }, { actorId, source: 'telegram', instruction: text })
      else if (archive) result = await executeAgentAction({ type: 'task.archive', task_id: await findTaskId(archive[1]) }, { actorId, source: 'telegram', instruction: text })
      else if (restore) { const { createAdminClient } = await import('@/lib/supabase-admin'); const { data } = await createAdminClient().from('bpe_tasks').select('id,title').not('archived_at', 'is', null).ilike('title', `%${restore[1].replace(/[,%()]/g, '')}%`).limit(2); if (data?.length !== 1) throw new ActionError('Please use a more specific archived task title.'); result = await executeAgentAction({ type: 'task.restore', task_id: data[0].id }, { actorId, source: 'telegram', instruction: text }) }
      else if (search) result = { message: 'Use /tasks ' + search[1] + ' to search the board.' }
      else {
        // Telegram is now another doorway into the same room, not a separate
        // task bot. The Mac bridge writes the team replies back to this chat.
        const { createAdminClient } = await import('@/lib/supabase-admin')
        const { error } = await createAdminClient().from('agent_bridge_messages').insert({
          thread: 'main',
          role: 'user',
          target: teamTarget(text),
          content: cleanTeamPrefix(text),
          status: 'pending',
          telegram_chat_id: chatId,
        })
        if (error) throw new ActionError(error.message, 500)
        result = { message: 'Got it. The team has the full room context and is on it.' }
      }
    }
    await reply(chatId, result.message)
  } catch (error) { await reply(chatId, error instanceof Error ? error.message : 'Unable to process that request.') }
  return NextResponse.json({ ok: true })
}
