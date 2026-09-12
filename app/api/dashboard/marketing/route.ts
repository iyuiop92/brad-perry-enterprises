import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import { getMarketingScoreboard } from '@/lib/marketing-scoreboard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  return NextResponse.json(await getMarketingScoreboard())
}
