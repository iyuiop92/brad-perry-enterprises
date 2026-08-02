import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export const runtime = 'nodejs'

const MAX_AUDIO_BYTES = 15 * 1024 * 1024

// Mobile browsers do not reliably implement Web Speech recognition. This route
// accepts a short MediaRecorder clip and sends it to ElevenLabs Scribe without
// exposing the ElevenLabs key to the browser.
export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const form = await req.formData()
  const audio = form.get('audio')
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: 'A short audio recording is required.' }, { status: 400 })
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Recording is too large. Keep it under 15MB.' }, { status: 413 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ElevenLabs is not connected.' }, { status: 500 })

  const filename = 'name' in audio && typeof audio.name === 'string' ? audio.name : 'voice-message.webm'
  const upstream = new FormData()
  upstream.set('file', audio, filename)
  upstream.set('model_id', 'scribe_v2')
  upstream.set('language_code', 'eng')

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: upstream,
    })
    if (!response.ok) {
      console.error('ElevenLabs transcription error', response.status, await response.text())
      return NextResponse.json({ error: 'Could not transcribe that recording. Please try again.' }, { status: 502 })
    }

    const data = await response.json() as { text?: string }
    const text = data.text?.trim()
    if (!text) return NextResponse.json({ error: 'I did not catch any speech. Please try again.' }, { status: 422 })
    return NextResponse.json({ text })
  } catch (error) {
    console.error('Transcription route error', error)
    return NextResponse.json({ error: 'Voice transcription is temporarily unavailable.' }, { status: 502 })
  }
}
