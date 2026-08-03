import { executeAgentTaskTool } from '@/lib/agent-task-executor'
import { openAITaskTools } from '@/lib/agent-task-tools'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function responseText(data: { output_text?: unknown; output?: unknown }) {
  if (typeof data.output_text === 'string') return data.output_text
  const output = Array.isArray(data.output) ? data.output : []
  return output
    .flatMap((item: { content?: { text?: string }[] }) => Array.isArray(item.content) ? item.content : [])
    .map(content => content.text ?? '')
    .filter(Boolean)
    .join('\n')
}

/** Runs up to four OpenAI Responses tool rounds, with server-side board access. */
export async function runEllieTaskToolLoop({ apiKey, model, instructions, input }: { apiKey: string; model: string; instructions: string; input: ChatMessage[] }) {
  let requestBody: Record<string, unknown> = { model, instructions, input, tools: openAITaskTools }
  for (let round = 0; round < 4; round += 1) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody),
    })
    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`)
    const data = await response.json() as { id?: string; output?: Array<{ type?: string; name?: string; call_id?: string; arguments?: string }>; output_text?: string }
    const calls = (data.output ?? []).filter(item => item.type === 'function_call' && item.name && item.call_id)
    if (!calls.length) return responseText(data)
    const outputs = await Promise.all(calls.map(async call => {
      let input: unknown = {}
      try { input = JSON.parse(call.arguments ?? '{}') } catch { input = {} }
      const result = await executeAgentTaskTool('ellie', call.name as Parameters<typeof executeAgentTaskTool>[1], input)
      return { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) }
    }))
    requestBody = { model, instructions, previous_response_id: data.id, input: outputs, tools: openAITaskTools }
  }
  throw new Error('Ellie task tool loop exceeded its safety limit.')
}
