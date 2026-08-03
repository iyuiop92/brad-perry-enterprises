import { NextResponse } from 'next/server'
import {
  AGENT_TASK_STATUSES,
  agentWriteFields,
  authenticateAgent,
  isOneOf,
  isResponse,
  jsonError,
  readJsonObject,
  taskPatchFromBody,
  writeAudit,
} from '@/lib/agent-task-api'

export const dynamic = 'force-dynamic'

// Live board read for either executive. Credentials are server-only and never returned.
export async function GET(request: Request) {
  const auth = authenticateAgent(request)
  if (isResponse(auth)) return auth

  const params = new URL(request.url).searchParams
  const workspaceId = params.get('workspace_id')
  const status = params.get('status')
  const includeArchived = params.get('include_archived') === 'true'
  if (status && !isOneOf(status, AGENT_TASK_STATUSES)) return jsonError(`status must be one of: ${AGENT_TASK_STATUSES.join(', ')}.`)

  let query = auth.supabase
    .from('bpe_tasks')
    .select('id, title, notes, status, type, priority, brand, owner, phase, workspace_id, sort_order, created_at, updated_at, archived_at, agent_last_actor, agent_last_action, agent_last_action_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (!includeArchived) query = query.is('archived_at', null)
  if (workspaceId) query = query.eq('workspace_id', workspaceId)
  if (status) query = query.eq('status', status)

  const [{ data: tasks, error: tasksError }, { data: workspaces, error: workspacesError }] = await Promise.all([
    query,
    auth.supabase.from('bpe_workspaces').select('id, name, slug, type, color, url, sort_order').order('sort_order'),
  ])
  if (tasksError || workspacesError) return NextResponse.json({ error: tasksError?.message ?? workspacesError?.message }, { status: 500 })

  return NextResponse.json({ tasks: tasks ?? [], workspaces: workspaces ?? [], statuses: AGENT_TASK_STATUSES })
}

export async function POST(request: Request) {
  const auth = authenticateAgent(request)
  if (isResponse(auth)) return auth
  const body = await readJsonObject(request)
  if (isResponse(body)) return body
  if (typeof body.title !== 'string' || !body.title.trim()) return jsonError('title is required.')

  const result = taskPatchFromBody(body)
  if ('error' in result) return jsonError(result.error)
  const { patch } = result
  const { data, error } = await auth.supabase
    .from('bpe_tasks')
    .insert({
      title: (patch.title as string).trim(),
      notes: patch.notes ?? null,
      status: patch.status ?? 'idea',
      type: patch.type ?? 'internal',
      priority: patch.priority ?? 'medium',
      brand: patch.brand ?? null,
      owner: patch.owner ?? 'brad',
      phase: patch.phase ?? null,
      deliverables: patch.deliverables ?? [],
      handoff_checklist: patch.handoff_checklist ?? [],
      sort_order: patch.sort_order ?? 0,
      workspace_id: patch.workspace_id ?? null,
      ...agentWriteFields(auth.agent, 'create'),
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const auditError = await writeAudit(auth.supabase, data.id, auth.agent, 'create', { created: data })
  if (auditError) return NextResponse.json({ error: `Task was created but audit logging failed: ${auditError.message}` }, { status: 500 })
  return NextResponse.json({ task: data }, { status: 201 })
}
