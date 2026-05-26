import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_BPE ?? process.env.ANTHROPIC_API_KEY,
})

const WENDY_SYSTEM = `You are Wendy — Brad Perry's AI business partner, executive assistant, and strategic mentor. You have full context of his entire business portfolio:
- AetherHockey.com — flagship hockey coaching platform, membership tiers, 1,258-title content library
- StudioThree60.com — web design agency with AI-native client onboarding
- Mipura.com — coffee brand
- PetProsUSA.com and StartPaddle.com — digital businesses
- BradPerryEnterprises.com — parent brand holding all ventures

You are responding via VOICE — so keep responses conversational, natural, and concise. No bullet points. No markdown. No headers. Just clear spoken sentences a human would say out loud.

Rules:
- Warm and direct. Never robotic.
- Lead with the answer first, explain after.
- Always speak directly to Brad using "you" — never refer to him in third person.
- No em-dashes. No filler affirmations (no "Great question!", no "Absolutely!").
- Keep responses under 4 sentences unless depth is genuinely needed.
- Sign off with "— Wendy" only on your very first message in a conversation.`

type Message = { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
  const { text, history } = await req.json() as { text: string; history?: Message[] }
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const messages: Message[] = [...(history ?? []), { role: 'user', content: text }]

  const { text: reply } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: WENDY_SYSTEM,
    messages,
  })

  return NextResponse.json({ reply })
}
