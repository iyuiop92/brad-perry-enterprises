import { NextResponse } from 'next/server'
import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { requireAuth } from '@/lib/require-auth'
import { getDashboardContext } from '@/lib/dashboardContext'
import { buildAgentSystemPrompt } from '@/lib/agentSystemPrompt'
import { routeWendyTier } from '@/lib/modelRouter'
import { actionCandidate, actorScope, type ExecutiveAgent } from '@/lib/dashboard-chat'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY_BPE ?? process.env.ANTHROPIC_API_KEY })
const safe = (value: unknown): value is ExecutiveAgent => value === 'wendy' || value === 'ellie'
const scopeKey = (workspaceId: string | null) => workspaceId ? `workspace:${workspaceId}` : 'portfolio'
const policy = `\n\nACTION SAFETY: This is planning-only chat. Never execute or claim completion of task, code, deployment, external-message, credential, permission, payment, migration, or destructive actions. Explain scope and verification. Action-like requests are recorded as pending proposals; explicit approval only records consent, and execution is disabled.`
const responseText = (data: any) => typeof data?.output_text === 'string'
  ? data.output_text
  : (Array.isArray(data?.output) ? data.output : []).flatMap((item: any) => Array.isArray(item?.content) ? item.content : []).map((item: any) => item?.text ?? '').filter(Boolean).join('\n')

async function conversation(supabase: any, actor: string, workspaceId: string | null) {
  const key = scopeKey(workspaceId)
  const { data } = await supabase.from('bpe_chat_conversations').select('id').eq('actor_scope', actor).eq('scope_key', key).maybeSingle()
  if (data) return data
  const { data: created, error } = await supabase.from('bpe_chat_conversations').insert({ actor_scope: actor, scope_key: key, workspace_id: workspaceId }).select('id').single()
  if (error) throw new Error(error.message)
  return created
}

async function snapshot(supabase: any, id: string) {
  const [{ data: messages, error: messageError }, { data: proposals, error: proposalError }] = await Promise.all([
    supabase.from('bpe_chat_messages').select('id, role, agent, content, created_at').eq('conversation_id', id).order('created_at').limit(200),
    supabase.from('bpe_chat_action_proposals').select('id, message_id, agent, kind, risk, summary, status, created_at').eq('conversation_id', id).order('created_at', { ascending: false }).limit(50),
  ])
  if (messageError || proposalError) throw new Error(messageError?.message ?? proposalError?.message)
  return { messages: messages ?? [], proposals: proposals ?? [] }
}

export async function GET(request: Request) {
  const { supabase, unauthorized } = await requireAuth(); if (unauthorized) return unauthorized
  const actor = await actorScope(); if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const workspaceId = new URL(request.url).searchParams.get('workspace_id')
  try { const item = await conversation(supabase, actor, workspaceId); return NextResponse.json({ conversation_id: item.id, ...(await snapshot(supabase, item.id)) }) }
  catch (error) { const requestId = crypto.randomUUID(); console.error('dashboard-chat-load', requestId, error); return NextResponse.json({ error: 'Unable to load conversation.', request_id: requestId }, { status: 500 }) }
}

export async function POST(request: Request) {
  const { supabase, unauthorized } = await requireAuth(); if (unauthorized) return unauthorized
  const actor = await actorScope(); if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null), agent = body?.agent, content = typeof body?.content === 'string' ? body.content.trim() : '', workspaceId = typeof body?.workspace_id === 'string' ? body.workspace_id : null
  if (!safe(agent) || !content || content.length > 12000) return NextResponse.json({ error: 'Invalid agent or message.' }, { status: 400 })
  const requestId = crypto.randomUUID()
  try {
    const item = await conversation(supabase, actor, workspaceId)
    const { data: user, error } = await supabase.from('bpe_chat_messages').insert({ conversation_id: item.id, role: 'user', content }).select('id').single(); if (error) throw error
    const candidate = actionCandidate(content)
    if (candidate) { const { error: proposalError } = await supabase.from('bpe_chat_action_proposals').insert({ conversation_id: item.id, message_id: user.id, agent, ...candidate, summary: content.slice(0, 500), details: { source: 'chat_request', execution: 'disabled' } }); if (proposalError) throw proposalError }
    const { messages } = await snapshot(supabase, item.id)
    const history = messages.slice(-36).map((message: any) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content }))
    const system = buildAgentSystemPrompt(agent, await getDashboardContext(supabase)) + policy
    const save = async (text: string) => { if (!text.trim()) return; const { error: saveError } = await supabase.from('bpe_chat_messages').insert({ conversation_id: item.id, role: 'assistant', agent, content: text.trim() }); if (saveError) throw saveError; await supabase.from('bpe_chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', item.id) }
    const headers = { 'x-bpe-conversation-id': item.id, 'x-bpe-request-id': requestId, 'Cache-Control': 'no-store' }
    if (agent === 'ellie') {
      const apiKey = process.env.OPENAI_API_KEY_BPE ?? process.env.OPENAI_API_KEY; if (!apiKey) return NextResponse.json({ error: 'Ellie is not configured.', request_id: requestId }, { status: 503 })
      const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.ELLIE_OPENAI_MODEL ?? 'gpt-5.6-terra', instructions: system, input: history }) })
      if (!response.ok) throw new Error(`OpenAI response ${response.status}`)
      const data: any = await response.json(), text = responseText(data); if (!text) throw new Error('Ellie returned no text')
      await save(text); return new Response(text, { headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8', 'x-bpe-streaming': 'buffered' } })
    }
    const result = streamText({ model: anthropic(routeWendyTier(content).model), system, messages: history as any, onFinish: async ({ text }) => { await save(text) } })
    return result.toTextStreamResponse({ headers: { ...headers, 'x-bpe-streaming': 'token' } })
  } catch (error) { console.error('dashboard-chat', requestId, error); return NextResponse.json({ error: 'The assistant could not complete this request. Check logs with the request ID.', request_id: requestId }, { status: 502 }) }
}
