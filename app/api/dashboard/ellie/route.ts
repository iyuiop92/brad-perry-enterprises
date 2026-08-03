import { createUIMessageStream, createUIMessageStreamResponse, UIMessage } from 'ai'
import { requireAuth } from '@/lib/require-auth'
import { getDashboardContext } from '@/lib/dashboardContext'
import { buildAgentSystemPrompt } from '@/lib/agentSystemPrompt'
import { runEllieTaskToolLoop } from '@/lib/ellie-task-tool-loop'

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
  const model = process.env.ELLIE_OPENAI_MODEL ?? 'gpt-5.6-terra'

  if (!apiKey) {
    return ellieStream('Ellie is here, but she needs an OpenAI API key connected first. Add OPENAI_API_KEY_BPE or OPENAI_API_KEY in Vercel, then redeploy.')
  }

  const dashboardContext = await getDashboardContext(supabase)
  const system = buildAgentSystemPrompt('ellie', dashboardContext)

  const openAIMessages = messages
    .map(message => ({
      role: (message.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: messageText(message),
    }))
    .filter(message => message.content)

  try {
    const text = await runEllieTaskToolLoop({ apiKey, model, instructions: system, input: openAIMessages }) || 'Ellie did not get a text response back from the model.'

    return ellieStream(text)
  } catch (error) {
    console.error('Ellie route error', error)
    return ellieStream('Ellie hit a connection problem while reaching OpenAI. Check the deployment logs and OpenAI environment variables.')
  }
}
