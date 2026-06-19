import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { hasDashboardSession } from '@/lib/password-auth'

export async function requireAuth() {
  if (!(await hasDashboardSession())) {
    return {
      supabase: null,
      unauthorized: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { supabase: createAdminClient(), unauthorized: null }
}
