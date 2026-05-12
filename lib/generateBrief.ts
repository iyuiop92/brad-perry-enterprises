import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_BPE ?? process.env.ANTHROPIC_API_KEY,
})

interface BriefTask {
  title: string
  status: string
  priority: string
  brand?: string | null
}

const SCHEDULE_MAP: Record<string, string> = {
  Monday: 'Normal work day. Hockey practice coaching at 5pm (hard stop). Gym 11am. Pickup 2pm.',
  Tuesday: 'Normal work day. Noon open hockey option — currently skipping for gym. Gym 11am. Pickup 2pm.',
  Wednesday: 'Kids HALF-DAY — pickup is NOON not 2pm. Plan gym timing accordingly.',
  Thursday: 'Normal work day. Noon open hockey option — currently skipping. Gym 11am. Pickup 2pm.',
  Friday: 'Sometimes 6am skate (Arcadia) or noon skate (Mullett). Sometimes Parents Night Out with wife.',
  Saturday: 'Coached game 10am–1pm (hard stop). No regular gym.',
  Sunday: 'Family hike in the morning. Pizza cheat day. Recovery.',
}

export async function generateMorningBrief(tasks: BriefTask[]): Promise<string> {
  const now = new Date()
  const tz = 'America/Phoenix'
  const dayName = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' })
  const dateStr = now.toLocaleDateString('en-US', {
    timeZone: tz, month: 'long', day: 'numeric', year: 'numeric',
  })

  const highPri = tasks.filter(t => t.priority === 'high').slice(0, 6)
  const blocked = tasks.filter(t => t.status === 'blocked').slice(0, 4)

  const taskLines = [
    highPri.length
      ? `HIGH PRIORITY:\n${highPri.map(t => `  - [${t.status}] ${t.title}`).join('\n')}`
      : '',
    blocked.length
      ? `BLOCKED:\n${blocked.map(t => `  - ${t.title}${t.brand ? ` (${t.brand})` : ''}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n')

  const system = `You are Wendy, Brad Perry's AI business partner. Write his morning brief for ${dayName}, ${dateStr}.

TODAY'S SCHEDULE:
${SCHEDULE_MAP[dayName] ?? 'Normal work day.'}

BRAD'S DAILY PATTERN:
Wake 3:30–4am · Kids up 6:20am · Drop-off 7:20am · Gym 11am (FASTED) · Pickup 2pm · Bed 10–10:30pm
Eating window: 2–9pm — intermittent fasting, workout at 11am is fully fasted.
Wednesday is kids half-day — pickup NOON.

FITNESS CONTEXT:
205 lbs — weight goal achieved, now focused on body comp + hockey performance.
Cardio: treadmill level 3, incline 3, ~1hr. Weights: heavy to failure.
Post-workout: chicken + rice or Gain protein shake. Sometimes second shake before bed.

HEALTH (critical):
Stroke survivor — daily blood pressure log is medically non-negotiable.
Meds: Lisinopril + Amlodipine (BP), Testosterone 100mg/wk (TRT).

BUSINESS PRIORITIES (live):
${taskLines || 'No urgent tasks in queue — good time to push new initiatives.'}

Priority order: (1) revenue-blocking, (2) content library, (3) traffic/referrals, (4) platform improvements.

Write the brief in exactly this format — no preamble, no extra commentary:

WORKOUT
[2–3 lines: what to do today. Be specific. Adjust for day of week — no gym Saturday (coached game), Sunday is hike/rest. Fasted at 11am.]

FOOD
[2 lines: macro targets for today's eating window (opens 2–4pm). Account for fasted 11am workout.]

FOCUS
[3–5 lines: top business priorities for today. Reference actual tasks above. Direct, no fluff.]

SCHEDULE
[1–2 lines: key time blocks for today only. Highlight any hard stops or unusual constraints.]

HEALTH CHECK
[1 line: prompt Brad to log his BP. Keep it tight.]

— Wendy`

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system,
    messages: [{ role: 'user', content: 'generate' }],
  })

  return text
}
