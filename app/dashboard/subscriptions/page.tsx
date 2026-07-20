'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Subscription, BillingCycle } from '@/lib/types'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatCost(cents: number, cycle: BillingCycle): string {
  if (cents === 0) return 'usage-based'
  const dollars = (cents / 100).toFixed(2)
  return cycle === 'annual' ? `$${dollars}/yr` : `$${dollars}/mo`
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function monthlyEquivalent(cents: number, cycle: BillingCycle): number {
  if (cents === 0) return 0
  return cycle === 'annual' ? Math.round(cents / 12) : cents
}

function dateColor(days: number): string {
  if (days <= 7) return '#ef4444'
  if (days <= 14) return '#f59e0b'
  return '#94a3b8'
}

// ── form defaults ─────────────────────────────────────────────────────────────

interface FormState {
  service: string
  cost_dollars: string
  billing_cycle: BillingCycle
  next_billing_date: string
  billing_url: string
  notes: string
}

const emptyForm = (): FormState => ({
  service: '',
  cost_dollars: '',
  billing_cycle: 'monthly',
  next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  billing_url: '',
  notes: '',
})

function subToForm(s: Subscription): FormState {
  return {
    service: s.service,
    cost_dollars: s.cost_cents === 0 ? '' : (s.cost_cents / 100).toFixed(2),
    billing_cycle: s.billing_cycle,
    next_billing_date: s.next_billing_date,
    billing_url: s.billing_url ?? '',
    notes: s.notes ?? '',
  }
}

