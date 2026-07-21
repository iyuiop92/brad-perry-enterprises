import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, UIMessage } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { requireAuth } from '@/lib/require-auth'
import { getDashboardContext } from '@/lib/dashboardContext'
import { buildAgentSystemPrompt } from '@/lib/agentSystemPrompt'

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

function selectWendyTier(messages: UIMessage[]) {
  const tiers = {
    claude5: {
      name: 'Claude 5',
      model: process.env.WENDY_CLAUDE_5_MODEL ?? 'claude-sonnet-5',
    },
    opus: {
      name: 'Opus',
      model: process.env.WENDY_OPUS_MODEL ?? 'claude-opus-4-8',
    },
    fable: {
      name: 'Fable',
      model: process.env.WENDY_FABLE_MODEL ?? 'claude-fable-5',
    },
  }

  let selected = tiers.claude5
  for (const message of messages) {
    if (message.role !== 'user') continue
    const text = messageText(message).toLowerCase()

    if (/\b(fable|highest tier|top tier|max tier|maximum tier)\b/.test(text)) {
      selected = tiers.fable
    } else if (/\b(opus|deep mode|higher model|heavy model)\b/.test(text)) {
      selected = tiers.opus
    } else if (/\b(claude 5|sonnet 5|default tier|normal tier|standard tier)\b/.test(text)) {
      selected = tiers.claude5
    }
  }

  return selected
}

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json()

  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const dashboardContext = await getDashboardContext(supabase)
  const system = buildAgentSystemPrompt('wendy', dashboardContext)

  const modelMessages = await convertToModelMessages(messages)
  const wendyTier = selectWendyTier(messages)

  try {
    const { text } = await generateText({
      model: anthropic(wendyTier.model),
      system: `${system}

ACTIVE WENDY TIER:
- Tier name: ${wendyTier.name}
- Anthropic model: ${wendyTier.model}

Tier behavior:
- Default tier is Claude 5.
- If Brad asks what tier or model you are running, answer with the active tier name and model.
- If Brad asks for Fable, highest tier, top tier, or maximum tier, use the Fable tier.
- If Brad asks for Opus, deep mode, higher model, or heavy model, use the Opus tier.
- If Brad asks for Claude 5, Sonnet 5, default tier, normal tier, or standard tier, use the Claude 5 tier.`,
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
