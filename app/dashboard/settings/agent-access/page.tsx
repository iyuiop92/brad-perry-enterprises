'use client'

import { useEffect, useState } from 'react'

type Identity = { id: string; display_name: string; role: string; permissions: string[]; active: boolean }
type Policy = Record<string, boolean | string | null>
type Audit = { id: string; actor_id: string; action_type: string; source_channel: string; success: boolean; created_at: string; error_details?: string | null }
type Task = { id: string; title: string; archived_at: string | null }

const policyLabels: Record<string, string> = { archive_requires_approval: 'Archive', delete_requires_approval: 'Permanent delete', external_send_requires_approval: 'External sends', publishing_requires_approval: 'Publishing', deploy_requires_approval: 'Deploys' }

export default function AgentAccessPage() {
  const [identities, setIdentities] = useState<Identity[]>([]), [policies, setPolicies] = useState<Policy>({}), [audit, setAudit] = useState<Audit[]>([]), [archived, setArchived] = useState<Task[]>([]), [error, setError] = useState('')
  async function load() {
    const [access, logs, tasks] = await Promise.all([fetch('/api/agent-actions?view=identities'), fetch('/api/agent-actions/audit'), fetch('/api/agent-actions?archived=true')])
    if (!access.ok || !logs.ok || !tasks.ok) { setError('Unable to load Agent Access. Please sign in again.'); return }
    const accessData = await access.json(); setIdentities(accessData.identities ?? []); setPolicies(accessData.policies ?? {}); setAudit(await logs.json()); setArchived(await tasks.json())
  }
  useEffect(() => { load() }, [])
  async function setPolicy(key: string, value: boolean) {
    const response = await fetch('/api/agent-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_channel: 'dashboard', action: { type: 'policy.update', data: { [key]: value } } }) })
    if (!response.ok) { setError((await response.json()).error ?? 'Policy update failed'); return }
    setPolicies(prev => ({ ...prev, [key]: value }))
  }
  async function restore(taskId: string) {
    const response = await fetch('/api/agent-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_channel: 'dashboard', action: { type: 'task.restore', task_id: taskId } }) })
    if (!response.ok) { setError((await response.json()).error ?? 'Restore failed'); return }
    setArchived(prev => prev.filter(t => t.id !== taskId))
  }
  return <main className="min-h-screen bg-black px-5 py-8 text-slate-100 md:px-10">
    <div className="mx-auto max-w-6xl"><a href="/dashboard" className="text-sm text-sky-400">← Dashboard</a><h1 className="mt-4 text-3xl font-semibold">Agent Access</h1><p className="mt-2 text-slate-400">Server-side agent permissions, approval controls, and immutable action history.</p>{error && <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-red-200">{error}</p>}
      <section className="mt-8 grid gap-4 md:grid-cols-2"><Panel title="Agent identities">{identities.map(i => <div key={i.id} className="border-b border-white/10 py-3 last:border-0"><div className="font-medium">{i.display_name} <span className="text-xs text-slate-500">{i.id} · {i.role}</span></div><div className="mt-1 text-xs text-slate-400">{i.permissions.join(', ')}</div></div>)}</Panel><Panel title="Approval controls">{Object.entries(policyLabels).map(([key, label]) => <label key={key} className="flex items-center justify-between border-b border-white/10 py-3 last:border-0"><span>{label}</span><input aria-label={`${label} requires approval`} type="checkbox" checked={Boolean(policies[key])} onChange={e => setPolicy(key, e.target.checked)} className="h-4 w-4 accent-sky-500" /></label>)}</Panel></section>
      <section className="mt-4 grid gap-4 md:grid-cols-2"><Panel title="Webhook and API credentials"><p className="text-sm text-slate-400">Credentials are server-only and intentionally never displayed here. Rotate AGENT_ACTION_SECRET or TELEGRAM_WEBHOOK_SECRET in Vercel to revoke a credential. Telegram access is restricted to TELEGRAM_BRAD_USER_ID.</p></Panel><Panel title="Archived tasks">{archived.length ? archived.map(t => <div key={t.id} className="flex items-center justify-between gap-3 border-b border-white/10 py-3 last:border-0"><span>{t.title}</span><button onClick={() => restore(t.id)} className="rounded-md border border-sky-500/50 px-2 py-1 text-xs text-sky-300">Restore</button></div>) : <p className="text-sm text-slate-500">No archived tasks.</p>}</Panel></section>
      <section className="mt-4"><Panel title="Recent action audit">{audit.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-500"><tr><th className="pb-2">When</th><th>Actor</th><th>Action</th><th>Source</th><th>Result</th></tr></thead><tbody>{audit.map(row => <tr key={row.id} className="border-t border-white/10"><td className="py-2 text-slate-400">{new Date(row.created_at).toLocaleString()}</td><td>{row.actor_id}</td><td>{row.action_type}</td><td>{row.source_channel}</td><td className={row.success ? 'text-emerald-400' : 'text-red-400'}>{row.success ? 'Success' : row.error_details ?? 'Failed'}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">No agent actions yet.</p>}</Panel></section>
    </div></main>
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-[10px] border border-white/10 bg-slate-950 p-5"><h2 className="mb-3 text-lg font-medium">{title}</h2>{children}</section> }
