import { NextRequest, NextResponse } from 'next/server'

// TTS for the voice room, routed to each agent's own ElevenLabs voice.
// Wendy = ELEVENLABS_VOICE_ID_WENDY, Ellie = ELEVENLABS_VOICE_ID_ELLIE.

export async function POST(req: NextRequest) {
  const { text, agent } = (await req.json()) as { text: string; agent: 'wendy' | 'ellie' }
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ELEVENLABS_API_KEY not set' }, { status: 500 })

  const voiceId =
    agent === 'ellie'
      ? process.env.ELEVENLABS_VOICE_ID_ELLIE ?? process.env.ELEVENLABS_VOICE_ID
      : process.env.ELEVENLABS_VOICE_ID_WENDY ?? process.env.ELEVENLABS_VOICE_ID

  if (!voiceId) return NextResponse.json({ error: 'voice id not set' }, { status: 500 })

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: res.status })
  }

  const audio = await res.arrayBuffer()
  return new NextResponse(audio, { headers: { 'Content-Type': 'audio/mpeg' } })
}
