import { createAdminClient } from '@/lib/supabase-admin'
import {
  AGENT_TASK_STATUSES,
  AgentIdentity,
  agentWriteFields,
  taskPatchFromBody,
  writeAudit,
} from '@/lib/agent-task-api'
import type { AgentTaskToolName } from '@/lib/agent-task-tools'

function objectInput(input: unknown): Record<string, unknown> | null {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null
}

/** Executes a model tool call directly on the shared board from a trusted server route. */
export async function executeAgentTaskTool(agent: AgentIdentity, name: AgentTaskToolName, input: unknown) {
  const body = objectInput(input)
  if (!body) return { ok: false, error: 'Tool input must be an object.' }
  const supabase = createAdminClient()

  if (name === 'bpe_list_board') {
    let query = supabase.from('bpe_tasks').select('*').order('sort_order').order('created_at')
    if (body.include_archived !== true) query = query.is('archived_at', null)
    if (typeof body.workspace_id === 'string') query = query.eq('workspace_id', body.workspace_id)
    if (typeof body.status === 'string') query = query.eq('status', body.status)
    const [{ data: tasks, error: tasksError }, { data: workspaces, error: workspaceError }] = await Promise.all([
      query,
      supabase.from('bpe_workspaces').select('id, name, slug, type, color, url, sort_order').order('sort_order'),
    ])
    return tasksError || workspaceError
      ? { ok: false, error: tasksError?.message ?? workspaceError?.message }
      : { ok: true, tasks: tasks ?? [], workspaces: workspaces ?? [], statuses: AGENT_TASK_STATUSES }
  }

  const id = typeof body.id === 'string' ? body.id : ''
  if (name !== 'bpe_create_task' && !id) return { ok: false, error: 'id is required.' }
  if (name === 'bpe_get_task') {
    const { data, error } = await supabase.from('bpe_tasks').select('*').eq('id', id).maybeSingle()
    return error || !data ? { ok: false, error: error?.message ?? 'Task not found.' } : { ok: true, task: data }
  }

  if (name === 'bpe_delete_task') {
    const { data: existing, error: findError } = await supabase.from('bpe_tasks').select('*').eq('id', id).maybeSingle()
    if (findError || !existing) return { ok: false, error: findError?.message ?? 'Task not found.' }
    const auditError = await writeAudit(supabase, id, agent, 'delete', { deleted: existing })
    if (auditError) return { ok: false, error: `Delete cancelled because audit logging failed: ${auditError.message}` }
    const { error } = await supabase.from('bpe_tasks').delete().eq('id', id)
    return error ? { ok: false, error: error.message } : { ok: true, deleted_task_id: id }
  }

  const patchResult = taskPatchFromBody(body)
  if ('error' in patchResult) return { ok: false, error: patchResult.error }
  const patch = patchResult.patch
  if (name === 'bpe_create_task') {
    if (typeof patch.title !== 'string' || !patch.title.trim()) return { ok: false, error: 'title is required.' }
    const { data, error } = await supabase.from('bpe_tasks').insert({
      title: patch.title.trim(), notes: patch.notes ?? null, status: patch.status ?? 'idea', type: patch.type ?? 'internal',
      priority: patch.priority ?? 'medium', brand: patch.brand ?? null, owner: patch.owner ?? 'brad', phase: patch.phase ?? null,
      deliverables: patch.deliverables ?? [], handoff_checklist: patch.handoff_checklist ?? [], sort_order: patch.sort_order ?? 0,
      workspace_id: patch.workspace_id ?? null, ...agentWriteFields(agent, 'create'),
    }).select().single()
    if (error) return { ok: false, error: error.message }
    const auditError = await writeAudit(supabase, data.id, agent, 'create', { created: data })
    return auditError ? { ok: false, error: `Task was created but audit logging failed: ${auditError.message}` } : { ok: true, task: data }
  }

  const archive = name === 'bpe_archive_task'
  if (!archive && Object.keys(patch).length === 0) return { ok: false, error: 'Provide at least one field to update.' }
  const action = archive ? 'archive' : name === 'bpe_move_task' ? 'move' : 'update'
  const { data, error } = await supabase.from('bpe_tasks').update({
    ...patch, ...(archive ? { archived_at: new Date().toISOString() } : {}), ...agentWriteFields(agent, action),
  }).eq('id', id).select().maybeSingle()
  if (error || !data) return { ok: false, error: error?.message ?? 'Task not found.' }
  const auditError = await writeAudit(supabase, id, agent, action, { patch, archived: archive })
  return auditError ? { ok: false, error: `Task was updated but audit logging failed: ${auditError.message}` } : { ok: true, task: data }
}
