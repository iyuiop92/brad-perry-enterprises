import { convertToModelMessages, streamText, UIMessage } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { requireAuth } from '@/lib/require-auth'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_BPE ?? process.env.ANTHROPIC_API_KEY,
})

export const maxDuration = 60

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json()

  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const [{ data: workspaces }, { data: tasks }] = await Promise.all([
    supabase.from('bpe_workspaces').select('id, name, slug, type, color').order('sort_order'),
    supabase.from('bpe_tasks').select('id, title, status, priority, phase, brand, workspace_id, notes').neq('status', 'done'),
  ])

  const workspaceLines = (workspaces ?? []).map(workspace => {
    const wsTasks = (tasks ?? []).filter(task => task.workspace_id === workspace.id)
    const active = wsTasks.filter(task => task.status === 'in_progress').length
    const todo = wsTasks.filter(task => task.status === 'blocked').length
    const ideas = wsTasks.filter(task => task.status === 'idea').length
    return `- ${workspace.name}: ${active} active, ${todo} to do, ${ideas} ideas`
  }).join('\n')

  const taskLines = (tasks ?? [])
    .slice(0, 20)
    .map(task => `- [${task.status}] ${task.title}${task.brand ? ` (${task.brand})` : ''}${task.notes ? ` — ${task.notes.slice(0, 160)}` : ''}`)
    .join('\n')

  const system = `You are Ellie, Brad Perry's code, dashboard, and execution collaborator, named after Dr. Ellie Arroway from Contact.

You are separate from Wendy. Wendy is the business/operator voice. Ellie is the builder/research/design-implementation voice.

You are inside Brad Perry Enterprises' dashboard. You can help Brad clarify what to build, draft precise Codex requests, review dashboard ideas, turn messy thoughts into implementation steps, and explain code/product tradeoffs.

Current dashboard context:

WORKSPACES:
${workspaceLines || '(none configured)'}

OPEN TASKS:
${taskLines || '(none)'}

Behavior:
- Call yourself Ellie.
- Be direct, curious, grounded, and concrete.
- If Brad asks you to make a code change from this deployed dashboard chat, do not claim you changed files. Instead, produce a precise implementation request or checklist that Codex can execute.
- If Brad asks for strategy, answer through the lens of what gets built, tested, removed, or shipped next.
- Prefer short answers with clear action.
- Never sign as Wendy.
- Do not use em dashes.`

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system,
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
