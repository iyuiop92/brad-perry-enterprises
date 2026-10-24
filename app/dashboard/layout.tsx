import Link from 'next/link'
import { redirect } from 'next/navigation'
import { hasDashboardSession } from '@/lib/password-auth'
import WendyRail from '@/components/WendyRail'

// Every one of these was a plain <a> until 2026-10-24, which meant each nav
// click was a full page reload. That tore the whole React tree down, layout
// included, so a conversation mounted in the layout would have been rebuilt on
// every click and the persistence this file is built around would not have
// existed. next/link keeps navigation client-side and the layout mounted.
const NAV = [
  { label: 'Board', href: '/dashboard#board' },
  { label: 'Idea', href: '/dashboard#idea-capture' },
  { label: 'Health', href: '/dashboard/health' },
  { label: 'Analytics', href: '/dashboard/analytics' },
  { label: 'Content', href: '/dashboard/content' },
  { label: 'Reddit', href: '/dashboard/reddit' },
  { label: 'Aether', href: '/dashboard/aether' },
  { label: 'Vault', href: '/dashboard/vault' },
]

const navLinkStyle = {
  height: 26,
  padding: '0 12px',
  borderRadius: 5,
  display: 'flex',
  alignItems: 'center',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.05em',
  color: '#64748b',
  textDecoration: 'none',
} as const

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
        {NAV.map(item => (
          <Link key={item.href} className="dashboard-nav-link" href={item.href} style={navLinkStyle}>
            {item.label}
          </Link>
        ))}
        <details className="dashboard-mobile-menu">
          <summary>Menu</summary>
          <div className="dashboard-mobile-menu-panel">
            {NAV.map(item => (
              <Link key={item.href} href={item.href}>{item.label}</Link>
            ))}
          </div>
        </details>
      </nav>
      {children}
      {/* Mounted in the layout, deliberately. A layout does not remount on
          client-side navigation, so the conversation, its scroll position and
          any half-typed message survive moving between Board, Content,
          Analytics and the rest. Mounted inside a page it unmounted on every
          click, which is why this dashboard lost to Telegram for daily use. */}
      <WendyRail />
    </div>
  )
}
