import { getAnalyticsSnapshot, type AnalyticsRow, type AnalyticsTotals } from '@/lib/ga'

export const dynamic = 'force-dynamic'

const number = new Intl.NumberFormat('en-US')

function percent(current: number, previous: number) {
  if (previous === 0) return current > 0 ? '+100%' : '—'
  const change = Math.round(((current - previous) / previous) * 100)
  return `${change > 0 ? '+' : ''}${change}%`
}

function changeColor(current: number, previous: number) {
  if (current === previous) return '#94a3b8'
  return current > previous ? '#4ade80' : '#fb7185'
}

function MetricCard({ label, current, previous, suffix = '' }: { label: string; current: number; previous: number; suffix?: string }) {
  return (
    <article style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
      <p style={{ margin: 0, color: '#64748b', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ margin: '9px 0 4px', color: '#f8fafc', fontSize: 26, fontWeight: 900 }}>{number.format(current)}{suffix}</p>
      <p style={{ margin: 0, color: changeColor(current, previous), fontSize: 12, fontWeight: 800 }}>{percent(current, previous)} <span style={{ color: '#64748b', fontWeight: 500 }}>vs. prior 7 days</span></p>
    </article>
  )
}

function RankedList({ title, rows, empty }: { title: string; rows: AnalyticsRow[]; empty: string }) {
  return (
    <section style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
      <h2 style={{ margin: 0, color: '#f8fafc', fontSize: 15, fontWeight: 850 }}>{title}</h2>
      {rows.length === 0 ? <p style={{ color: '#64748b', fontSize: 13 }}>{empty}</p> : (
        <ol style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 9 }}>
          {rows.map((row, index) => (
            <li key={row.label} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr) auto', gap: 8, alignItems: 'center', color: '#cbd5e1', fontSize: 13 }}>
              <span style={{ color: '#475569', fontSize: 11, fontWeight: 800 }}>{index + 1}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
              <strong style={{ color: '#f8fafc', fontSize: 12 }}>{number.format(row.value)}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function FunnelCall({ totals }: { totals: AnalyticsTotals }) {
  const rate = totals.sessions > 0 ? Math.round((totals.keyEvents / totals.sessions) * 1000) / 10 : 0
  return (
    <section style={{ border: '1px solid rgba(0,180,255,0.28)', background: 'rgba(0,180,255,0.08)', borderRadius: 10, padding: 16 }}>
      <p style={{ margin: 0, color: '#38bdf8', fontSize: 10, fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Funnel signal</p>
      <p style={{ margin: '7px 0 4px', color: '#f8fafc', fontWeight: 850, fontSize: 16 }}>{number.format(totals.keyEvents)} key events from {number.format(totals.sessions)} sessions.</p>
      <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, lineHeight: 1.45 }}>{rate}% session-to-key-event rate. This reflects the key events currently configured in GA4, not a guessed membership conversion rate.</p>
    </section>
  )
}

export default async function AnalyticsPage() {
  const snapshot = await getAnalyticsSnapshot()

  return (
    <main style={{ minHeight: '100vh', background: '#04040a', color: '#e2e8f0', padding: '28px 24px', fontFamily: 'Outfit, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
        <div>
          <a href="/dashboard" style={{ color: '#64748b', fontSize: 11, textDecoration: 'none', fontWeight: 800 }}>← Dashboard</a>
          <h1 style={{ margin: '8px 0 4px', color: '#f8fafc', fontSize: 26, fontWeight: 900 }}>Aether Hockey Analytics</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Last 7 days through today. Compared with the prior 7 days.</p>
        </div>
        <div style={{ border: '1px solid rgba(0,180,255,0.25)', borderRadius: 7, padding: '7px 10px', color: '#38bdf8', fontSize: 12, fontWeight: 800 }}>
          Active now: {snapshot.activeNow ?? '—'}
        </div>
      </header>

      {!snapshot.configured ? (
        <section style={{ maxWidth: 720, border: '1px solid rgba(251,191,36,0.32)', background: 'rgba(251,191,36,0.08)', borderRadius: 10, padding: 18 }}>
          <h2 style={{ margin: 0, color: '#fef3c7', fontSize: 17 }}>Connect Google Analytics to turn this on.</h2>
          <p style={{ margin: '8px 0 0', color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>Add <code>GA_PROPERTY_ID=536358742</code> and the base64-encoded service-account JSON as <code>GA_SA_KEY_B64</code> to the BPE Vercel project. Give that service account Viewer access to the Aether Hockey GA4 property.</p>
        </section>
      ) : snapshot.error ? (
        <section style={{ border: '1px solid rgba(251,113,133,0.32)', background: 'rgba(251,113,133,0.08)', borderRadius: 10, padding: 18, color: '#fecdd3' }}>{snapshot.error}</section>
      ) : (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 12 }}>
            <MetricCard label="Users" current={snapshot.current.activeUsers} previous={snapshot.previous.activeUsers} />
            <MetricCard label="Sessions" current={snapshot.current.sessions} previous={snapshot.previous.sessions} />
            <MetricCard label="New users" current={snapshot.current.newUsers} previous={snapshot.previous.newUsers} />
            <MetricCard label="Page views" current={snapshot.current.screenPageViews} previous={snapshot.previous.screenPageViews} />
            <MetricCard label="Key events" current={snapshot.current.keyEvents} previous={snapshot.previous.keyEvents} />
            <MetricCard label="Engagement rate" current={Math.round(snapshot.current.engagementRate * 100)} previous={Math.round(snapshot.previous.engagementRate * 100)} suffix="%" />
          </section>
          <div style={{ marginBottom: 12 }}><FunnelCall totals={snapshot.current} /></div>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 12 }}>
            <RankedList title="Top viewed paths" rows={snapshot.topPages} empty="No page data returned." />
            <RankedList title="Traffic channels" rows={snapshot.topChannels} empty="No channel data returned." />
          </section>
        </>
      )}
    </main>
  )
}
