// Auto model router for Wendy's Claude tiers.
//
// Goal: Brad stops typing "opus". Each incoming message is classified and routed
// to the cheapest capable Claude tier automatically. Explicit keywords still win
// as a manual override, so Brad can always force a tier.
//
// Cost order (per 1M tokens in/out): Haiku 1/5 -> Sonnet 3/15 -> Opus 5/25 -> Fable 10/50.
// Cheap-first: trivial chatter runs on Haiku, real work escalates to Opus, Fable
// stays manual-only. This is a zero-extra-call heuristic router (no classifier
// round-trip), so it adds no latency and no cost of its own.

export type WendyTier = { name: string; model: string; auto: boolean }

function tiers() {
  return {
    haiku: { name: 'Haiku', model: process.env.WENDY_HAIKU_MODEL ?? 'claude-haiku-4-5' },
    sonnet: { name: 'Claude 5', model: process.env.WENDY_CLAUDE_5_MODEL ?? 'claude-sonnet-5' },
    opus: { name: 'Opus', model: process.env.WENDY_OPUS_MODEL ?? 'claude-opus-4-8' },
    fable: { name: 'Fable', model: process.env.WENDY_FABLE_MODEL ?? 'claude-fable-5' },
  }
}

// Manual override — Brad naming a tier always wins.
function explicitTier(text: string): { key: keyof ReturnType<typeof tiers> } | null {
  if (/\b(fable|highest tier|top tier|max tier|maximum tier)\b/.test(text)) return { key: 'fable' }
  if (/\b(opus|deep mode|higher model|heavy model|think hard)\b/.test(text)) return { key: 'opus' }
  if (/\b(haiku|quick model|cheap model|fast model|lightweight)\b/.test(text)) return { key: 'haiku' }
  if (/\b(sonnet|claude 5|default tier|normal tier|standard tier)\b/.test(text)) return { key: 'sonnet' }
  return null
}

// Real-work signals -> Opus (strategy, writing, decisions, analysis).
const HEAVY = /\b(strateg|decid|decision|plan\b|planning|analy|write|writing|written|draft|article|copy|positioning|pitch|brainstorm|compare|comparison|review|roadmap|prioriti|business|pricing|launch|figure out|think through|weigh|pros and cons|architect|design the|outline|proposal|forecast)\b/i

// Trivial signals -> Haiku (greetings, acks, tiny lookups).
const TRIVIAL = /^(hi|hey|hello|yo|thanks|thank you|ok|okay|got it|sounds good|yes|no|yep|nope|cool|nice|great|perfect|done|will do|status|whats up|what's up)\b[.! ]*$/i

// Pick the cheapest capable tier for one message. `auto` marks whether the tier
// was chosen by the router (true) or forced by Brad (false).
export function routeWendyTier(text: string): WendyTier {
  const t = (text || '').trim()
  const T = tiers()

  const forced = explicitTier(t.toLowerCase())
  if (forced) return { ...T[forced.key], auto: false }

  const wordCount = t.split(/\s+/).filter(Boolean).length
  if (HEAVY.test(t) || wordCount > 60) return { ...T.opus, auto: true }
  if (TRIVIAL.test(t) || t.length < 40) return { ...T.haiku, auto: true }
  return { ...T.sonnet, auto: true }
}
