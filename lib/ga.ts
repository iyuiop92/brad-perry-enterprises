import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { GoogleAuth } from 'google-auth-library'

// Reads aetherhockey.com GA4 traffic. Credentials come from env so this runs
// in Vercel without a local key file:
//   GA_PROPERTY_ID      numeric GA4 property id
//   GA_SA_KEY_B64       base64 of the service-account JSON key
// The reader is shared by the morning brief and the protected dashboard.

const CORE = [
  'activeUsers',
  'sessions',
  'newUsers',
  'screenPageViews',
  'engagedSessions',
  'engagementRate',
  'keyEvents',
] as const

export interface AnalyticsTotals {
  activeUsers: number
  sessions: number
  newUsers: number
  screenPageViews: number
  engagedSessions: number
  engagementRate: number
  keyEvents: number
}

export interface AnalyticsRow {
  label: string
  value: number
}

export interface AnalyticsSnapshot {
  configured: boolean
  error?: string
  activeNow: number | null
  current: AnalyticsTotals
  previous: AnalyticsTotals
  topPages: AnalyticsRow[]
  topChannels: AnalyticsRow[]
}

export interface SearchConsoleTotals {
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchConsoleRow extends SearchConsoleTotals {
  label: string
}

export interface SearchConsoleSnapshot {
  configured: boolean
  error?: string
  startDate: string
  endDate: string
  totals: SearchConsoleTotals
  topQueries: SearchConsoleRow[]
  topPages: SearchConsoleRow[]
}

type ServiceAccount = {
  client_email: string
  private_key: string
  project_id: string
}

function serviceAccount(): ServiceAccount | null {
  const b64 = process.env.GA_SA_KEY_B64
  if (!b64) return null
  try {
    const key = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
    if (!key.client_email || !key.private_key || !key.project_id) return null
    return key
  } catch {
    return null
  }
}

function client(): BetaAnalyticsDataClient | null {
  const key = serviceAccount()
  if (!key) return null
  return new BetaAnalyticsDataClient({
    credentials: { client_email: key.client_email, private_key: key.private_key },
    projectId: key.project_id,
  })
}

const n = (v: string | null | undefined) => Number(v ?? 0)
const pct = (cur: number, prev: number) =>
  prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0
const arrow = (p: number) => (p > 0 ? `+${p}%` : p < 0 ? `${p}%` : 'flat')

const emptyTotals = (): AnalyticsTotals => ({
  activeUsers: 0,
  sessions: 0,
  newUsers: 0,
  screenPageViews: 0,
  engagedSessions: 0,
  engagementRate: 0,
  keyEvents: 0,
})

export async function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const propertyId = process.env.GA_PROPERTY_ID
  const ga = client()
  const empty: AnalyticsSnapshot = {
    configured: Boolean(propertyId && ga),
    activeNow: null,
    current: emptyTotals(),
    previous: emptyTotals(),
    topPages: [],
    topChannels: [],
  }

  if (!propertyId || !ga) return empty
  const analytics = ga
  const property = `properties/${propertyId}`

