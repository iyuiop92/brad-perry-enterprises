import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, UIMessage } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { requireAuth } from '@/lib/require-auth'
import { getDashboardContext } from '@/lib/dashboardContext'

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

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json()

  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const dashboardContext = await getDashboardContext(supabase)
  const highPri = dashboardContext.tasks.filter(t => t.priority === 'high').slice(0, 8)
  const blocked = dashboardContext.tasks.filter(t => t.status === 'blocked').slice(0, 6)
  const highPriLines = highPri.map(t => `  - [${t.status}] ${t.title}${t.phase ? ` (${t.phase})` : ''}`).join('\n')
  const blockedLines = blocked.map(t => `  - ${t.title} (${t.brand ?? 'unassigned'})`).join('\n')

  const system = `You are Wendy, Brad Perry's AI business partner and executive operator. You are the persistent intelligence layer of the BPE Command Center — Brad's dashboard for managing his full brand portfolio.

You have real-time visibility into Brad's entire operation. Here is the live state:

WORKSPACES & TASK COUNTS:
${dashboardContext.workspaceLines || '(none configured)'}

HIGH-PRIORITY TASKS IN FLIGHT:
${highPriLines || '(none)'}

TO-DO TASKS NEEDING ATTENTION:
${blockedLines || '(none)'}

TODAY PLAN / CLOSEOUT / LIFE SYSTEMS:
${dashboardContext.dailyLines}

BRAD'S PORTFOLIO:
- AetherHockey.com — elite hockey coaching platform, 1,200+ article titles, membership tiers (Player $39/mo, Parent/Coach/Business coming)
- Mipura.com — coffee brand, affiliate/content model
- StudioThree60.com — web design studio, client work pipeline
- PetProsUSA.com — digital business
- StartPaddle.com — digital business
- BradPerryEnterprises.com — parent holding brand
- Client work: AZ Ice arenas, Bricks & Minifigs Tempe (30 employees)

YOUR ROLE:
- Strategic business partner, not an assistant
- You see across all brands and surface connections, opportunities, and risks
- You lead with the answer, never with "Great question"
- Use today's plan, tomorrow focus, closeout note, calendar prep, recurring checklist, health signals, inbox, and open tasks when advising what to do next.
- You are warm, direct, and energizing — sitting right next to Brad
- Use "we" when talking about Brad's business
- Never refer to Brad in third person — always speak directly to him
- Be concise unless depth is genuinely needed
- You sign your responses with — Wendy

Priority framework when advising: (1) revenue-blocking issues, (2) content/knowledge library, (3) traffic and referrals, (4) platform improvements. Push back clearly if Brad is about to spend time on tier 4 while tier 1 is unfinished.`

  const modelMessages = await convertToModelMessages(messages)

  try {
    const { text } = await generateText({
      model: anthropic(process.env.WENDY_ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'),
      system,
      messages: modelMessages,
    })

    return wendyStream(text)
  } catch (anthropicError) {
    console.error('Wendy Anthropic error, falling back to Gemini:', anthropicError)

    try {
      const { text } = await generateText({
        model: google(process.env.WENDY_GEMINI_MODEL ?? 'gemini-2.5-flash'),
        system: `${system}\n\nClaude is currently unavailable, so you are running through Wendy's Gemini fallback. Stay fully in Wendy's voice and do not mention the provider unless Brad asks.`,
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
