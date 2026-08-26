import { NextRequest, NextResponse } from 'next/server'
import { executeAgentAction } from '@/lib/agent-actions'

const WENDY_SECRET = process.env.WENDY_SECRET

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-wendy-secret')
  if (!WENDY_SECRET || secret !== WENDY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  if (!body.title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  try {
    const result = await executeAgentAction({ type: 'task.create', data: { ...body, owner: 'brad' } }, { actorId: 'wendy', source: 'website_chat', instruction: body.notes })
    return NextResponse.json({ ok: true, task: result.data }, { status: 201 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Task creation failed' }, { status: 400 }) }
}