  try {
    async function totals(startDate: string, endDate: string): Promise<AnalyticsTotals> {
      const [resp] = await analytics.runReport({
        property,
        dateRanges: [{ startDate, endDate }],
        metrics: CORE.map((name) => ({ name })),
      })
      const vals = resp.rows?.[0]?.metricValues ?? []
      const out = emptyTotals()
      CORE.forEach((metric, index) => {
        out[metric] = n(vals[index]?.value)
      })
      return out
    }

    const [current, previous, realtime, pagesResp, channelsResp] = await Promise.all([
      totals('6daysAgo', 'today'),
      totals('13daysAgo', '7daysAgo'),
      analytics.runRealtimeReport({ property, metrics: [{ name: 'activeUsers' }] }).then(
        ([response]) => n(response.rows?.[0]?.metricValues?.[0]?.value),
        () => null,
      ),
      analytics.runReport({
        property,
        dateRanges: [{ startDate: '6daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 8,
      }),
      analytics.runReport({
        property,
        dateRanges: [{ startDate: '6daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }),
    ])

    const rows = (response: {
      rows?: Array<{
        dimensionValues?: Array<{ value?: string | null }> | null
        metricValues?: Array<{ value?: string | null }> | null
      }> | null
    }): AnalyticsRow[] =>
      (response.rows ?? []).map((row) => ({
        label: row.dimensionValues?.[0]?.value || '(not set)',
        value: n(row.metricValues?.[0]?.value),
      }))

    return {
      configured: true,
      activeNow: realtime,
      current,
      previous,
      topPages: rows(pagesResp[0]),
      topChannels: rows(channelsResp[0]),
    }
  } catch {
    return { ...empty, error: 'Google Analytics is temporarily unavailable. Try again in a moment.' }
  }
}

export async function getTrafficDigest(): Promise<string | null> {
  const snapshot = await getAnalyticsSnapshot()
  if (!snapshot.configured || snapshot.error) return null

  return [
    `Active now: ${snapshot.activeNow ?? '—'}`,
    `New users: ${snapshot.current.newUsers} (${arrow(pct(snapshot.current.newUsers, snapshot.previous.newUsers))} vs prior 7d)`,
    `Sessions: ${snapshot.current.sessions} (${arrow(pct(snapshot.current.sessions, snapshot.previous.sessions))})`,
    `Page views: ${snapshot.current.screenPageViews} (${arrow(pct(snapshot.current.screenPageViews, snapshot.previous.screenPageViews))})`,
    `Top pages: ${snapshot.topPages.slice(0, 4).map((row) => `${row.label} (${row.value})`).join(', ')}`,
    `Top sources: ${snapshot.topChannels.slice(0, 4).map((row) => `${row.label} (${row.value})`).join(', ')}`,
  ].join('\n')
}

const emptySearchTotals = (): SearchConsoleTotals => ({
  clicks: 0,
  impressions: 0,
  ctr: 0,
  position: 0,
})

function searchDateRange() {
  // Search Console is typically 2–3 days behind. Use complete available days,
  // not a misleading partial "today" window.
  const end = new Date()
  end.setUTCDate(end.getUTCDate() - 3)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 6)
  const format = (date: Date) => date.toISOString().slice(0, 10)
  return { startDate: format(start), endDate: format(end) }
}

type SearchConsoleApiRow = {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

async function searchConsoleReport(
  auth: GoogleAuth,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimension?: 'query' | 'page',
) {
  const client = await auth.getClient()
  const response = await client.request<{ rows?: SearchConsoleApiRow[] }>({
    url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    method: 'POST',
    data: {
      startDate,
      endDate,
      ...(dimension ? { dimensions: [dimension], rowLimit: 8 } : {}),
    },
  })
  return response.data.rows ?? []
}

export async function getSearchConsoleSnapshot(): Promise<SearchConsoleSnapshot> {
  const key = serviceAccount()
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL || 'sc-domain:aetherhockey.com'
  const { startDate, endDate } = searchDateRange()
  const empty: SearchConsoleSnapshot = {
    configured: Boolean(key),
    startDate,
    endDate,
    totals: emptySearchTotals(),
    topQueries: [],
    topPages: [],
  }
  if (!key) return empty

  try {
    const auth = new GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    })
    const [totalRows, queryRows, pageRows] = await Promise.all([
      searchConsoleReport(auth, siteUrl, startDate, endDate),
      searchConsoleReport(auth, siteUrl, startDate, endDate, 'query'),
      searchConsoleReport(auth, siteUrl, startDate, endDate, 'page'),
    ])
    const row = (value?: SearchConsoleApiRow): SearchConsoleTotals => ({
      clicks: value?.clicks ?? 0,
      impressions: value?.impressions ?? 0,
      ctr: value?.ctr ?? 0,
      position: value?.position ?? 0,
    })
    const rows = (values: SearchConsoleApiRow[]): SearchConsoleRow[] => values.map((value) => ({
      label: value.keys?.[0] || '(not set)',
      ...row(value),
    }))

    return {
      ...empty,
      totals: row(totalRows[0]),
      topQueries: rows(queryRows),
      topPages: rows(pageRows),
    }
  } catch {
    return { ...empty, error: 'Search Console is temporarily unavailable. Try again in a moment.' }
  }
}
