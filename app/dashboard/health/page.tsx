'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HealthEntryType, HealthLog } from '@/lib/types'

type FormKind = HealthEntryType

interface HealthForm {
  entry_type: FormKind
  logged_at: string
  bp_systolic: string
  bp_diastolic: string
  pulse: string
  meal_name: string
  calories: string
  protein_g: string
  carbs_g: string
  fat_g: string
  workout_type: string
  duration_mins: string
  intensity: string
  notes: string
}

const nowLocal = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

const emptyForm = (entry_type: FormKind): HealthForm => ({
  entry_type,
  logged_at: nowLocal(),
  bp_systolic: '',
  bp_diastolic: '',
  pulse: '',
  meal_name: '',
  calories: '',
  protein_g: '',
  carbs_g: '',
  fat_g: '',
  workout_type: entry_type === 'workout' ? 'lift' : '',
  duration_mins: '',
  intensity: '',
  notes: '',
})

function toNumber(value: string) {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function entryLabel(entry: HealthLog) {
  if (entry.entry_type === 'blood_pressure') return 'Blood pressure'
  if (entry.entry_type === 'nutrition') return entry.meal_name || 'Nutrition'
  return entry.workout_type || 'Workout'
}

function entryDetail(entry: HealthLog) {
  if (entry.entry_type === 'blood_pressure') {
    return `${entry.bp_systolic ?? '--'}/${entry.bp_diastolic ?? '--'}${entry.pulse ? `, pulse ${entry.pulse}` : ''}`
  }
  if (entry.entry_type === 'nutrition') {
    const macros = [
      entry.calories ? `${entry.calories} cal` : null,
      entry.protein_g ? `${entry.protein_g}g protein` : null,
      entry.carbs_g ? `${entry.carbs_g}g carbs` : null,
      entry.fat_g ? `${entry.fat_g}g fat` : null,
    ].filter(Boolean)
    return macros.join(' · ') || 'Logged food'
  }
  return [
    entry.duration_mins ? `${entry.duration_mins} min` : null,
    entry.intensity || null,
  ].filter(Boolean).join(' · ') || 'Logged workout'
}

export default function HealthPage() {
  const [logs, setLogs] = useState<HealthLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<FormKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [forms, setForms] = useState<Record<FormKind, HealthForm>>({
    blood_pressure: emptyForm('blood_pressure'),
    nutrition: emptyForm('nutrition'),
    workout: emptyForm('workout'),
  })

  const fetchLogs = useCallback(async () => {
    const res = await fetch('/api/health')
    if (res.ok) setLogs(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const today = new Date().toDateString()
  const todayLogs = useMemo(() => logs.filter(log => new Date(log.logged_at).toDateString() === today), [logs, today])
  const latestBp = logs.find(log => log.entry_type === 'blood_pressure')
  const todayNutrition = todayLogs.filter(log => log.entry_type === 'nutrition')
  const todayWorkouts = todayLogs.filter(log => log.entry_type === 'workout')

  const totals = todayNutrition.reduce((acc, log) => ({
    calories: acc.calories + (log.calories ?? 0),
    protein: acc.protein + (log.protein_g ?? 0),
    carbs: acc.carbs + (log.carbs_g ?? 0),
    fat: acc.fat + (log.fat_g ?? 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  function setField(kind: FormKind, key: keyof HealthForm, value: string) {
    setForms(prev => ({ ...prev, [kind]: { ...prev[kind], [key]: value } }))
  }

  async function save(kind: FormKind) {
    setError(null)
    setSaving(kind)
    const form = forms[kind]
    const payload = {
      entry_type: kind,
      logged_at: new Date(form.logged_at).toISOString(),
      bp_systolic: toNumber(form.bp_systolic),
      bp_diastolic: toNumber(form.bp_diastolic),
      pulse: toNumber(form.pulse),
      meal_name: form.meal_name.trim() || null,
      calories: toNumber(form.calories),
      protein_g: toNumber(form.protein_g),
      carbs_g: toNumber(form.carbs_g),
      fat_g: toNumber(form.fat_g),
      workout_type: form.workout_type.trim() || null,
      duration_mins: toNumber(form.duration_mins),
      intensity: form.intensity.trim() || null,
      notes: form.notes.trim() || null,
      source: 'manual',
    }

    const res = await fetch('/api/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not save health entry.')
      setSaving(null)
      return
    }

    setForms(prev => ({ ...prev, [kind]: emptyForm(kind) }))
    await fetchLogs()
    setSaving(null)
  }

  async function remove(log: HealthLog) {
    if (!confirm('Delete this health entry?')) return
    await fetch(`/api/health/${log.id}`, { method: 'DELETE' })
    await fetchLogs()
  }

  const shell: React.CSSProperties = {
    minHeight: '100vh',
    background: '#04040a',
    color: '#e2e8f0',
    padding: '28px 24px',
    fontFamily: 'Outfit, sans-serif',
  }

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 5,
    padding: 14,
  }

  const label: React.CSSProperties = {
    display: 'block',
    marginBottom: 6,
    color: '#64748b',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  }

  const input: React.CSSProperties = {
    width: '100%',
    height: 36,
    borderRadius: 5,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.28)',
    color: '#e2e8f0',
    padding: '0 10px',
    outline: 'none',
    fontSize: 13,
  }

  const button = (color: string): React.CSSProperties => ({
    height: 34,
    padding: '0 12px',
    borderRadius: 5,
    border: `1px solid ${color}55`,
    background: `${color}18`,
    color,
    fontSize: 11,
    fontWeight: 850,
    cursor: 'pointer',
  })

  const small = { color: '#64748b', fontSize: 11, lineHeight: 1.45 } as React.CSSProperties

  function renderField(kind: FormKind, key: keyof HealthForm, title: string, type = 'text', placeholder = '') {
    return (
      <label>
        <span style={label}>{title}</span>
        <input
          style={input}
          type={type}
          value={forms[kind][key]}
          placeholder={placeholder}
          onChange={event => setField(kind, key, event.target.value)}
        />
      </label>
    )
  }

  return (
    <div className="health-page-shell" style={shell}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
        <div>
          <a href="/dashboard" style={{ color: '#64748b', fontSize: 11, textDecoration: 'none', fontWeight: 800 }}>← Dashboard</a>
          <h1 style={{ margin: '8px 0 4px', fontSize: 24, fontWeight: 900 }}>Health Log</h1>
          <p style={small}>Track inputs. Use this as a daily record, not medical advice.</p>
        </div>
        <a href="/dashboard#idea-capture" style={{ ...button('#38bdf8'), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Idea</a>
      </header>

      <section className="health-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
        <div style={card}>
          <p style={label}>Latest BP</p>
          <p style={{ color: '#f8fafc', fontSize: 22, fontWeight: 900 }}>{latestBp ? `${latestBp.bp_systolic}/${latestBp.bp_diastolic}` : '--/--'}</p>
          <p style={small}>{latestBp ? new Date(latestBp.logged_at).toLocaleString() : 'No reading yet'}</p>
        </div>
        <div style={card}>
          <p style={label}>Calories</p>
          <p style={{ color: '#f59e0b', fontSize: 22, fontWeight: 900 }}>{totals.calories}</p>
          <p style={small}>Today</p>
        </div>
        <div style={card}>
          <p style={label}>Protein</p>
          <p style={{ color: '#22c55e', fontSize: 22, fontWeight: 900 }}>{totals.protein}g</p>
          <p style={small}>Today</p>
        </div>
        <div style={card}>
          <p style={label}>Workout</p>
          <p style={{ color: '#38bdf8', fontSize: 22, fontWeight: 900 }}>{todayWorkouts.reduce((sum, log) => sum + (log.duration_mins ?? 0), 0)}m</p>
          <p style={small}>{todayWorkouts.length} session{todayWorkouts.length === 1 ? '' : 's'} today</p>
        </div>
      </section>

      {error && <p style={{ ...card, borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5', marginBottom: 16 }}>{error}</p>}

      <section className="health-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
        <div style={card}>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 900 }}>Blood Pressure</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {renderField('blood_pressure', 'bp_systolic', 'Systolic', 'number', '120')}
            {renderField('blood_pressure', 'bp_diastolic', 'Diastolic', 'number', '80')}
            {renderField('blood_pressure', 'pulse', 'Pulse', 'number', '70')}
            {renderField('blood_pressure', 'logged_at', 'Time', 'datetime-local')}
          </div>
          <textarea
            style={{ ...input, height: 70, padding: 10, marginTop: 10 }}
            value={forms.blood_pressure.notes}
            placeholder="Context, medication, stress, caffeine, etc."
            onChange={event => setField('blood_pressure', 'notes', event.target.value)}
          />
          <button style={{ ...button('#ef4444'), marginTop: 10 }} disabled={saving === 'blood_pressure'} onClick={() => save('blood_pressure')}>
            Save BP
          </button>
        </div>

        <div style={card}>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 900 }}>Nutrition</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {renderField('nutrition', 'meal_name', 'Meal', 'text', 'Chicken, rice, shake...')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              {renderField('nutrition', 'calories', 'Cal', 'number')}
              {renderField('nutrition', 'protein_g', 'Protein', 'number')}
              {renderField('nutrition', 'carbs_g', 'Carbs', 'number')}
              {renderField('nutrition', 'fat_g', 'Fat', 'number')}
            </div>
            {renderField('nutrition', 'logged_at', 'Time', 'datetime-local')}
          </div>
          <textarea
            style={{ ...input, height: 70, padding: 10, marginTop: 10 }}
            value={forms.nutrition.notes}
            placeholder="How it hit, cravings, sodium, plan notes..."
            onChange={event => setField('nutrition', 'notes', event.target.value)}
          />
          <button style={{ ...button('#f59e0b'), marginTop: 10 }} disabled={saving === 'nutrition'} onClick={() => save('nutrition')}>
            Save Food
          </button>
        </div>

        <div style={card}>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 900 }}>Workout</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <label>
              <span style={label}>Type</span>
              <select style={input} value={forms.workout.workout_type} onChange={event => setField('workout', 'workout_type', event.target.value)}>
                <option value="lift">Lift</option>
                <option value="cardio">Cardio</option>
                <option value="hockey">Hockey</option>
                <option value="walk">Walk</option>
                <option value="mobility">Mobility</option>
                <option value="rest">Rest</option>
              </select>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {renderField('workout', 'duration_mins', 'Minutes', 'number', '45')}
              {renderField('workout', 'intensity', 'Intensity', 'text', 'easy/moderate/hard')}
            </div>
            {renderField('workout', 'logged_at', 'Time', 'datetime-local')}
          </div>
          <textarea
            style={{ ...input, height: 70, padding: 10, marginTop: 10 }}
            value={forms.workout.notes}
            placeholder="Sets, cardio details, how you felt..."
            onChange={event => setField('workout', 'notes', event.target.value)}
          />
          <button style={{ ...button('#38bdf8'), marginTop: 10 }} disabled={saving === 'workout'} onClick={() => save('workout')}>
            Save Workout
          </button>
        </div>
      </section>

      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>Recent Health Timeline</h2>
          <p style={small}>{loading ? 'Loading...' : `${logs.length} entries`}</p>
        </div>
        <div style={{ display: 'grid' }}>
          {logs.length === 0 && <p style={small}>No health entries yet.</p>}
          {logs.slice(0, 40).map(log => (
            <div className="health-timeline-row" key={log.id} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: '#64748b', fontSize: 11 }}>{new Date(log.logged_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 850 }}>{entryLabel(log)}</p>
                <p style={{ color: '#94a3b8', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entryDetail(log)}{log.notes ? ` · ${log.notes}` : ''}</p>
              </div>
              <button style={button('#64748b')} onClick={() => remove(log)}>Delete</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
