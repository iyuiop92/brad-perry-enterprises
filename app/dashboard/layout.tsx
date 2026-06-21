import { redirect } from 'next/navigation'
import { hasDashboardSession } from '@/lib/password-auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await hasDashboardSession())) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#04040a' }}>
      {/* Top nav */}
      <nav className="dashboard-top-nav" style={{
        height: 38,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 16px',
        background: 'rgba(5,7,10,0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        zIndex: 100,
      }}>
        <a
          className="dashboard-nav-link"
          href="/dashboard#board"
          style={{
            height: 26, padding: '0 12px', borderRadius: 5,
            display: 'flex', alignItems: 'center',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
            color: '#64748b', textDecoration: 'none',
          }}
        >
          Board
        </a>
        <a
          className="dashboard-nav-link"
          href="/dashboard#idea-capture"
          style={{
            height: 26, padding: '0 12px', borderRadius: 5,
            display: 'flex', alignItems: 'center',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
            color: '#64748b', textDecoration: 'none',
          }}
        >
          Idea
        </a>
        <a
          className="dashboard-nav-link"
          href="/dashboard/health"
          style={{
            height: 26, padding: '0 12px', borderRadius: 5,
            display: 'flex', alignItems: 'center',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
            color: '#64748b', textDecoration: 'none',
          }}
        >
          Health
        </a>
        <details className="dashboard-mobile-menu">
          <summary>Menu</summary>
          <div className="dashboard-mobile-menu-panel">
            <a href="/dashboard#board">Board</a>
            <a href="/dashboard#idea-capture">Idea</a>
            <a href="/dashboard/health">Health</a>
          </div>
        </details>
      </nav>
      {children}
    </div>
  )
}
