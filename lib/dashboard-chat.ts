import { createHash } from 'crypto'
import { cookies } from 'next/headers'
import { COOKIE_NAME, isValidDashboardSession } from '@/lib/password-auth'

export type ExecutiveAgent = 'wendy' | 'ellie'
export type ChatMessage = { id: string; role: 'user' | 'assistant'; agent: ExecutiveAgent | null; content: string; created_at: string }
export type ActionProposal = { id: string; message_id: string | null; agent: ExecutiveAgent; kind: string; risk: string; summary: string; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; created_at: string }

export async function actorScope() {
  const session = (await cookies()).get(COOKIE_NAME)?.value
  return isValidDashboardSession(session) && session ? createHash('sha256').update(`bpe-chat:${session}`).digest('hex') : null
}

export function actionCandidate(content: string) {
  const text = content.toLowerCase()
  if (!/\b(create|update|move|archive|delete|build|implement|deploy|send|publish|change|run)\b/.test(text)) return null
  const high = /\b(delete|deploy|publish|send|permission|secret|credential|payment|migration)\b/.test(text)
  return { kind: /\b(build|implement|code|repo|branch|pull request|pr)\b/.test(text) ? 'build' : 'task_change', risk: high ? 'high' : 'medium' }
}
