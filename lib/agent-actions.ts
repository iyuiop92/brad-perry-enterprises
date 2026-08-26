import { randomUUID, timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase-admin'

export const ACTION_SECRET_HEADER = 'x-agent-action-secret'
const taskStatus = z.enum(['idea', 'in_progress', 'blocked', 'done'])
const sourceChannel = z.enum(['dashboard_chat', 'website_chat', 'telegram', 'api', 'dashboard'])
const taskFields = z.object({
  title: z.string().trim().min(1).max(500).optional(), notes: z.string().max(20000).nullable().optional(),
  status: taskStatus.optional(), owner: z.enum(['brad', 'wendy', 'ellie']).optional(),
  priority: z.enum(['high', 'medium', 'low']).nullable().optional(), workspace_id: z.string().uuid().nullable().optional(),
  brand: z.string().max(200).nullable().optional(), phase: z.enum(['discovery', 'design', 'build', 'launch', 'live']).nullable().optional(),
  type: z.enum(['internal', 'client']).optional(), sort_order: z.number().int().optional(),
  deliverables: z.array(z.unknown()).optional(), handoff_checklist: z.array(z.unknown()).optional(),
}).strict()

export const agentActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('task.create'), data: taskFields.required({ title: true }) }),
  z.object({ type: z.literal('task.update'), task_id: z.string().uuid(), data: taskFields }),
  z.object({ type: z.literal('task.move'), task_id: z.string().uuid(), status: taskStatus }),
  z.object({ type: z.literal('task.archive'), task_id: z.string().uuid() }),
  z.object({ type: z.literal('task.restore'), task_id: z.string().uuid() }),
  z.object({ type: z.literal('task.delete'), task_id: z.string().uuid() }),
  z.object({ type: z.literal('workspace.create'), data: z.object({ name: z.string().trim().min(1).max(160), type: z.enum(['brand', 'client']).default('brand'), color: z.string().max(20).default('#00b4ff'), url: z.string().url().nullable().optional() }) }),
  z.object({ type: z.literal('workspace.update'), workspace_id: z.string().uuid(), data: z.object({ name: z.string().trim().min(1).max(160).optional(), type: z.enum(['brand', 'client']).optional(), color: z.string().max(20).optional(), url: z.string().url().nullable().optional(), sort_order: z.number().int().optional() }) }),
  z.object({ type: z.literal('note.create'), body: z.string().trim().min(1).max(20000), workspace_id: z.string().uuid().nullable().optional(), task_id: z.string().uuid().nullable().optional() }),
  z.object({ type: z.literal('decision.create'), body: z.string().trim().min(1).max(20000), workspace_id: z.string().uuid().nullable().optional(), task_id: z.string().uuid().nullable().optional() }),
  z.object({ type: z.literal('policy.update'), data: z.object({ archive_requires_approval: z.boolean().optional(), delete_requires_approval: z.boolean().optional(), external_send_requires_approval: z.boolean().optional(), publishing_requires_approval: z.boolean().optional(), deploy_requires_approval: z.boolean().optional() }).refine(x => Object.keys(x).length > 0) }),
  z.object({ type: z.literal('telegram.send'), chat_id: z.string().min(1), text: z.string().trim().min(1).max(4096) }),
  z.object({ type: z.literal('build.trigger'), workflow: z.string().trim().min(1).max(100) }),
  z.object({ type: z.literal('publishing.trigger'), target: z.string().trim().min(1).max(300) }),
  z.object({ type: z.literal('payment.change'), target: z.string().trim().min(1).max(300) }),
  z.object({ type: z.literal('stripe.change'), target: z.string().trim().min(1).max(300) }),
])
export type AgentAction = z.infer<typeof agentActionSchema>

const permission: Record<AgentAction['type'], string> = {
  'task.create': 'task:create', 'task.update': 'task:update', 'task.move': 'task:move', 'task.archive': 'task:archive', 'task.restore': 'task:archive', 'task.delete': 'task:delete',
  'workspace.create': 'workspace:write', 'workspace.update': 'workspace:write', 'note.create': 'note:create', 'decision.create': 'decision:create', 'policy.update': 'policy:write', 'telegram.send': 'external:send', 'build.trigger': 'build:trigger', 'publishing.trigger': 'publishing:trigger', 'payment.change': 'payment:change', 'stripe.change': 'stripe:change',
}

