import { jsonSchema, tool } from 'ai'
import { executeAgentTaskTool } from '@/lib/agent-task-executor'
import { claudeTaskTools } from '@/lib/agent-task-tools'
import type { AgentIdentity } from '@/lib/agent-task-api'

/** AI SDK tools used by Wendy's dashboard chat and voice routes. */
export function agentTaskAITools(agent: AgentIdentity) {
  return Object.fromEntries(claudeTaskTools.map(definition => [
    definition.name,
    tool({
      description: definition.description,
      inputSchema: jsonSchema(definition.input_schema as never),
      execute: input => executeAgentTaskTool(agent, definition.name, input),
    }),
  ]))
}
