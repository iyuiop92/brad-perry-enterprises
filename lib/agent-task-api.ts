import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const AGENT_TASK_STATUSES = ['idea', 'to_do', 'in_progress', 'done'] as const
export const AGENT_TASK_PRIORITIES = ['high', 'medium', 'low'] as const
export const AGENT_TASK_TYPES = ['internal', 'client'] as const
export const AGENTS = ['wendy', 'ellie'] as const

export type AgentIdentity = (typeof AGENTS)[number]
export type TaskPatchResult = { patch: Record<string, unknown> } | { error: string }

type AgentAuth = { agent: AgentIdentity; supabase: ReturnType<typeof createAdminClient> }
type AgentAuthResult = AgentAuth | NextResponse

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function authenticateAgent(request: Request): AgentAuthResult {
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  const credentials: Array<[AgentIdentity, string | undefined]> = [
    ['wendy', process.env.BPE_WENDY_AGENT_API_KEY],
    ['ellie', process.env.BPE_ELLIE_AGENT_API_KEY],
  ]

  if (!credentials.every(([, key]) => key)) {
    return NextResponse.json({ error: 'Agent task API is not configured.' }, { status: 503 })
  }
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const matches = credentials.filter(([, key]) => secureEquals(token, key!))
  if (matches.length !== 1) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return { agent: matches[0][0], supabase: createAdminClient() }
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | NextResponse> {
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonError('Request body must be a JSON object.')
  }
  return body as Record<string, unknown>
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse
}

export function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === 'string' && options.includes(value)
}

const MUTABLE_FIELDS = [
  'title', 'notes', 'status', 'type', 'priority', 'brand', 'owner', 'phase',
  'deliverables', 'handoff_checklist', 'sort_order', 'workspace_id',
] as const

export function taskPatchFromBody(body: Record<string, unknown>): TaskPatchResult {
  const patch: Record<string, unknown> = {}
  for (const field of MUTABLE_FIELDS) {
    if (field in body) patch[field] = body[field]
  }

  if ('title' in patch && (typeof patch.title !== 'string' || !patch.title.trim())) {
    return { error: 'title must be a non-empty string.' }
  }
  if ('status' in patch && !isOneOf(patch.status, AGENT_TASK_STATUSES)) {
    return { error: `status must be one of: ${AGENT_TASK_STATUSES.join(', ')}.` }
  }
  if ('type' in patch && !isOneOf(patch.type, AGENT_TASK_TYPES)) {
    return { error: `type must be one of: ${AGENT_TASK_TYPES.join(', ')}.` }
  }
  if ('priority' in patch && !isOneOf(patch.priority, AGENT_TASK_PRIORITIES)) {
    return { error: `priority must be one of: ${AGENT_TASK_PRIORITIES.join(', ')}.` }
  }
  if ('owner' in patch && !['brad', ...AGENTS].includes(patch.owner as string)) {
    return { error: 'owner must be brad, wendy, or ellie.' }
  }
  if ('phase' in patch && patch.phase !== null && !['discovery', 'design', 'build', 'launch', 'live'].includes(patch.phase as string)) {
    return { error: 'phase is invalid.' }
  }
  if ('notes' in patch && patch.notes !== null && typeof patch.notes !== 'string') {
    return { error: 'notes must be a string or null.' }
  }
  if ('workspace_id' in patch && patch.workspace_id !== null && typeof patch.workspace_id !== 'string') {
    return { error: 'workspace_id must be a UUID string or null.' }
  }
  if ('sort_order' in patch && (typeof patch.sort_order !== 'number' || !Number.isInteger(patch.sort_order))) {
    return { error: 'sort_order must be an integer.' }
  }
  if ('deliverables' in patch && !Array.isArray(patch.deliverables)) return { error: 'deliverables must be an array.' }
  if ('handoff_checklist' in patch && !Array.isArray(patch.handoff_checklist)) return { error: 'handoff_checklist must be an array.' }

  return { patch }
}

export async function writeAudit(
  supabase: ReturnType<typeof createAdminClient>,
  taskId: string,
  agent: AgentIdentity,
  action: 'create' | 'update' | 'move' | 'archive' | 'delete',
  details: Record<string, unknown>,
) {
  const { error } = await supabase.from('bpe_task_agent_audit').insert({
    task_id: taskId,
    agent,
    action,
    details,
  })
  return error
}

export function agentWriteFields(agent: AgentIdentity, action: string) {
  return {
    agent_last_actor: agent,
    agent_last_action: action,
    agent_last_action_at: new Date().toISOString(),
  }
}
