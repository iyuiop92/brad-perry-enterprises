import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const body = await request.json()

  const { data, error } = await supabase
    .from('bpe_health_logs')
    .update({
      logged_at: body.logged_at,
      bp_systolic: body.bp_systolic ?? null,
      bp_diastolic: body.bp_diastolic ?? null,
      pulse: body.pulse ?? null,
      meal_name: body.meal_name ?? null,
      calories: body.calories ?? null,
      protein_g: body.protein_g ?? null,
      carbs_g: body.carbs_g ?? null,
      fat_g: body.fat_g ?? null,
      workout_type: body.workout_type ?? null,
      duration_mins: body.duration_mins ?? null,
      intensity: body.intensity ?? null,
      notes: body.notes ?? null,
      source: body.source ?? 'manual',
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { error } = await supabase
    .from('bpe_health_logs')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
