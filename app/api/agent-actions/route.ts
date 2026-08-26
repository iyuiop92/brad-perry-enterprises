import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { ActionError, approveAgentAction, authorizeAgent, executeAgentAction, isAgentActionSecret } from '@/lib/agent-actions'
import { hasDashboardSession } from '@/lib/password-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const dashboard = await hasDashboardSession()
    const secret = request.headers.get('x-agent-action-secret')
    if (!dashboard && !isAgentActionSecret(secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const actorId = dashboard ? 'brad' : body.actor_id
    const source = dashboard ? (body.source_channel ?? 'dashboard') : body.source_channel
    if (!actorId || !source) return NextResponse.json({ error: 'actor_id and source_channel are required' }, { status: 400 })
    const requestId = request.headers.get('x-request-id') ?? randomUUID()
    const result = body.confirmation_id
      ? await approveAgentAction(body.confirmation_id, actorId, source, requestId)
      : await executeAgentAction(body.action, { actorId, source, requestId, instruction: body.instruction })
    return NextResponse.json({ requestId, ...result }, { status: result.pendingApproval ? 202 : 200 })
  } catch (error) {
    const status = error instanceof ActionError ? error.status : 500
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Action failed' }, { status })
  }
}

export async function GET(request: Request) {
  try {
    const dashboard = await hasDashboardSession()
    const url = new URL(request.url)
    const actor = dashboard ? 'brad' : url.searchParams.get('actor_id')
    if (!dashboard && !isAgentActionSecret(request.headers.get('x-agent-action-secret'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!actor) return NextResponse.json({ error: 'actor_id is required' }, { status: 400 })
    const { db, identity } = await authorizeAgent(actor, dashboard ? 'dashboard' : (url.searchParams.get('source_channel') ?? 'api'))
    const permissions = identity.permissions as string[]
    if (!permissions.includes('*') && !permissions.includes('task:read')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const view = url.searchParams.get('view')
    if (view === 'identities') {
      const [{ data: identities, error }, { data: policies }] = await Promise.all([db.from('agent_identities').select('*').order('id'), db.from('agent_action_policies').select('*').eq('id', true).single()])
      return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ identities, policies })
    }
    let query = db.from('bpe_tasks').select('*').order('sort_order').order('created_at')
    const archived = url.searchParams.get('archived')
    if (archived === 'true') query = query.not('archived_at', 'is', null)
    else if (archived !== 'all') query = query.is('archived_at', null)
    if (url.searchParams.get('workspace_id')) query = query.eq('workspace_id', url.searchParams.get('workspace_id')!)
    if (url.searchParams.get('status')) query = query.eq('status', url.searchParams.get('status')!)
    if (url.searchParams.get('owner')) query = query.eq('owner', url.searchParams.get('owner')!)
    if (url.searchParams.get('priority')) query = query.eq('priority', url.searchParams.get('priority')!)
    if (url.searchParams.get('q')) query = query.or(`title.ilike.%${url.searchParams.get('q')!.replace(/[,%()]/g, '')}%,notes.ilike.%${url.searchParams.get('q')!.replace(/[,%()]/g, '')}%`)
    const { data, error } = await query
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data)
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Request failed' }, { status: error instanceof ActionError ? error.status : 500 }) }
}
