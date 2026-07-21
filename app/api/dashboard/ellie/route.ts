import { createUIMessageStream, createUIMessageStreamResponse, UIMessage } from 'ai'
import { requireAuth } from '@/lib/require-auth'
import { getDashboardContext } from '@/lib/dashboardContext'
import { buildAgentSystemPrompt } from '@/lib/agentSystemPrompt'

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
  const model = process.env.ELLIE_OPENAI_MODEL ?? 'gpt-5.6-terra'

  if (!apiKey) {
    return ellieStream('Ellie is here, but she needs an OpenAI API key connected first. Add OPENAI_API_KEY_BPE or OPENAI_API_KEY in Vercel, then redeploy.')
  }

  const dashboardContext = await getDashboardContext(supabase)
  const system = buildAgentSystemPrompt('ellie', dashboardContext)

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
