import { NextResponse } from 'next/server'
import {
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

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Context) {
  const auth = authenticateAgent(request)
  if (isResponse(auth)) return auth
  const { id } = await params
  const { data, error } = await auth.supabase.from('bpe_tasks').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return jsonError('Task not found.', 404)
  return NextResponse.json({ task: data })
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = authenticateAgent(request)
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readJsonObject(request)
  if (isResponse(body)) return body

  const archive = body.archive === true
  const result = taskPatchFromBody(body)
  if ('error' in result) return jsonError(result.error)
  if (Object.keys(result.patch).length === 0 && !archive) return jsonError('Provide one or more mutable task fields, status, or archive: true.')

  const action = archive ? 'archive' : 'status' in result.patch ? 'move' : 'update'
  const update = {
    ...result.patch,
    ...(archive ? { archived_at: new Date().toISOString() } : {}),
    ...agentWriteFields(auth.agent, action),
  }
  const { data, error } = await auth.supabase.from('bpe_tasks').update(update).eq('id', id).select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return jsonError('Task not found.', 404)

  const auditError = await writeAudit(auth.supabase, id, auth.agent, action, { patch: result.patch, archived: archive })
  if (auditError) return NextResponse.json({ error: `Task was updated but audit logging failed: ${auditError.message}` }, { status: 500 })
  return NextResponse.json({ task: data })
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = authenticateAgent(request)
  if (isResponse(auth)) return auth
  const { id } = await params
  const { data: existing, error: findError } = await auth.supabase.from('bpe_tasks').select('*').eq('id', id).maybeSingle()
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })
  if (!existing) return jsonError('Task not found.', 404)

  const auditError = await writeAudit(auth.supabase, id, auth.agent, 'delete', { deleted: existing })
  if (auditError) return NextResponse.json({ error: `Delete cancelled because audit logging failed: ${auditError.message}` }, { status: 500 })
  const { error } = await auth.supabase.from('bpe_tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
