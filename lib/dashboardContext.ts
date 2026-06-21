import { requireAuth } from '@/lib/require-auth'

type Supabase = NonNullable<Awaited<ReturnType<typeof requireAuth>>['supabase']>

function phoenixDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

function healthLine(log: any) {
  if (!log) return 'not logged'
  if (log.entry_type === 'blood_pressure') {
    return log.bp_systolic && log.bp_diastolic
      ? `${log.bp_systolic}/${log.bp_diastolic}${log.pulse ? ` pulse ${log.pulse}` : ''}`
      : 'blood pressure logged without complete reading'
  }
  if (log.entry_type === 'nutrition') {
    return log.meal_name ?? (log.calories ? `${log.calories} calories` : 'nutrition logged')
  }
  if (log.entry_type === 'workout') {
    return log.workout_type ?? (log.duration_mins ? `${log.duration_mins} minutes` : 'workout logged')
  }
  return log.notes ?? 'logged'
}

export async function getDashboardContext(supabase: Supabase) {
  const today = phoenixDate()

  const [
    { data: workspaces },
    { data: tasks },
    { data: dailyState },
    { data: healthLogs },
    { data: inboxItems },
  ] = await Promise.all([
    supabase.from('bpe_workspaces').select('id, name, slug, type, color').order('sort_order'),
    supabase.from('bpe_tasks').select('id, title, status, priority, phase, brand, workspace_id, notes, updated_at').neq('status', 'done'),
    supabase.from('bpe_daily_state').select('*').eq('state_date', today).maybeSingle(),
    supabase.from('bpe_health_logs').select('*').order('logged_at', { ascending: false }).limit(20),
    supabase.from('bpe_inbox').select('*').order('created_at', { ascending: false }).limit(12),
  ])

  const openTasks = tasks ?? []
  const workspaceLines = (workspaces ?? []).map(workspace => {
    const wsTasks = openTasks.filter(task => task.workspace_id === workspace.id)
    const active = wsTasks.filter(task => task.status === 'in_progress').length
    const todo = wsTasks.filter(task => task.status === 'blocked').length
    const ideas = wsTasks.filter(task => task.status === 'idea').length
    return `- ${workspace.name} (${workspace.type}): ${active} active, ${todo} to do, ${ideas} ideas`
  }).join('\n')

  const taskLines = openTasks
    .slice(0, 24)
    .map(task => `- [${task.status} / ${task.priority}] ${task.title}${task.brand ? ` (${task.brand})` : ''}${task.notes ? ` — ${task.notes.slice(0, 180)}` : ''}`)
    .join('\n')

  const tomorrowFocus = dailyState?.tomorrow_focus_task_id
    ? openTasks.find(task => task.id === dailyState.tomorrow_focus_task_id)
    : null
  const recurring = Array.isArray(dailyState?.recurring_items) ? dailyState.recurring_items : []
  const recurringDone = recurring.filter((item: any) => item.done).length
  const calendarItems = Array.isArray(dailyState?.calendar_items) ? dailyState.calendar_items : []
  const latestBloodPressure = (healthLogs ?? []).find(log => log.entry_type === 'blood_pressure')
  const latestNutrition = (healthLogs ?? []).find(log => log.entry_type === 'nutrition')
  const latestWorkout = (healthLogs ?? []).find(log => log.entry_type === 'workout')
  const inboxLines = (inboxItems ?? []).map(item => `- ${item.content}`).join('\n')

  const dailyLines = [
    `Date: ${today}`,
    `Tomorrow first: ${tomorrowFocus?.title ?? 'not set'}`,
    `Closeout note: ${dailyState?.closeout_note?.trim() || 'none'}`,
    `Calendar prep: ${calendarItems.length ? calendarItems.join(' | ') : 'none'}`,
    `Recurring checklist: ${recurringDone}/${recurring.length || 0} complete${recurring.length ? ` (${recurring.map((item: any) => `${item.done ? 'done' : 'open'}: ${item.label}`).join('; ')})` : ''}`,
    `Body check: BP ${healthLine(latestBloodPressure)}; food ${healthLine(latestNutrition)}; workout ${healthLine(latestWorkout)}`,
    `Inbox: ${inboxLines || 'clear'}`,
  ].join('\n')

  return {
    today,
    workspaces: workspaces ?? [],
    tasks: openTasks,
    workspaceLines,
    taskLines,
    dailyLines,
  }
}
