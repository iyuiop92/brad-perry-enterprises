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
  deliverables: ChecklistItem[]
  handoff_checklist: ChecklistItem[]
  sort_order: number
  created_at: string
  updated_at: string
}
