'use client'
import type { Task, Workspace } from '@/lib/types'

function healthPulse(ws: Workspace): number {
  if (ws.task_count === 0) return 50
  return Math.min(100, Math.round(
    ((ws.active_count * 2 + (ws.task_count - ws.blocked_count)) / (ws.task_count * 3)) * 100
  ))
}

function wendyInsight(ws: Workspace | null, blocked: Task[], active: Task[]): string {
  if (!ws) return 'Select a workspace to activate the constellation.'
  if (blocked.length > 1)
    return `${blocked.length} to-do items in ${ws.name}. Choose one before adding new work.`
  if (blocked.length === 1)
    return `One to-do item in ${ws.name}. Decide whether to start it or park it.`
  if (active.length > 4)
    return `High activity across ${active.length} tasks in ${ws.name}. Consider narrowing to 2–3 to maintain real momentum.`
  if (active.length === 0)
    return `No active tasks in ${ws.name}. Time to push something in progress.`
  return `${ws.name} is running clean — ${active.length} task${active.length !== 1 ? 's' : ''} in motion.`
}

export default function BrandPanel({
  workspace,
  tasks,
  workspaces,
  onSelectWs,
  onSelectTask,
}: {
  workspace: Workspace | null
  tasks: Task[]
  workspaces: Workspace[]
  onSelectWs: (ws: Workspace) => void
  onSelectTask: (task: Task) => void
}) {
  const wsTasks = workspace ? tasks.filter(t => t.workspace_id === workspace.id) : []
  const activeTasks = wsTasks.filter(t => t.status === 'in_progress')
  const blockedTasks = wsTasks.filter(t => t.status === 'blocked')
  const pulse = workspace ? healthPulse(workspace) : 0
  const insight = wendyInsight(workspace, blockedTasks, activeTasks)

  const nextActions = workspace
    ? [
        blockedTasks.length > 0 ? 'Choose a to-do item' : 'Add a high-priority task',
        activeTasks.length === 0 ? 'Start an initiative' : 'Update task progress',
        'Review ideas backlog',
      ]
    : []

  return (
    <div
      className="flex flex-col h-full"
      style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Panel header */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.35)' }}
      >
        <p
          className="text-[10px] font-[800] uppercase tracking-[0.2em]"
          style={{ color: '#00b4ff', fontFamily: 'var(--font-outfit)' }}
        >
          Active Constellation
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Workspace selector */}
        <div>
          <p className="text-[9px] font-[600] uppercase tracking-wider mb-1.5" style={{ color: '#334155' }}>
            Workspace
          </p>
          <select
            value={workspace?.id ?? ''}
            onChange={e => {
              const ws = workspaces.find(w => w.id === e.target.value)
              if (ws) onSelectWs(ws)
            }}
            className="w-full text-xs px-3 py-2 rounded-lg outline-none cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${workspace ? workspace.color + '35' : 'rgba(255,255,255,0.08)'}`,
              color: workspace?.color ?? '#475569',
              fontFamily: 'var(--font-outfit)',
            }}
          >
            <option value="" style={{ background: '#04040a' }}>— Select Brand —</option>
            {workspaces.map(ws => (
              <option key={ws.id} value={ws.id} style={{ background: '#04040a', color: ws.color }}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>

        {workspace && (
          <>
            {/* Health Pulse */}
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${workspace.color}20` }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-[700] uppercase tracking-wider" style={{ color: '#475569' }}>
                  Health Pulse
                </p>
                <span className="text-sm font-[800]" style={{ color: workspace.color }}>
                  {pulse}
                  <span className="text-[10px] font-[500]" style={{ color: '#334155' }}>/100</span>
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pulse}%`, background: workspace.color }}
                />
              </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Active', val: workspace.active_count, color: '#00b4ff' },
                { label: 'To do', val: workspace.blocked_count, color: '#f59e0b' },
                { label: 'Ideas', val: workspace.idea_count, color: '#475569' },
              ].map(({ label, val, color }) => (
                <div
                  key={label}
                  className="rounded-lg px-2 py-2.5 text-center"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <p className="text-lg font-[800]" style={{ color }}>{val}</p>
                  <p className="text-[8px] font-[600] uppercase tracking-wider" style={{ color: '#283044' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {/* To do */}
            {blockedTasks.length > 0 && (
              <div>
                <p className="text-[9px] font-[700] uppercase tracking-wider mb-2" style={{ color: '#f59e0b' }}>
                  To do
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {blockedTasks.slice(0, 4).map(t => (
                    <button
                      key={t.id}
                      onClick={() => onSelectTask(t)}
                      className="text-[9px] px-2 py-1 rounded-full font-[600] transition-opacity hover:opacity-80"
                      style={{
                        background: 'rgba(245,158,11,0.1)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245,158,11,0.22)',
                      }}
                    >
                      {t.title.length > 22 ? t.title.slice(0, 22) + '…' : t.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* In Progress tasks */}
            {activeTasks.length > 0 && (
              <div>
                <p className="text-[9px] font-[700] uppercase tracking-wider mb-2" style={{ color: '#334155' }}>
                  In Progress
                </p>
                <div className="flex flex-col gap-1.5">
                  {activeTasks.slice(0, 5).map(t => (
                    <button
                      key={t.id}
                      onClick={() => onSelectTask(t)}
                      className="text-left text-xs px-3 py-2 rounded-lg transition-all truncate"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        color: '#64748b',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Wendy AI insight */}
        <div
          className="rounded-xl p-3"
          style={{ background: 'rgba(0,180,255,0.04)', border: '1px solid rgba(0,180,255,0.14)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[8px] font-[800] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(0,180,255,0.1)', color: '#00b4ff', border: '1px solid rgba(0,180,255,0.2)' }}
            >
              ✦ WENDY
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#00b4ff', animation: 'breathe 2s ease-in-out infinite', '--glow-color': '#00b4ff66', '--glow-min': '2px', '--glow-max': '6px' } as React.CSSProperties}
            />
            <span className="text-[8px] font-[700]" style={{ color: '#00b4ff' }}>LIVE</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>{insight}</p>
        </div>

        {/* Next Best Actions */}
        {nextActions.length > 0 && (
          <div>
            <p className="text-[9px] font-[700] uppercase tracking-wider mb-2" style={{ color: '#334155' }}>
              Next Best Actions
            </p>
            <div className="flex flex-col gap-1.5">
              {nextActions.map((action, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    color: '#475569',
                  }}
                >
                  <span style={{ color: '#00b4ff' }}>›</span>
                  {action}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Connectivity footer */}
      <div
        className="shrink-0 px-4 py-2 flex items-center gap-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.25)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
        <span className="text-[9px]" style={{ color: '#283044' }}>
          Data Connectivity: <span style={{ color: '#22c55e' }}>Connected</span>
        </span>
      </div>
    </div>
  )
}
