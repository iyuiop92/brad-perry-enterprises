import { createUIMessageStream, createUIMessageStreamResponse, UIMessage } from 'ai'
import { requireAuth } from '@/lib/require-auth'

export const maxDuration = 60

function messageText(message: UIMessage) {
  return message.parts
    ?.map(part => {
      if (part.type === 'text') return part.text
      return ''
    })
    .join('')
    .trim() ?? ''
}

function extractOpenAIText(data: any) {
  if (typeof data?.output_text === 'string') return data.output_text

  const output = Array.isArray(data?.output) ? data.output : []
  return output
    .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .map((content: any) => content?.text ?? '')
    .filter(Boolean)
    .join('\n')
}

function ellieStream(text: string) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const id = 'ellie-response'
      writer.write({ type: 'text-start', id })
      writer.write({ type: 'text-delta', id, delta: text })
      writer.write({ type: 'text-end', id })
    },
  })

  return createUIMessageStreamResponse({ stream })
}

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json()

  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const apiKey = process.env.OPENAI_API_KEY_BPE ?? process.env.OPENAI_API_KEY
  const model = process.env.ELLIE_OPENAI_MODEL ?? 'gpt-5.4-mini'

  if (!apiKey) {
    return ellieStream('Ellie is here, but she needs an OpenAI API key connected first. Add OPENAI_API_KEY_BPE or OPENAI_API_KEY in Vercel, then redeploy.')
  }

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

  const openAIMessages = messages
    .map(message => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: messageText(message),
    }))
    .filter(message => message.content)

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions: system,
        input: openAIMessages,
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('Ellie OpenAI error', response.status, detail)
      return ellieStream(`Ellie could not reach the OpenAI model "${model}" yet. Check the Vercel env var ELLIE_OPENAI_MODEL and the OpenAI API key.`)
    }

    const data = await response.json()
    const text = extractOpenAIText(data) || 'Ellie did not get a text response back from the model.'

    return ellieStream(text)
  } catch (error) {
    console.error('Ellie route error', error)
    return ellieStream('Ellie hit a connection problem while reaching OpenAI. Check the deployment logs and OpenAI environment variables.')
  }
}
