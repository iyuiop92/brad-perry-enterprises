'use client'

import { useMemo, useState } from 'react'
import type { Task, Workspace } from '@/lib/types'

function buildCodexPrompt(workspaces: Workspace[], tasks: Task[], selectedWs: Workspace | null) {
  const scopeTasks = selectedWs
    ? tasks.filter(task => task.workspace_id === selectedWs.id || task.brand === selectedWs.name)
    : tasks

  const openTasks = scopeTasks
    .filter(task => task.status !== 'done')
    .sort((a, b) => {
      const priority = { high: 0, medium: 1, low: 2 }
      return priority[a.priority] - priority[b.priority] || b.updated_at.localeCompare(a.updated_at)
    })
    .slice(0, 8)

  const workspaceLines = workspaces
    .slice(0, 10)
    .map(workspace => `- ${workspace.name}: ${workspace.active_count} active, ${workspace.blocked_count} to do, ${workspace.idea_count} ideas`)
    .join('\n')

  const taskLines = openTasks
    .map(task => `- [${task.priority}/${task.status}] ${task.title}${task.brand ? ` (${task.brand})` : ''}${task.notes ? ` - ${task.notes}` : ''}`)
    .join('\n')

  return `You are Codex working with me on the Brad Perry Enterprises dashboard.

Goal:
- Help me turn this dashboard state into the next concrete code or operations move.
- Be direct, inspect the repo before editing, make the smallest solid change, and verify it.

Current focus:
${selectedWs ? selectedWs.name : 'Whole BPE command center'}

Dashboard context:
${workspaceLines || '- No workspaces loaded'}

Open work:
${taskLines || '- No open tasks loaded'}

Request:
`
}

export default function CodexPanel({
  workspaces,
  tasks,
  selectedWs,
}: {
  workspaces: Workspace[]
  tasks: Task[]
  selectedWs: Workspace | null
}) {
  const [copied, setCopied] = useState(false)
  const prompt = useMemo(() => buildCodexPrompt(workspaces, tasks, selectedWs), [workspaces, tasks, selectedWs])
  const activeTasks = tasks.filter(task => task.status === 'in_progress').length
  const highTasks = tasks.filter(task => task.status !== 'done' && task.priority === 'high').length

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="flex flex-col h-full" style={{ borderLeft: '1px solid rgba(251,146,60,0.16)' }}>
      <div
        className="shrink-0 px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.42)' }}
      >
        <div
          className="w-7 h-7 flex items-center justify-center shrink-0"
          style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: 6 }}
        >
          <span className="text-[10px] font-[850]" style={{ color: '#fb923c' }}>X</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-[850]" style={{ color: '#e2e8f0', fontFamily: 'var(--font-outfit)' }}>
              Codex
            </p>
            <span className="text-[8px] font-[750]" style={{ color: '#fb923c' }}>BUILD</span>
          </div>
          <p className="text-[9px]" style={{ color: '#64748b' }}>
            {selectedWs ? `Handoff for ${selectedWs.name}` : 'Direct launch and repo handoff'}
          </p>
        </div>
      </div>

      <div className="shrink-0 px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
          {[
            { label: 'Areas', value: workspaces.length, color: '#38bdf8' },
            { label: 'Active', value: activeTasks, color: '#fb923c' },
            { label: 'High', value: highTasks, color: '#f43f5e' },
          ].map(item => (
            <div
              key={item.label}
              style={{
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.025)',
                borderRadius: 6,
                padding: '8px 8px',
              }}
            >
              <p style={{ color: item.color, fontSize: 15, fontWeight: 900, lineHeight: 1 }}>{item.value}</p>
              <p style={{ color: '#64748b', fontSize: 8, fontWeight: 750, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        <div
          style={{
            border: '1px solid rgba(251,146,60,0.16)',
            background: 'rgba(251,146,60,0.055)',
            borderRadius: 7,
            padding: '10px 11px',
          }}
        >
          <p className="text-[10px] leading-relaxed" style={{ color: '#cbd5e1' }}>
            This opens the real Codex surface and gives it a clean BPE handoff. A deeper embedded agent is possible later through Codex app-server or the Codex SDK.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <a
            href="https://chatgpt.com/codex"
            target="_blank"
            rel="noreferrer"
            className="text-center text-[10px] font-[850] px-3 py-2 transition-all"
            style={{
              background: 'rgba(251,146,60,0.14)',
              border: '1px solid rgba(251,146,60,0.28)',
              color: '#fed7aa',
              borderRadius: 6,
              textDecoration: 'none',
            }}
          >
            OPEN CODEX
          </a>
          <button
            type="button"
            onClick={copyPrompt}
            className="text-[10px] font-[850] px-3 py-2 transition-all"
            style={{
              background: copied ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.025)',
              border: copied ? '1px solid rgba(34,197,94,0.26)' : '1px solid rgba(255,255,255,0.06)',
              color: copied ? '#86efac' : '#94a3b8',
              borderRadius: 6,
            }}
          >
            {copied ? 'COPIED' : 'COPY HANDOFF'}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[8px] font-[800] uppercase" style={{ color: '#64748b', letterSpacing: '0.08em' }}>
            Handoff prompt
          </p>
          <textarea
            readOnly
            value={prompt}
            className="w-full resize-none outline-none text-[10px] leading-relaxed"
            style={{
              minHeight: 310,
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 7,
              color: '#cbd5e1',
              padding: 10,
              fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
          />
        </div>
      </div>

      <div
        className="shrink-0 px-3 py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}
      >
        <p className="text-[8px] text-center" style={{ color: '#334155' }}>
          Codex opens in ChatGPT today; embedded repo control can be added as a second phase.
        </p>
      </div>
    </div>
  )
}
