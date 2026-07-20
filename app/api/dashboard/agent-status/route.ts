import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

type OllamaModel = {
  name?: string
}

function configured(name: string) {
  return Boolean(process.env[name])
}

function maskOllamaUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    return `${url.protocol}//${url.host}`
  } catch {
    return 'configured endpoint'
  }
}

function isTailnetUrl(rawUrl: string) {
  try {
    const host = new URL(rawUrl).hostname
    return host.endsWith('.ts.net') || /^100\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  } catch {
    return false
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET() {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const configuredOllamaUrl = process.env.CLEAVER_OLLAMA_URL ?? process.env.OLLAMA_BASE_URL
  const baseUrl = configuredOllamaUrl ?? 'http://127.0.0.1:11434'
  const cleaverModel = process.env.CLEAVER_MODEL ?? 'qwen3.6:27b'
  const ollamaAuthToken = process.env.CLEAVER_OLLAMA_AUTH_TOKEN ?? process.env.OLLAMA_AUTH_TOKEN
  const deepSeekApiKey = process.env.CLEAVER_DEEPSEEK_API_KEY ?? process.env.DEEPSEEK_API_KEY
  const deepSeekModel = process.env.CLEAVER_DEEPSEEK_MODEL ?? 'deepseek-v4-flash'
  const cleaverProvider = process.env.CLEAVER_PROVIDER ?? (deepSeekApiKey ? 'deepseek' : 'ollama')
  const productionWithoutBridge = Boolean(process.env.VERCEL && !configuredOllamaUrl && cleaverProvider !== 'deepseek')
  const startedAt = Date.now()

  const status = {
    environment: process.env.VERCEL ? 'production' : 'local',
    agents: {
      wendy: {
        route: '/api/dashboard/wendy',
        provider: 'Claude tier switcher',
        fallback: 'Gemini',
        configured: configured('ANTHROPIC_API_KEY_BPE') || configured('ANTHROPIC_API_KEY'),
        fallbackReady: configured('GOOGLE_GENERATIVE_AI_API_KEY'),
        defaultModel: process.env.WENDY_CLAUDE_5_MODEL ?? 'claude-sonnet-5',
      },
      ellie: {
        route: '/api/dashboard/ellie',
        provider: 'OpenAI Responses',
        configured: configured('OPENAI_API_KEY_BPE') || configured('OPENAI_API_KEY'),
        defaultModel: process.env.ELLIE_OPENAI_MODEL ?? 'gpt-5.4-mini',
      },
      sam: {
        route: '/api/dashboard/sam',
        provider: 'Gemini',
        configured: configured('GOOGLE_GENERATIVE_AI_API_KEY'),
        defaultModel: process.env.SAM_GEMINI_MODEL ?? 'gemini-2.5-flash',
      },
      cleaver: {
        route: '/api/dashboard/cleaver',
        provider: cleaverProvider === 'deepseek' ? 'DeepSeek V4' : 'Ollama',
        fallback: cleaverProvider === 'deepseek' ? 'Ollama / Gemini' : 'Gemini',
        configured: cleaverProvider === 'deepseek' ? Boolean(deepSeekApiKey) : Boolean(configuredOllamaUrl) || !process.env.VERCEL,
        fallbackReady: configured('GOOGLE_GENERATIVE_AI_API_KEY'),
        defaultModel: cleaverProvider === 'deepseek' ? deepSeekModel : cleaverModel,
      },
    },
    deepseek: {
      configured: Boolean(deepSeekApiKey),
      active: cleaverProvider === 'deepseek',
      model: deepSeekModel,
    },
    ollama: {
      configured: Boolean(configuredOllamaUrl),
      endpoint: maskOllamaUrl(baseUrl),
      isTailnet: isTailnetUrl(baseUrl),
      authConfigured: Boolean(ollamaAuthToken),
      productionWithoutBridge,
      reachable: false,
      latencyMs: null as number | null,
      activeModel: cleaverModel,
      models: [] as string[],
      error: productionWithoutBridge
        ? 'No CLEAVER_OLLAMA_URL or OLLAMA_BASE_URL is set in production, so Cleaver will use Gemini fallback.'
        : null as string | null,
    },
  }

  if (productionWithoutBridge) {
    return NextResponse.json(status)
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/api/tags`, {
      headers: {
        ...(ollamaAuthToken ? { Authorization: `Bearer ${ollamaAuthToken}` } : {}),
      },
    }, 3500)

    status.ollama.latencyMs = Date.now() - startedAt

    if (!response.ok) {
      status.ollama.error = `Ollama responded with HTTP ${response.status}.`
      return NextResponse.json(status)
    }

    const data = await response.json()
    const models = Array.isArray(data?.models) ? data.models as OllamaModel[] : []
    status.ollama.models = models.map(model => model.name).filter((name): name is string => Boolean(name))
    status.ollama.reachable = true
  } catch (error) {
    status.ollama.latencyMs = Date.now() - startedAt
    status.ollama.error = error instanceof Error ? error.message : 'Unable to reach Ollama.'
  }

  return NextResponse.json(status)
}
