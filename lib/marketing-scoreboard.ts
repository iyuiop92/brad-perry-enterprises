import { BetaAnalyticsDataClient } from '@google-analytics/data'

export type MetricStatus = 'ready' | 'unconfigured' | 'error'

export interface MarketingScoreboard {
  generatedAt: string
  ga: {
    status: MetricStatus
    paidSessions: number | null
    landingPageViews: number | null
    keyEvents: number | null
  }
  meta: {
    status: MetricStatus
    spend: number | null
    impressions: number | null
    reach: number | null
    landingPageViews: number | null
  }
}

function gaClient() {
  const encodedKey = process.env.GA_SA_KEY_B64
  if (!encodedKey) return null

  try {
    const key = JSON.parse(Buffer.from(encodedKey, 'base64').toString('utf8'))
    return new BetaAnalyticsDataClient({
      credentials: { client_email: key.client_email, private_key: key.private_key },
      projectId: key.project_id,
    })
  } catch {
    return null
  }
}

function numberValue(value: string | null | undefined) {
  return Number(value ?? 0)
}

async function getGaMetrics(): Promise<MarketingScoreboard['ga']> {
  const propertyId = process.env.GA_PROPERTY_ID
  const ga = gaClient()
  if (!propertyId || !ga) {
    return { status: 'unconfigured', paidSessions: null, landingPageViews: null, keyEvents: null }
  }

  try {
    const property = `properties/${propertyId}`
    const dateRanges = [{ startDate: 'today', endDate: 'today' }]
    const [paidResponse, landingResponse] = await Promise.all([
      ga.runReport({
        property,
        dateRanges,
        metrics: [{ name: 'sessions' }],
        dimensionFilter: {
          filter: {
            fieldName: 'sessionSourceMedium',
            stringFilter: { matchType: 'EXACT', value: 'meta / paid_social' },
          },
        },
      }),
      ga.runReport({
        property,
        dateRanges,
        metrics: [{ name: 'screenPageViews' }, { name: 'keyEvents' }],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: { matchType: 'BEGINS_WITH', value: '/aethers-eye/submit' },
          },
        },
      }),
    ])

    const landing = landingResponse[0].rows?.[0]?.metricValues ?? []
    return {
      status: 'ready',
      paidSessions: numberValue(paidResponse[0].rows?.[0]?.metricValues?.[0]?.value),
      landingPageViews: numberValue(landing[0]?.value),
      keyEvents: numberValue(landing[1]?.value),
    }
  } catch {
    return { status: 'error', paidSessions: null, landingPageViews: null, keyEvents: null }
  }
}

async function getMetaMetrics(): Promise<MarketingScoreboard['meta']> {
  const accessToken = process.env.META_ACCESS_TOKEN
  const campaignId = process.env.META_CAMPAIGN_ID
  if (!accessToken || !campaignId) {
    return { status: 'unconfigured', spend: null, impressions: null, reach: null, landingPageViews: null }
  }

  try {
    const query = new URLSearchParams({
      fields: 'spend,impressions,reach,actions',
      date_preset: 'today',
      access_token: accessToken,
    })
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${campaignId}/insights?${query}`,
      { cache: 'no-store' },
    )
    if (!response.ok) throw new Error('Meta insights request failed')

    const payload = await response.json() as {
      data?: Array<{
        spend?: string
        impressions?: string
        reach?: string
        actions?: Array<{ action_type?: string; value?: string }>
      }>
    }
    const result = payload.data?.[0]
    const landingPageViews = result?.actions?.find(
      action => action.action_type === 'landing_page_view',
    )?.value

    return {
      status: 'ready',
      spend: numberValue(result?.spend),
      impressions: numberValue(result?.impressions),
      reach: numberValue(result?.reach),
      landingPageViews: numberValue(landingPageViews),
    }
  } catch {
    return { status: 'error', spend: null, impressions: null, reach: null, landingPageViews: null }
  }
}

export async function getMarketingScoreboard(): Promise<MarketingScoreboard> {
  const [ga, meta] = await Promise.all([getGaMetrics(), getMetaMetrics()])
  return { generatedAt: new Date().toISOString(), ga, meta }
}
