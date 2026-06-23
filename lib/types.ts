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

export type BillingCycle = 'monthly' | 'annual'

export interface Subscription {
  id: string
  service: string
  cost_cents: number
  billing_cycle: BillingCycle
  next_billing_date: string
  billing_url: string | null
  notes: string | null
  alert_sent_7d: boolean
  alert_sent_1d: boolean
  created_at: string
}

export type HealthEntryType = 'blood_pressure' | 'nutrition' | 'workout'

export interface HealthLog {
  id: string
  entry_type: HealthEntryType
  logged_at: string
  bp_systolic: number | null
  bp_diastolic: number | null
  pulse: number | null
  meal_name: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  workout_type: string | null
  duration_mins: number | null
  intensity: string | null
  notes: string | null
  source: string
  created_at: string
}

export interface RecurringDailyItem {
  id: string
  label: string
  done: boolean
}

export interface DailyState {
  id: string
  state_date: string
  tomorrow_focus_task_id: string | null
  closeout_note: string
  calendar_items: string[]
  recurring_items: RecurringDailyItem[]
  created_at: string
  updated_at: string
}

export type VideoIdeaStatus = 'idea' | 'research' | 'planned' | 'filmed' | 'edited' | 'published'

export interface VideoIdea {
  id: string
  title: string
  status: VideoIdeaStatus
  social_media: string
  free_tier: string
  paid_tier: string
  notes: string
  research_notes: string
  sort_order: number
  created_at: string
  updated_at: string
}
