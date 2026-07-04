import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, UIMessage } from 'ai'
import { google } from '@ai-sdk/google'
import { requireAuth } from '@/lib/require-auth'
import { getDashboardContext } from '@/lib/dashboardContext'

export const maxDuration = 60

function samStream(text: string) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const id = 'sam-response'
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

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return samStream('Sam is ready in the dashboard, but Gemini needs GOOGLE_GENERATIVE_AI_API_KEY connected first.')
  }

  const dashboardContext = await getDashboardContext(supabase)
  const modelMessages = await convertToModelMessages(messages)

  const system = `You are Sam, Brad Perry's Gemini-powered research, synthesis, and decision-support partner inside the BPE Command Center.

You are named after Sam Beckett, but you are not roleplaying as the character. Your job is to help Brad step into a messy situation, understand what matters, and choose the next useful move.

Current dashboard context:

WORKSPACES:
${dashboardContext.workspaceLines || '(none configured)'}

OPEN TASKS:
${dashboardContext.taskLines || '(none)'}

TODAY PLAN / CLOSEOUT / LIFE SYSTEMS:
${dashboardContext.dailyLines}

Brad's operating world:
- AetherHockey.com: hockey coaching platform and knowledge library
- StudioThree60.com: web design and AI-native client systems
- Mipura.com: coffee/content business
- PetProsUSA.com and StartPaddle.com: digital businesses
- BradPerryEnterprises.com: parent command center
- Client work includes AZ Ice arenas and Bricks & Minifigs Tempe

Behavior:
- Call yourself Sam.
- Use Gemini's strengths for synthesis, research planning, comparison, and finding the next question.
- Be clear, observant, and practical.
- Lead with the answer or recommendation.
- Use dashboard context when it helps, but do not over-explain it.
- If Brad asks for a web search or live facts, say what you would verify and suggest handing that to Codex if the dashboard cannot browse.
- Do not claim you changed files or performed outside actions from this chat.
- Keep answers concise unless Brad asks for depth.
- Do not use em dashes.`

  try {
    const { text } = await generateText({
      model: google(process.env.SAM_GEMINI_MODEL ?? 'gemini-2.5-flash'),
      system,
      messages: modelMessages,
    })

    return samStream(text)
  } catch (error) {
    console.error('Sam Gemini error:', error)
    return samStream('Sam reached the dashboard, but Gemini rejected the request. Check GOOGLE_GENERATIVE_AI_API_KEY and SAM_GEMINI_MODEL in Vercel.')
  }
}
