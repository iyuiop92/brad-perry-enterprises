'use client'
import { useEffect, useState } from 'react'
import CommandChatPanel from '@/components/CommandChatPanel'
import type { ExecutiveAgent } from '@/lib/dashboard-chat'

// Persistent conversation rail. Mounted in app/dashboard/layout.tsx, NOT in a
// page, which is the whole point: an App Router layout does not remount on
// navigation, so the conversation, its scroll position and its open/closed
// state survive moving between Board, Content, Analytics, Reddit and the rest.
//
// Before 2026-10-24 this conversation lived inside app/dashboard/page.tsx as a
// slide-in drawer that was closed by default and unmounted the moment Brad
// left the board. The messages were always persisted server-side (the bridge
// polls agent_bridge_messages), so nothing was ever lost — it just always
// LOOKED lost, which is why the dashboard went unused in favour of Telegram.
//
// Desktop: fixed right rail, collapsible to a 40px edge strip.
// Mobile:  a bottom sheet behind a floating button, because a 360px rail on a
//          phone leaves nothing for the dashboard itself.
const RAIL_WIDTH = 360
const OPEN_KEY = 'bpe.rail.open'
const AGENT_KEY = 'bpe.rail.agent'
const ACCENT = { wendy: '#00b4ff', ellie: '#a78bfa' } as const

export default function WendyRail() {
  // Start closed and let the effect open it. Reading localStorage during the
  // first render would desync server and client markup.
  const [open, setOpen] = useState(false)
  const [agent, setAgent] = useState<ExecutiveAgent>('wendy')
  const [mobile, setMobile] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const sync = () => setMobile(query.matches)
    sync()
    query.addEventListener('change', sync)
    const savedAgent = window.localStorage.getItem(AGENT_KEY)
    if (savedAgent === 'wendy' || savedAgent === 'ellie') setAgent(savedAgent)
    // Desktop defaults to open (that is the feature). Mobile defaults to shut.
    const savedOpen = window.localStorage.getItem(OPEN_KEY)
    setOpen(savedOpen === null ? !query.matches : savedOpen === '1')
    setReady(true)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => { if (ready) window.localStorage.setItem(OPEN_KEY, open ? '1' : '0') }, [open, ready])
  useEffect(() => { if (ready) window.localStorage.setItem(AGENT_KEY, agent) }, [agent, ready])

  // Reserve the rail's width on <body> so dashboard pages lay out beside it
  // instead of underneath. Done here rather than in the layout because only
  // this component knows whether the rail is open, collapsed or a sheet.
  useEffect(() => {
    if (!ready) return
    document.body.style.paddingRight = mobile ? '' : `${open ? RAIL_WIDTH : 40}px`
    return () => { document.body.style.paddingRight = '' }
  }, [open, mobile, ready])

  // The Assistants menu on the board still opens Wendy and Ellie. It can't
  // reach this component through props (different tree), so it asks by event.
  useEffect(() => {
    const onOpen = (event: Event) => {
      const next = (event as CustomEvent<{ agent?: unknown }>).detail?.agent
      if (next === 'wendy' || next === 'ellie') setAgent(next)
      setOpen(true)
    }
    window.addEventListener('bpe:rail', onOpen)
    return () => window.removeEventListener('bpe:rail', onOpen)
  }, [])

  // Escape closes the sheet on mobile. On desktop the rail is furniture and
  // Escape is left alone for modals.
  useEffect(() => {
    if (!mobile || !open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobile, open])

  if (!ready) return null
  const accent = ACCENT[agent]

  if (mobile) {
    return (
      <>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            aria-label="Open conversation"
            style={{
              position: 'fixed', right: 16, bottom: 16, zIndex: 120,
              width: 56, height: 56, borderRadius: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#0b1220', border: `1px solid ${accent}55`,
              color: accent, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', cursor: 'pointer',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        )}
        {open && (
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 125, background: 'rgba(0,0,0,0.45)' }} />
        )}
        <section
          aria-hidden={!open}
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 126,
            height: '85vh', display: 'flex', flexDirection: 'column',
            transform: open ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'rgba(4,4,10,0.99)',
            borderTop: `1px solid ${accent}33`,
            borderTopLeftRadius: 10, borderTopRightRadius: 10,
          }}
        >
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
            <span style={{ width: 36, height: 4, borderRadius: 10, background: 'rgba(255,255,255,0.18)', margin: '0 auto' }} />
            <button
              onClick={() => setOpen(false)}
              aria-label="Close conversation"
              style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {open && <CommandChatPanel agent={agent} onAgentChange={setAgent} />}
          </div>
        </section>
      </>
    )
  }

  return (
    <aside
      style={{
        position: 'fixed', top: 38, right: 0, bottom: 0, zIndex: 45,
        width: open ? RAIL_WIDTH : 40,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column',
        background: 'rgba(4,4,10,0.98)',
        borderLeft: `1px solid ${open ? `${accent}22` : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <button
        onClick={() => setOpen(value => !value)}
        aria-label={open ? 'Collapse conversation' : 'Open conversation'}
        aria-expanded={open}
        style={{
          flexShrink: 0, height: 32, display: 'flex', alignItems: 'center',
          justifyContent: open ? 'flex-start' : 'center', gap: 6, padding: open ? '0 10px' : 0,
          background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
          color: accent, cursor: 'pointer', fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'none' : 'rotate(180deg)' }}>
          <path d="m9 18 6-6-6-6" />
        </svg>
        {open && <span>{agent === 'wendy' ? 'WENDY' : 'ELLIE'}</span>}
      </button>
      {open ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <CommandChatPanel agent={agent} onAgentChange={setAgent} />
        </div>
      ) : (
        <span
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            writingMode: 'vertical-rl', fontSize: 10, fontWeight: 800,
            letterSpacing: '0.18em', color: '#475569', userSelect: 'none',
          }}
        >
          {agent === 'wendy' ? 'WENDY' : 'ELLIE'}
        </span>
      )}
    </aside>
  )
}
