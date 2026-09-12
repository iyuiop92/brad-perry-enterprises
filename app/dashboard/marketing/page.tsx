'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MarketingScoreboard } from '@/lib/marketing-scoreboard'

const empty: MarketingScoreboard = { generatedAt: '', ga: { status: 'unconfigured', paidSessions: null, landingPageViews: null, keyEvents: null }, meta: { status: 'unconfigured', spend: null, impressions: null, reach: null, landingPageViews: null } }

function MetricCard({ label, value, detail, accent = '#38bdf8' }: { label: string; value: string; detail: string; accent?: string }) {
  return <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: 14 }}><p style={{ color: '#64748b', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>{label}</p><p style={{ color: accent, fontSize: 26, fontWeight: 900, margin: '7px 0 3px' }}>{value}</p><p style={{ color: '#64748b', fontSize: 11, lineHeight: 1.4, margin: 0 }}>{detail}</p></div>
}

function value(number: number | null) { return number === null ? '—' : number.toLocaleString() }

export default function MarketingPage() {
  const [data, setData] = useState<MarketingScoreboard>(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { const response = await fetch('/api/dashboard/marketing', { cache: 'no-store' }); if (!response.ok) throw new Error('Marketing data could not load.'); setData(await response.json()) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Marketing data could not load.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const metaReady = data.meta.status === 'ready'
  const gaReady = data.ga.status === 'ready'
  const costPerLandingView = metaReady && data.meta.spend !== null && data.meta.landingPageViews ? data.meta.spend / data.meta.landingPageViews : null

  return <main style={{ minHeight: '100vh', background: '#04040a', color: '#e2e8f0', padding: '28px 24px', fontFamily: 'Outfit, sans-serif' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}><div><a href="/dashboard" style={{ color: '#64748b', fontSize: 11, textDecoration: 'none', fontWeight: 800 }}>← Dashboard</a><h1 style={{ margin: '8px 0 4px', fontSize: 24, fontWeight: 900 }}>Aether Marketing Scoreboard</h1><p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5, margin: 0 }}>Today. Aether&apos;s Eye paid traffic. Real numbers only.</p></div><button type="button" onClick={() => void load()} disabled={loading} style={{ height: 34, padding: '0 12px', borderRadius: 5, border: '1px solid rgba(0,180,255,0.45)', background: 'rgba(0,180,255,0.12)', color: '#7dd3fc', cursor: loading ? 'wait' : 'pointer', fontSize: 11, fontWeight: 850 }}>{loading ? 'Refreshing…' : 'Refresh'}</button></header>
    {error && <p role="alert" style={{ color: '#fca5a5', fontSize: 12 }}>{error}</p>}
    <section style={{ marginBottom: 18 }}><p style={{ color: '#00b4ff', fontSize: 10, fontWeight: 850, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 8px' }}>Meta ad delivery</p><div className="marketing-scoreboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}><MetricCard label="Spend" value={data.meta.spend === null ? '—' : `$${data.meta.spend.toFixed(2)}`} detail={metaReady ? 'Today' : 'Needs Meta access token'} accent="#f59e0b" /><MetricCard label="Landing views" value={value(data.meta.landingPageViews)} detail={metaReady ? 'Meta measured' : 'Waiting for connection'} /><MetricCard label="Cost per view" value={costPerLandingView === null ? '—' : `$${costPerLandingView.toFixed(2)}`} detail="Spend ÷ landing views" accent="#a78bfa" /><MetricCard label="Reach" value={value(data.meta.reach)} detail={metaReady ? `${value(data.meta.impressions)} impressions` : 'Waiting for connection'} accent="#22c55e" /></div></section>
    <section><p style={{ color: '#00b4ff', fontSize: 10, fontWeight: 850, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 8px' }}>Aether site funnel</p><div className="marketing-scoreboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}><MetricCard label="Paid sessions" value={value(data.ga.paidSessions)} detail={gaReady ? 'meta / paid_social' : 'GA4 is not available'} /><MetricCard label="Clip page views" value={value(data.ga.landingPageViews)} detail={gaReady ? 'Aether’s Eye submit page' : 'GA4 is not available'} accent="#22c55e" /><MetricCard label="Key events" value={value(data.ga.keyEvents)} detail={gaReady ? 'Configured GA4 conversions on clip page' : 'GA4 is not available'} accent="#a78bfa" /></div></section>
    <section style={{ marginTop: 18, padding: 14, background: 'rgba(0,180,255,0.06)', border: '1px solid rgba(0,180,255,0.16)', borderRadius: 5 }}><p style={{ margin: '0 0 5px', color: '#e2e8f0', fontSize: 12, fontWeight: 850 }}>What to watch</p><p style={{ margin: 0, color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>First: paid sessions and clip-page views. Then cost per landing-page view. A signup or paid purchase will only appear here once it is configured as a GA4 key event.</p></section>
  </main>
}
