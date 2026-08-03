/**
 * Provider-neutral task tools. Each tool is executed as an authenticated HTTP
 * request to /api/agent/tasks; the API derives the agent identity from its key.
 */
const taskProperties = {
  title: { type: 'string', description: 'Short, action-oriented task title.' },
  notes: { type: ['string', 'null'], description: 'Task context or next steps.' },
  status: { type: 'string', enum: ['idea', 'to_do', 'in_progress', 'done'] },
  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
  type: { type: 'string', enum: ['internal', 'client'] },
  workspace_id: { type: ['string', 'null'], description: 'Workspace UUID from bpe_list_board.' },
  brand: { type: ['string', 'null'] },
  owner: { type: 'string', enum: ['brad', 'wendy', 'ellie'] },
  phase: { type: ['string', 'null'], enum: ['discovery', 'design', 'build', 'launch', 'live', null] },
  sort_order: { type: 'integer' },
} as const

const definitions = [
  {
    name: 'bpe_list_board',
    description: 'Read the current live BPE task board, including workspace names, titles, types, statuses, priorities, notes, and agent audit metadata. Use it before changing an existing task.',
    input_schema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        status: { type: 'string', enum: ['idea', 'to_do', 'in_progress', 'done'] },
        include_archived: { type: 'boolean', default: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'bpe_get_task',
    description: 'Read one task by UUID, including its latest audit fields.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'bpe_create_task',
    description: 'Create a task on the live BPE board. The caller identity is recorded automatically from the API key.',
    input_schema: { type: 'object', properties: taskProperties, required: ['title'], additionalProperties: false },
  },
  {
    name: 'bpe_update_task',
    description: 'Update task fields other than status. The caller identity and timestamp are recorded automatically.',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, ...taskProperties }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'bpe_move_task',
    description: 'Move a task to idea, to_do, in_progress, or done.',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, status: taskProperties.status }, required: ['id', 'status'], additionalProperties: false },
  },
  {
    name: 'bpe_archive_task',
    description: 'Archive a task without deleting it. Archived tasks can be read with include_archived=true.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'bpe_delete_task',
    description: 'Permanently delete a task only when explicitly requested. The delete action is recorded in the immutable agent audit table first.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
  },
] as const

export const claudeTaskTools = definitions

export const openAITaskTools = definitions.map(({ name, description, input_schema }) => ({
  type: 'function' as const,
  function: { name, description, parameters: input_schema, strict: false },
}))

export type AgentTaskToolName = (typeof definitions)[number]['name']
