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

  const wsLines = (workspaces ?? []).map(w => {
    const wsTasks = (tasks ?? []).filter(t => t.workspace_id === w.id)
    const active = wsTasks.filter(t => t.status === 'in_progress').length
    const blocked = wsTasks.filter(t => t.status === 'blocked').length
    const ideas = wsTasks.filter(t => t.status === 'idea').length
    return `- ${w.name} (${w.type}): ${active} active, ${blocked} to do, ${ideas} ideas`
  }).join('\n')

  const highPri = (tasks ?? []).filter(t => t.priority === 'high').slice(0, 8)
  const blocked = (tasks ?? []).filter(t => t.status === 'blocked').slice(0, 6)

  const highPriLines = highPri.map(t => `  - [${t.status}] ${t.title}${t.phase ? ` (${t.phase})` : ''}`).join('\n')
  const blockedLines = blocked.map(t => `  - ${t.title} (${t.brand ?? 'unassigned'})`).join('\n')

  const system = `You are Wendy, Brad Perry's AI business partner and executive operator. You are the persistent intelligence layer of the BPE Command Center — Brad's dashboard for managing his full brand portfolio.

You have real-time visibility into Brad's entire operation. Here is the live state:

WORKSPACES & TASK COUNTS:
${wsLines || '(none configured)'}

HIGH-PRIORITY TASKS IN FLIGHT:
${highPriLines || '(none)'}

TO-DO TASKS NEEDING ATTENTION:
${blockedLines || '(none)'}

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
- You are warm, direct, and energizing — sitting right next to Brad
- Use "we" when talking about Brad's business
- Never refer to Brad in third person — always speak directly to him
- Be concise unless depth is genuinely needed
- You sign your responses with — Wendy

Priority framework when advising: (1) revenue-blocking issues, (2) content/knowledge library, (3) traffic and referrals, (4) platform improvements. Push back clearly if Brad is about to spend time on tier 4 while tier 1 is unfinished.`

  const result = streamText({
    model: anthropic(process.env.WENDY_ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'),
    system,
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse({
    onError: error => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.toLowerCase().includes('credit balance')) {
        return 'Wendy is connected to Claude, but the Anthropic account is out of API credits. Add credits in Anthropic Plans & Billing, then try me again. — Wendy'
      }
      return 'Wendy is connected, but Claude rejected this request. Check the Anthropic API key, billing, and model access. — Wendy'
    },
  })
}
