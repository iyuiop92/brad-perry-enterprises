export type TaskStatus = 'idea' | 'in_progress' | 'blocked' | 'done'
export type TaskType = 'internal' | 'client'
export type TaskOwner = 'brad' | 'wendy' | 'ellie'
export type TaskPhase = 'discovery' | 'design' | 'build' | 'launch' | 'live'
export type TaskPriority = 'high' | 'medium' | 'low'

export interface ChecklistItem {
  label: string
  done: boolean
}

export interface Task {
  id: string
  title: string
  notes: string | null
  status: TaskStatus
  type: TaskType
  brand: string | null
  owner: TaskOwner
  phase: TaskPhase | null
  priority: TaskPriority
  workspace_id: string | null
  deliverables: ChecklistItem[]
  handoff_checklist: ChecklistItem[]
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  color: string
  type: 'brand' | 'client'
  url: string | null
  sort_order: number
  created_at: string
  task_count: number
  active_count: number
  blocked_count: number
  idea_count: number
}

export interface InboxItem {
  id: string
  content: string
  created_at: string
}
