import { BetaAnalyticsDataClient } from '@google-analytics/data'

// Reads aetherhockey.com GA4 traffic for the morning brief. Credentials come
// from env so this runs in the cloud cron (no local key file):
//   GA_PROPERTY_ID      numeric GA4 property id
//   GA_SA_KEY_B64       base64 of the service-account JSON key
// Returns a compact text digest, or null if unconfigured / GA errors (the brief
// must never fail because analytics hiccupped).

const CORE = ['activeUsers', 'sessions', 'newUsers', 'screenPageViews'] as const

function client(): BetaAnalyticsDataClient | null {
  const b64 = process.env.GA_SA_KEY_B64
  if (!b64) return null
  try {
    const key = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
    return new BetaAnalyticsDataClient({
      credentials: { client_email: key.client_email, private_key: key.private_key },
      projectId: key.project_id,
    })
  } catch {
    return null
  }
}

const n = (v: string | null | undefined) => Number(v ?? 0)
const pct = (cur: number, prev: number) =>
  prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0
const arrow = (p: number) => (p > 0 ? `+${p}%` : p < 0 ? `${p}%` : 'flat')

export async function getTrafficDigest(): Promise<string | null> {
  const propertyId = process.env.GA_PROPERTY_ID
  const ga = client()
  if (!propertyId || !ga) return null
  const property = `properties/${propertyId}`

  try {
    async function totals(startDate: string, endDate: string) {
      const [resp] = await ga!.runReport({
        property,
        dateRanges: [{ startDate, endDate }],
        metrics: CORE.map((name) => ({ name })),
      })
      const vals = resp.rows?.[0]?.metricValues ?? []
      const out: Record<string, number> = {}
      CORE.forEach((m, i) => (out[m] = n(vals[i]?.value)))
      return out
    }

    const [cur, prev, rt, pagesResp, srcResp] = await Promise.all([
      totals('7daysAgo', 'today'),
      totals('14daysAgo', '8daysAgo'),
      ga.runRealtimeReport({ property, metrics: [{ name: 'activeUsers' }] }).then(
        ([r]) => n(r.rows?.[0]?.metricValues?.[0]?.value),
        () => null,
      ),
      ga.runReport({
        property,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 4,
      }),
      ga.runReport({
        property,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 4,
      }),
    ])

    const pages = (pagesResp[0].rows ?? [])
      .map((r) => `${r.dimensionValues?.[0]?.value} (${n(r.metricValues?.[0]?.value)})`)
      .join(', ')
    const sources = (srcResp[0].rows ?? [])
      .map((r) => `${r.dimensionValues?.[0]?.value} (${n(r.metricValues?.[0]?.value)})`)
      .join(', ')

    return [
      `Active now: ${rt ?? '—'}`,
      `New users: ${cur.newUsers} (${arrow(pct(cur.newUsers, prev.newUsers))} vs prior 7d)`,
      `Sessions: ${cur.sessions} (${arrow(pct(cur.sessions, prev.sessions))})`,
      `Page views: ${cur.screenPageViews} (${arrow(pct(cur.screenPageViews, prev.screenPageViews))})`,
      `Top pages: ${pages}`,
      `Top sources: ${sources}`,
    ].join('\n')
  } catch {
    return null
  }
}
