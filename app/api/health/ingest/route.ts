import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

// Token-authenticated ingest for Apple Health data pushed from Brad's iPhone
// (the "Health Auto Export" app, or a Shortcut). Unlike /api/health this does
// NOT use a login session — an iPhone can't hold a dashboard cookie — so it
// authenticates with a shared secret (HEALTH_INGEST_SECRET) and writes with the
// service-role client. Rows land in bpe_health_logs with source 'apple_health'.
//
// Accepts either:
//  A) Health Auto Export shape: { data: { metrics: [...], workouts: [...] } }
//  B) A simple manual row (e.g. from a Shortcut): { entry_type, bp_systolic, ... }
//
// Repeated syncs are de-duplicated on (entry_type + logged_at) for this source,
// so re-sending an overlapping date range does not create duplicates.

export const maxDuration = 60

const SOURCE = 'apple_health'

type HealthRow = {
  entry_type: 'blood_pressure' | 'nutrition' | 'workout'
  logged_at: string
  bp_systolic?: number | null
  bp_diastolic?: number | null
  pulse?: number | null
  meal_name?: string | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  workout_type?: string | null
  duration_mins?: number | null
  intensity?: string | null
  notes?: string | null
  source: string
}

function iso(value: unknown): string | null {
  if (!value) return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

// Index a Health Auto Export metric's data points by ISO date -> qty.
function metricByDate(metrics: any[], name: string): Map<string, number> {
  const map = new Map<string, number>()
  const metric = metrics.find(m => m?.name === name)
  for (const point of metric?.data ?? []) {
    const at = iso(point?.date)
    const qty = num(point?.qty)
    if (at && qty !== null) map.set(at, qty)
  }
  return map
}

// Turn a Health Auto Export payload into flat bpe_health_logs rows.
function rowsFromAutoExport(data: any): HealthRow[] {
  const rows: HealthRow[] = []
  const metrics: any[] = Array.isArray(data?.metrics) ? data.metrics : []
  const workouts: any[] = Array.isArray(data?.workouts) ? data.workouts : []

  // Blood pressure: pair systolic + diastolic by timestamp; attach pulse if a
  // heart-rate sample shares the same timestamp.
  const sys = metricByDate(metrics, 'blood_pressure_systolic')
  const dia = metricByDate(metrics, 'blood_pressure_diastolic')
  const hr = metricByDate(metrics, 'heart_rate')
  const restingHr = metricByDate(metrics, 'resting_heart_rate')
  for (const [at, systolic] of sys) {
    const diastolic = dia.get(at)
    if (diastolic === undefined) continue
    rows.push({
      entry_type: 'blood_pressure',
      logged_at: at,
      bp_systolic: Math.round(systolic),
      bp_diastolic: Math.round(diastolic),
      pulse: hr.has(at) ? Math.round(hr.get(at)!) : restingHr.has(at) ? Math.round(restingHr.get(at)!) : null,
      source: SOURCE,
    })
  }

  // Nutrition: aggregate the day's dietary metrics into one row per timestamp
  // that has any nutrition data.
  const energy = metricByDate(metrics, 'dietary_energy')
  const protein = metricByDate(metrics, 'protein')
  const carbs = metricByDate(metrics, 'carbohydrates')
  const fat = metricByDate(metrics, 'total_fat')
  const nutritionDates = new Set<string>([...energy.keys(), ...protein.keys(), ...carbs.keys(), ...fat.keys()])
  for (const at of nutritionDates) {
    rows.push({
      entry_type: 'nutrition',
      logged_at: at,
      meal_name: 'Apple Health daily total',
      calories: energy.has(at) ? Math.round(energy.get(at)!) : null,
      protein_g: protein.has(at) ? Math.round(protein.get(at)!) : null,
      carbs_g: carbs.has(at) ? Math.round(carbs.get(at)!) : null,
      fat_g: fat.has(at) ? Math.round(fat.get(at)!) : null,
      source: SOURCE,
    })
  }

  // Workouts: one row each. Health Auto Export reports duration in seconds.
  for (const w of workouts) {
    const at = iso(w?.start ?? w?.date)
    if (!at) continue
    const durationSeconds = num(w?.duration)
    rows.push({
      entry_type: 'workout',
      logged_at: at,
      workout_type: (w?.name ?? w?.workoutActivityType ?? 'Workout') as string,
      duration_mins: durationSeconds !== null ? Math.round(durationSeconds / 60) : null,
      source: SOURCE,
    })
  }

  return rows
}

// A single manual row (Shortcut-friendly). Only used when there is no `data`.
function rowFromManual(body: any): HealthRow | null {
  if (!body?.entry_type) return null
  return {
    entry_type: body.entry_type,
    logged_at: iso(body.logged_at) ?? new Date().toISOString(),
    bp_systolic: num(body.bp_systolic),
    bp_diastolic: num(body.bp_diastolic),
    pulse: num(body.pulse),
    meal_name: body.meal_name ?? null,
    calories: num(body.calories),
    protein_g: num(body.protein_g),
    carbs_g: num(body.carbs_g),
    fat_g: num(body.fat_g),
    workout_type: body.workout_type ?? null,
    duration_mins: num(body.duration_mins),
    intensity: body.intensity ?? null,
    notes: body.notes ?? null,
    source: SOURCE,
  }
}

export async function POST(request: Request) {
  const secret = process.env.HEALTH_INGEST_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'HEALTH_INGEST_SECRET is not configured on the server.' }, { status: 500 })
  }

  // Accept the secret as a Bearer token or an x-health-secret header.
  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  const provided = bearer || request.headers.get('x-health-secret') || ''
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })

  const rows = body?.data
    ? rowsFromAutoExport(body.data)
    : [rowFromManual(body)].filter(Boolean) as HealthRow[]

  if (!rows.length) {
    return NextResponse.json({ inserted: 0, skipped: 0, message: 'No usable health data in payload.' })
  }

  const supabase = createAdminClient()

  // De-dupe: fetch existing apple_health rows in this batch's time window and
  // skip anything we already have at the same (entry_type, logged_at).
  const times = rows.map(r => r.logged_at).sort()
  const { data: existing } = await supabase
    .from('bpe_health_logs')
    .select('entry_type, logged_at')
    .eq('source', SOURCE)
    .gte('logged_at', times[0])
    .lte('logged_at', times[times.length - 1])

  const seen = new Set((existing ?? []).map(r => `${r.entry_type}|${new Date(r.logged_at).toISOString()}`))
  const fresh = rows.filter(r => !seen.has(`${r.entry_type}|${r.logged_at}`))
  const skipped = rows.length - fresh.length

  if (!fresh.length) {
    return NextResponse.json({ inserted: 0, skipped, message: 'All entries already imported.' })
  }

  const { error } = await supabase.from('bpe_health_logs').insert(fresh)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const counts = fresh.reduce<Record<string, number>>((acc, r) => {
    acc[r.entry_type] = (acc[r.entry_type] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({ inserted: fresh.length, skipped, counts }, { status: 201 })
}
