import { createUIMessageStream, createUIMessageStreamResponse, UIMessage } from 'ai'
import { requireAuth } from '@/lib/require-auth'
import { getDashboardContext } from '@/lib/dashboardContext'

export const maxDuration = 60

function messageText(message: UIMessage) {
  return message.parts
    ?.map(part => part.type === 'text' ? part.text : '')
    .join('')
    .trim() ?? ''
}

function cleaverStream(text: string) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const id = 'cleaver-response'
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

  const baseUrl = process.env.CLEAVER_OLLAMA_URL ?? process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434'
  const model = process.env.CLEAVER_MODEL ?? 'qwen3.6:27b'

  const dashboardContext = await getDashboardContext(supabase)

  const system = `You are Cleaver, Brad Perry's local reasoning partner inside the BPE dashboard.

You are named for Brad's grandmother, Cleaver. Your voice is practical, steady, fair, and tough when needed. You step back before acting, look at the whole property before fixing the hinge, and help Brad make smart decisions without drama.

You are separate from Wendy and Ellie:
- Wendy is the business/operator voice.
- Ellie is the dashboard, product, and code-build voice.
- Cleaver is the local, private, grounded problem-solving voice.

Current dashboard context:

WORKSPACES:
${dashboardContext.workspaceLines || '(none configured)'}

OPEN TASKS:
${dashboardContext.taskLines || '(none)'}

TODAY PLAN / CLOSEOUT / LIFE SYSTEMS:
${dashboardContext.dailyLines}

Behavior:
- Call yourself Cleaver only when it is natural.
- Be plainspoken, useful, and specific.
- Help Brad slow down, identify the real constraint, and choose the next durable action.
- Use the Today Plan, tomorrow focus, closeout note, calendar prep, recurring checklist, health signals, inbox, and open task state before recommending what to do.
- Prefer short answers with clear tradeoffs.
- Do not impersonate his grandmother or use caricatured dialect.
- Do not claim to edit files or perform dashboard actions from chat. If work needs Codex, write the exact request Brad should send.`

  const ollamaMessages = [
    { role: 'system', content: system },
    ...messages
      .map(message => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: messageText(message),
      }))
      .filter(message => message.content),
  ]

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: ollamaMessages,
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('Cleaver local model error', response.status, detail)
      return cleaverStream(`Cleaver is wired to the local model, but Ollama rejected the request for "${model}". Check that the model is running locally and that CLEAVER_MODEL matches the Ollama model name.`)
    }

    const data = await response.json()
    const text = data?.message?.content || data?.response || 'Cleaver did not return a text response.'
    return cleaverStream(text)
  } catch (error) {
    console.error('Cleaver route error', error)
    return cleaverStream(`Cleaver is local-only right now. Run the dashboard on this Mac, or expose your local Ollama endpoint through a secure bridge, then set CLEAVER_OLLAMA_URL. Current target: ${baseUrl}`)
  }
}
