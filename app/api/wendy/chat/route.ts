import { requireAuth } from '@/lib/require-auth'
import { legacyWendyResponse } from '@/lib/wendy-moved'

export async function POST() {
  const { unauthorized } = await requireAuth()
  return unauthorized ?? legacyWendyResponse('wendy')!
}
