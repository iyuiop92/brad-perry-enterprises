import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, UIMessage } from 'ai'
import { google } from '@ai-sdk/google'
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

function extractOllamaText(data: unknown) {
  if (!data || typeof data !== 'object') return ''
  const record = data as Record<string, unknown>
  const message = record.message
  if (message && typeof message === 'object') {
    const content = (message as Record<string, unknown>).content
    if (typeof content === 'string') return content
  }
  return typeof record.response === 'string' ? record.response : ''
}

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json()

  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const configuredOllamaUrl = process.env.CLEAVER_OLLAMA_URL ?? process.env.OLLAMA_BASE_URL
  const baseUrl = configuredOllamaUrl ?? 'http://127.0.0.1:11434'
  const localModel = process.env.CLEAVER_MODEL ?? 'qwen3.6:27b'
  const geminiModel = process.env.CLEAVER_GEMINI_MODEL ?? 'gemini-2.5-flash'

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

  async function fallbackToGemini(reason: string) {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return cleaverStream(`${reason} Gemini fallback is also missing GOOGLE_GENERATIVE_AI_API_KEY.`)
    }

    const modelMessages = await convertToModelMessages(messages)
    const { text } = await generateText({
      model: google(geminiModel),
      system: `${system}\n\nYou are currently running through Cleaver's Gemini fallback because local Ollama is not reachable from this deployment. Stay in Cleaver's voice. Do not mention the provider unless Brad asks.`,
      messages: modelMessages,
    })

    return cleaverStream(text)
  }

  if (!configuredOllamaUrl && process.env.VERCEL) {
    return fallbackToGemini('Cleaver could not find a production Ollama bridge.')
  }

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
        model: localModel,
        stream: false,
        messages: ollamaMessages,
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('Cleaver local model error', response.status, detail)
      return fallbackToGemini(`Cleaver is wired to local Ollama, but Ollama rejected "${localModel}".`)
    }

    const data = await response.json()
    const text = extractOllamaText(data) || 'Cleaver did not return a text response.'
    return cleaverStream(text)
  } catch (error) {
    console.error('Cleaver route error', error)
    return fallbackToGemini(`Cleaver could not reach local Ollama at ${baseUrl}.`)
  }
}
