'use client'

import { useState } from 'react'
import type { Task, TaskStatus, ChecklistItem } from '@/lib/types'
import StatusDot from './StatusDot'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

const PHASE_COLORS: Record<string, string> = {
  discovery: '#a855f7',
  design: '#00b4ff',
  build: '#f59e0b',
  launch: '#22c55e',
  live: '#10b981',
}

async function patchTask(id: string, body: Partial<Task>) {
  await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export default function TaskCard({
  task,
  onUpdated,
}: {
  task: Task
  onUpdated: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [deliverables, setDeliverables] = useState<ChecklistItem[]>(task.deliverables)
  const [handoff, setHandoff] = useState<ChecklistItem[]>(task.handoff_checklist)

  async function handleStatusChange(newStatus: TaskStatus) {
    setStatus(newStatus)
    await patchTask(task.id, { status: newStatus })
    onUpdated()
  }

  async function toggleDeliverable(index: number) {
    const updated = deliverables.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item
    )
    setDeliverables(updated)
    await patchTask(task.id, { deliverables: updated })
  }

  async function toggleHandoff(index: number) {
    const updated = handoff.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item
    )
    setHandoff(updated)
    await patchTask(task.id, { handoff_checklist: updated })
  }

  return (
    <div
      className="rounded-[10px] p-3 cursor-pointer transition-all"
      style={{
        background: '#0d0d1a',
        border: '1px solid rgba(0, 180, 255, 0.13)',
        transform: expanded ? 'none' : undefined,
      }}
      onMouseEnter={(e) => {
        if (!expanded) {
          const el = e.currentTarget
          el.style.borderColor = 'rgba(0, 180, 255, 0.35)'
          el.style.boxShadow = '0 0 12px rgba(0, 180, 255, 0.08)'
          el.style.transform = 'scale(1.01)'
        }
      }}
      onMouseLeave={(e) => {
        if (!expanded) {
          const el = e.currentTarget
          el.style.borderColor = 'rgba(0, 180, 255, 0.13)'
          el.style.boxShadow = 'none'
          el.style.transform = 'none'
        }
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Card header */}
      <div className="flex items-start gap-2">
        <StatusDot owner={task.owner} />
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold leading-snug truncate"
            style={{ color: '#e2e8f0' }}
          >
            {task.title}
          </p>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.brand && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(100, 116, 139, 0.15)',
                  color: '#64748b',
                }}
              >
                {task.brand}
              </span>
            )}
            {task.type === 'client' && task.phase && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: `${PHASE_COLORS[task.phase]}22`,
                  color: PHASE_COLORS[task.phase],
                }}
              >
                {task.phase}
              </span>
            )}
          </div>

          {!expanded && task.notes && (
            <p
              className="text-xs mt-1 truncate"
              style={{ color: '#64748b' }}
            >
              {task.notes}
            </p>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div
          className="mt-3 flex flex-col gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          {task.notes && (
            <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
              {task.notes}
            </p>
          )}

          {/* Deliverables */}
          {deliverables.length > 0 && (
            <div>
              <p
                className="text-xs uppercase tracking-wider mb-1.5"
                style={{ color: '#64748b' }}
              >
                Deliverables
              </p>
              <div className="flex flex-col gap-1">
                {deliverables.map((item, i) => (
                  <label key={i} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleDeliverable(i)}
                      className="accent-[#00b4ff]"
                    />
                    <span
                      className="text-xs"
                      style={{
                        color: item.done ? '#64748b' : '#e2e8f0',
                        textDecoration: item.done ? 'line-through' : 'none',
                      }}
                    >
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Handoff checklist */}
          {handoff.length > 0 && (
            <div>
              <p
                className="text-xs uppercase tracking-wider mb-1.5"
                style={{ color: '#64748b' }}
              >
                Handoff
              </p>
              <div className="flex flex-col gap-1">
                {handoff.map((item, i) => (
                  <label key={i} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleHandoff(i)}
                      className="accent-[#00b4ff]"
                    />
                    <span
                      className="text-xs"
                      style={{
                        color: item.done ? '#64748b' : '#e2e8f0',
                        textDecoration: item.done ? 'line-through' : 'none',
                      }}
                    >
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Status selector */}
          <div className="pt-1 border-t" style={{ borderColor: 'rgba(0, 180, 255, 0.1)' }}>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className="w-full rounded-[10px] px-2 py-1.5 text-xs outline-none"
              style={{
                background: '#04040a',
                border: '1px solid rgba(0, 180, 255, 0.13)',
                color: '#e2e8f0',
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