// ── component ─────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [paidLoading, setPaidLoading] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)

  // panel state
  const [panelOpen, setPanelOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Subscription | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchSubs = useCallback(async () => {
    const res = await fetch('/api/subscriptions')
    if (res.ok) setSubs(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchSubs() }, [fetchSubs])

  // total monthly burn (exclude usage-based)
  const totalMonthlyCents = subs.reduce((acc, s) => acc + monthlyEquivalent(s.cost_cents, s.billing_cycle), 0)

  function openAdd() {
    setEditTarget(null)
    setForm(emptyForm())
    setFormError(null)
    setPanelOpen(true)
  }

  function openEdit(sub: Subscription) {
    setEditTarget(sub)
    setForm(subToForm(sub))
    setFormError(null)
    setPanelOpen(true)
  }

  function closePanel() {
    setPanelOpen(false)
    setEditTarget(null)
    setFormError(null)
  }

  async function handleMarkPaid(sub: Subscription) {
    setPaidLoading(sub.id)
    const res = await fetch(`/api/subscriptions/${sub.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markPaid: true }),
    })
    if (res.ok) await fetchSubs()
    setPaidLoading(null)
  }

  async function handleDelete(sub: Subscription) {
    if (!confirm(`Delete "${sub.service}"?`)) return
    setDeleteLoading(sub.id)
    await fetch(`/api/subscriptions/${sub.id}`, { method: 'DELETE' })
    await fetchSubs()
    setDeleteLoading(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.service.trim()) { setFormError('Service name is required'); return }
    if (!form.next_billing_date) { setFormError('Next billing date is required'); return }

    setSaving(true)
    const payload = {
      service: form.service.trim(),
      cost_cents: form.cost_dollars === '' ? 0 : Math.round(parseFloat(form.cost_dollars) * 100),
      billing_cycle: form.billing_cycle,
      next_billing_date: form.next_billing_date,
      billing_url: form.billing_url.trim() || null,
      notes: form.notes.trim() || null,
    }

    const url = editTarget ? `/api/subscriptions/${editTarget.id}` : '/api/subscriptions'
    const method = editTarget ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setFormError(body.error ?? 'Something went wrong')
      setSaving(false)
      return
    }

    await fetchSubs()
    closePanel()
    setSaving(false)
  }

  // ── styles ─────────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7,
    padding: '8px 12px',
    color: '#e2e8f0',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const btnSmall = (color: string, bg: string): React.CSSProperties => ({
    height: 26,
    padding: '0 10px',
    borderRadius: 5,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    cursor: 'pointer',
    border: `1px solid ${color}`,
    color: color,
    background: bg,
  })

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#04040a', padding: '28px 24px', fontFamily: 'Outfit, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Subscriptions</h1>
          <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0', fontWeight: 400 }}>
            Monthly billing tracker + Telegram alerts
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{
            height: 32, padding: '0 16px', borderRadius: 7, cursor: 'pointer',
            background: '#00b4ff', color: '#04040a',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', border: 'none',
            boxShadow: '0 0 14px rgba(0,180,255,0.45)',
          }}
        >
          + ADD
        </button>
      </div>

      {/* Summary bar */}
      <div style={{
        background: 'rgba(0,180,255,0.06)',
        border: '1px solid rgba(0,180,255,0.15)',
        borderRadius: 10,
        padding: '14px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
      }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#00b4ff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Total monthly (fixed)
          </span>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', marginTop: 2 }}>
            ${(totalMonthlyCents / 100).toFixed(2)}
            <span style={{ fontSize: 13, fontWeight: 400, color: '#64748b', marginLeft: 4 }}>/mo</span>
          </div>
        </div>
        <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ fontSize: 12, color: '#64748b' }}>
          {subs.filter(s => s.cost_cents === 0).length} usage-based not included
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <span style={{ fontSize: 12, color: '#334155', letterSpacing: '0.1em' }}>LOADING...</span>
        </div>
      ) : subs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#334155', fontSize: 13 }}>
          No subscriptions yet. Hit + ADD to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {subs.map(sub => {
            const days = daysUntil(sub.next_billing_date)
            const dateCol = dateColor(days)
            const isPaidLoading = paidLoading === sub.id
            const isDeleteLoading = deleteLoading === sub.id

            return (
              <div key={sub.id} style={card}>
                {/* Service info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', marginBottom: 2 }}>
                    {sub.service}
                  </div>
                  {sub.notes && (
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2, lineHeight: 1.4 }}>
                      {sub.notes}
                    </div>
                  )}
                </div>

                {/* Cost */}
                <div style={{ width: 110, textAlign: 'right' }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700,
                    color: sub.cost_cents === 0 ? '#475569' : '#f1f5f9',
                  }}>
                    {formatCost(sub.cost_cents, sub.billing_cycle)}
                  </div>
                </div>

                {/* Cycle badge */}
                <div style={{ width: 72, textAlign: 'center' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                    padding: '3px 7px', borderRadius: 4,
                    background: sub.billing_cycle === 'annual' ? 'rgba(168,85,247,0.15)' : 'rgba(0,180,255,0.1)',
                    color: sub.billing_cycle === 'annual' ? '#a855f7' : '#00b4ff',
                    textTransform: 'uppercase',
                  }}>
                    {sub.billing_cycle}
                  </span>
                </div>

                {/* Next billing date */}
                <div style={{ width: 120, textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: dateCol }}>
                    {sub.next_billing_date}
                  </div>
                  <div style={{ fontSize: 10, color: dateCol, marginTop: 1, opacity: 0.8 }}>
                    {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days}d`}
                  </div>
                </div>

                {/* Pay link */}
                <div style={{ width: 52, textAlign: 'center' }}>
                  {sub.billing_url ? (
                    <a
                      href={sub.billing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, fontWeight: 700, color: '#00b4ff', textDecoration: 'none' }}
                    >
                      Pay →
                    </a>
                  ) : (
                    <span style={{ fontSize: 11, color: '#1e293b' }}>—</span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    onClick={() => handleMarkPaid(sub)}
                    disabled={isPaidLoading}
                    style={btnSmall('#22c55e', 'rgba(34,197,94,0.08)')}
                  >
                    {isPaidLoading ? '...' : 'Paid'}
                  </button>
                  <button
                    onClick={() => openEdit(sub)}
                    style={btnSmall('#94a3b8', 'rgba(148,163,184,0.06)')}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(sub)}
                    disabled={isDeleteLoading}
                    style={btnSmall('#ef4444', 'rgba(239,68,68,0.06)')}
                  >
                    {isDeleteLoading ? '...' : 'Del'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit panel */}
      {panelOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={closePanel}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(3px)',
            }}
          />

          {/* Slide-in panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, zIndex: 50,
            background: '#07090f',
            borderLeft: '1px solid rgba(0,180,255,0.12)',
            boxShadow: '-20px 0 60px rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Panel header */}
            <div style={{
              padding: '18px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
                {editTarget ? 'Edit Subscription' : 'Add Subscription'}
              </h2>
              <button
                onClick={closePanel}
                style={{ background: 'none', border: 'none', color: '#475569', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {formError && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 7, padding: '10px 14px', marginBottom: 16,
                  fontSize: 12, color: '#fca5a5',
                }}>
                  {formError}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Service name *</label>
                <input
                  style={inputStyle}
                  value={form.service}
                  onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                  placeholder="e.g. Claude Code"
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Cost ($ — leave blank if usage-based)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost_dollars}
                    onChange={e => setForm(f => ({ ...f, cost_dollars: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div style={{ width: 130 }}>
                  <label style={labelStyle}>Billing cycle</label>
                  <select
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    value={form.billing_cycle}
                    onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value as BillingCycle }))}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Next billing date *</label>
                <input
                  style={inputStyle}
                  type="date"
                  value={form.next_billing_date}
                  onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Billing URL</label>
                <input
                  style={inputStyle}
                  type="url"
                  value={form.billing_url}
                  onChange={e => setForm(f => ({ ...f, billing_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Notes</label>
                <textarea
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes..."
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1, height: 36, borderRadius: 7, cursor: 'pointer',
                    background: '#00b4ff', color: '#04040a',
                    fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', border: 'none',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving...' : editTarget ? 'Save Changes' : 'Add Subscription'}
                </button>
                <button
                  type="button"
                  onClick={closePanel}
                  style={{
                    height: 36, padding: '0 16px', borderRadius: 7, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#64748b', fontSize: 12, fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
