import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, UIMessage } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { requireAuth } from '@/lib/require-auth'
import { getDashboardContext } from '@/lib/dashboardContext'
import { buildAgentSystemPrompt } from '@/lib/agentSystemPrompt'
import { routeWendyTier } from '@/lib/modelRouter'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_BPE ?? process.env.ANTHROPIC_API_KEY,
})

export const maxDuration = 60

function wendyStream(text: string) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const id = 'wendy-response'
      writer.write({ type: 'text-start', id })
      writer.write({ type: 'text-delta', id, delta: text })
      writer.write({ type: 'text-end', id })
    },
  })

  return createUIMessageStreamResponse({ stream })
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function messageText(message: UIMessage) {
  return message.parts
    ?.map(part => part.type === 'text' ? part.text : '')
    .join(' ')
    .trim() ?? ''
}

// Text of the most recent user message — what the auto-router classifies on.
function latestUserText(messages: UIMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messageText(messages[i])
  }
  return ''
}

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json()

  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const dashboardContext = await getDashboardContext(supabase)
  const system = buildAgentSystemPrompt('wendy', dashboardContext)

  const modelMessages = await convertToModelMessages(messages)
  const wendyTier = routeWendyTier(latestUserText(messages))

  try {
    const { text } = await generateText({
      model: anthropic(wendyTier.model),
      system: `${system}

ACTIVE WENDY TIER:
- Tier name: ${wendyTier.name}
- Anthropic model: ${wendyTier.model}
- Selected by: ${wendyTier.auto ? 'auto-router (cheapest capable model for this message)' : 'Brad (manual override)'}

Tier behavior:
- Wendy auto-routes each message to the cheapest capable Claude tier: Haiku for quick/trivial, Claude 5 for everyday work, Opus for strategy/writing/decisions. Fable is manual-only.
- Brad can always force a tier by naming it: "haiku", "claude 5"/"sonnet", "opus"/"deep mode"/"heavy model", or "fable"/"top tier"/"max tier".
- If Brad asks what tier or model you are running, answer with the active tier name and model, and mention whether it was auto-routed or forced.`,
      messages: modelMessages,
    })

    return wendyStream(text)
  } catch (anthropicError) {
    console.error('Wendy Anthropic error, falling back to Gemini:', anthropicError)

    try {
      const { text } = await generateText({
        model: google(process.env.WENDY_GEMINI_MODEL ?? 'gemini-2.5-flash'),
        system: `${system}\n\nClaude tier ${wendyTier.name} (${wendyTier.model}) is currently unavailable, so you are running through Wendy's Gemini fallback. Stay fully in Wendy's voice and do not mention the provider unless Brad asks.`,
        messages: modelMessages,
      })

      return wendyStream(text)
    } catch (geminiError) {
      console.error('Wendy Gemini fallback error:', geminiError)

      const anthropicMessage = errorMessage(anthropicError).toLowerCase()
      if (anthropicMessage.includes('credit balance')) {
        return wendyStream('Wendy is connected, but Claude is out of Anthropic API credits and the Gemini fallback also failed. Check GOOGLE_GENERATIVE_AI_API_KEY in Vercel. — Wendy')
      }

      return wendyStream('Wendy is connected, but both Claude and the Gemini fallback rejected this request. Check the dashboard provider keys and model access. — Wendy')
    }
  }
}