function secretMatches(value: string | null) {
  const expected = process.env.AGENT_ACTION_SECRET
  if (!expected || !value) return false
  const a = Buffer.from(expected), b = Buffer.from(value)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function isAgentActionSecret(value: string | null) { return secretMatches(value) }

export async function authorizeAgent(actorId: string, source: string) {
  const parsedSource = sourceChannel.safeParse(source)
  if (!parsedSource.success) throw new ActionError('Unsupported source channel', 400)
  const db = createAdminClient()
  const { data, error } = await db.from('agent_identities').select('*').eq('id', actorId).eq('active', true).single()
  if (error || !data) throw new ActionError('Unknown or inactive agent identity', 403)
  return { db, identity: data, source: parsedSource.data }
}

export class ActionError extends Error { constructor(message: string, public status = 400) { super(message) } }

async function audit(db: ReturnType<typeof createAdminClient>, input: { requestId: string; actorId: string; source: string; action: string; targetType?: string; targetId?: string; instruction?: string; before?: unknown; after?: unknown; success: boolean; error?: string }) {
  const { error } = await db.from('agent_action_audit_log').insert({ request_id: input.requestId, actor_id: input.actorId, source_channel: input.source, action_type: input.action, target_type: input.targetType ?? null, target_id: input.targetId ?? null, instruction: input.instruction ?? null, before_state: input.before ?? null, after_state: input.after ?? null, success: input.success, error_details: input.error ?? null })
  if (error) throw new Error(`Audit log write failed: ${error.message}`)
}

function needsApproval(action: AgentAction, policies: Record<string, boolean>) {
  return action.type === 'task.delete' ||
    (action.type === 'task.archive' && policies.archive_requires_approval) ||
    (action.type === 'telegram.send' && policies.external_send_requires_approval) ||
    ((action.type === 'build.trigger') && policies.deploy_requires_approval) ||
    (action.type === 'publishing.trigger' && policies.publishing_requires_approval) ||
    ((action.type === 'payment.change' || action.type === 'stripe.change') && policies.external_send_requires_approval)
}

export async function executeAgentAction(raw: unknown, context: { actorId: string; source: string; requestId?: string; instruction?: string; approved?: boolean }) {
  const action = agentActionSchema.parse(raw)
  const { db, identity, source } = await authorizeAgent(context.actorId, context.source)
  const permissions = identity.permissions as string[]
  if (!permissions.includes('*') && !permissions.includes(permission[action.type])) throw new ActionError('This agent is not permitted to perform that action', 403)
  const requestId = context.requestId ?? randomUUID()
  const { data: policies, error: policyError } = await db.from('agent_action_policies').select('*').eq('id', true).single()
  if (policyError || !policies) throw new ActionError('Action policies are unavailable', 500)

  if (!context.approved && needsApproval(action, policies)) {
    const { data: confirmation, error } = await db.from('agent_action_confirmations').insert({ actor_id: context.actorId, source_channel: source, action }).select().single()
    if (error) throw new ActionError(error.message, 500)
    await audit(db, { requestId, actorId: context.actorId, source, action: `${action.type}.requested`, instruction: context.instruction, after: confirmation, success: true })
    return { pendingApproval: true, confirmationId: confirmation.id, message: `Approval required. Reply with /approve ${confirmation.id} within 15 minutes.` }
  }

  let before: any = null, after: any = null, targetType = '', targetId = ''
  try {
    if (action.type.startsWith('task.')) {
      const taskAction: any = action
      targetType = 'task'; targetId = typeof taskAction.task_id === 'string' ? taskAction.task_id : ''
      if (typeof taskAction.task_id === 'string') {
        const r = await db.from('bpe_tasks').select('*').eq('id', taskAction.task_id).single()
        if (r.error || !r.data) throw new ActionError('Task not found', 404)
        before = r.data
      }
      if (action.type === 'task.create') {
        const r = await db.from('bpe_tasks').insert({ ...action.data, status: action.data.status ?? 'idea', type: action.data.type ?? 'internal', owner: action.data.owner ?? 'brad', priority: action.data.priority ?? 'medium', deliverables: action.data.deliverables ?? [], handoff_checklist: action.data.handoff_checklist ?? [], sort_order: action.data.sort_order ?? 0 }).select().single(); if (r.error) throw new ActionError(r.error.message, 500); after = r.data; targetId = after.id
      } else if (action.type === 'task.delete') {
        const r = await db.from('bpe_tasks').delete().eq('id', taskAction.task_id); if (r.error) throw new ActionError(r.error.message, 500); after = { deleted: true, id: taskAction.task_id }
      } else {
        const data = action.type === 'task.update' ? action.data : action.type === 'task.move' ? { status: action.status } : action.type === 'task.archive' ? { archived_at: new Date().toISOString(), archived_by: context.actorId } : { archived_at: null, archived_by: null }
        const r = await db.from('bpe_tasks').update({ ...data, updated_at: new Date().toISOString() }).eq('id', taskAction.task_id).select().single(); if (r.error) throw new ActionError(r.error.message, 500); after = r.data
      }
    } else if (action.type.startsWith('workspace.')) {
      const workspaceAction: any = action
      targetType = 'workspace'; targetId = typeof workspaceAction.workspace_id === 'string' ? workspaceAction.workspace_id : ''
      if (action.type === 'workspace.update') { const r = await db.from('bpe_workspaces').select('*').eq('id', action.workspace_id).single(); if (r.error || !r.data) throw new ActionError('Workspace not found', 404); before = r.data }
      const data = action.type === 'workspace.create' ? { ...action.data, slug: action.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') } : workspaceAction.data
      const r = action.type === 'workspace.create' ? await db.from('bpe_workspaces').insert(data).select().single() : await db.from('bpe_workspaces').update(data).eq('id', workspaceAction.workspace_id).select().single()
      if (r.error) throw new ActionError(r.error.message, 500); after = r.data; targetId = after.id
    } else if (action.type === 'note.create' || action.type === 'decision.create') {
      targetType = action.type === 'note.create' ? 'note' : 'decision'
      const r = await db.from('bpe_notes').insert({ kind: action.type === 'note.create' ? 'note' : 'decision', body: action.body, workspace_id: action.workspace_id ?? null, task_id: action.task_id ?? null, actor_id: context.actorId, source_channel: source }).select().single(); if (r.error) throw new ActionError(r.error.message, 500); after = r.data; targetId = after.id
    } else if (action.type === 'policy.update') {
      targetType = 'policy'; targetId = 'default'; const r = await db.from('agent_action_policies').select('*').eq('id', true).single(); before = r.data
      const updated = await db.from('agent_action_policies').update({ ...action.data, updated_at: new Date().toISOString(), updated_by: context.actorId }).eq('id', true).select().single(); if (updated.error) throw new ActionError(updated.error.message, 500); after = updated.data
    } else if (action.type === 'telegram.send') {
      targetType = 'telegram_message'; targetId = action.chat_id
      const token = process.env.TELEGRAM_BOT_TOKEN; if (!token) throw new ActionError('Telegram is not configured', 503)
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: action.chat_id, text: action.text }) }); if (!response.ok) throw new ActionError('Telegram rejected the message', 502); after = { sent: true, chat_id: action.chat_id }
    } else { throw new ActionError('Build workflow dispatch is not configured for this deployment', 501) }
    await audit(db, { requestId, actorId: context.actorId, source, action: action.type, targetType, targetId, instruction: context.instruction, before, after, success: true })
    return { pendingApproval: false, data: after, message: `${action.type.replace('.', ' ')} completed.` }
  } catch (error) {
    await audit(db, { requestId, actorId: context.actorId, source, action: action.type, targetType, targetId, instruction: context.instruction, before, after, success: false, error: error instanceof Error ? error.message : String(error) }).catch(() => undefined)
    throw error
  }
}

export async function approveAgentAction(confirmationId: string, actorId: string, source: string, requestId?: string) {
  const { db } = await authorizeAgent(actorId, source)
  const { data, error } = await db.from('agent_action_confirmations').select('*').eq('id', confirmationId).eq('status', 'pending').single()
  if (error || !data || new Date(data.expires_at) < new Date()) throw new ActionError('Confirmation is invalid or expired', 404)
  if (data.actor_id !== actorId) throw new ActionError('Only the requesting actor can approve this action', 403)
  const result = await executeAgentAction(data.action, { actorId, source, requestId, approved: true, instruction: 'Explicit approval' })
  await db.from('agent_action_confirmations').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', confirmationId)
  return result
}
