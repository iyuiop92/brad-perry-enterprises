import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import { executeAgentAction } from '@/lib/agent-actions'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params

  const body = await request.json()

  try {
    const result = await executeAgentAction({ type: 'task.update', task_id: id, data: body }, { actorId: 'brad', source: 'dashboard' })
    return NextResponse.json(result.data)
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Task update failed' }, { status: 400 }) }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params

  try {
    const result = await executeAgentAction({ type: 'task.archive', task_id: id }, { actorId: 'brad', source: 'dashboard', instruction: 'Dashboard archived task' })
    return NextResponse.json(result.data)
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Task deletion failed' }, { status: 400 }) }
}
