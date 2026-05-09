'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import type { Workspace } from '@/lib/types'

interface GraphNode {
  ws: Workspace
  baseX: number
  baseY: number
  x: number
  y: number
  radius: number
  phase: number
}

function healthPulse(ws: Workspace): number {
  if (ws.task_count === 0) return 50
  return Math.min(100, Math.round(
    ((ws.active_count * 2 + (ws.task_count - ws.blocked_count)) / (ws.task_count * 3)) * 100
  ))
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function buildNodes(workspaces: Workspace[], w: number, h: number): GraphNode[] {
  const cx = w / 2
  const cy = h / 2
  const baseR = Math.min(w, h) * 0.31

  return workspaces.map((ws, i) => {
    const angle = (i / workspaces.length) * Math.PI * 2 - Math.PI / 2
    const rFactor = ws.type === 'client' ? 1.18 : 0.92
    const bx = cx + Math.cos(angle) * baseR * rFactor
    const by = cy + Math.sin(angle) * baseR * rFactor
    const load = Math.min(1, ws.task_count / 10)
    return {
      ws,
      baseX: bx,
      baseY: by,
      x: bx,
      y: by,
      radius: 22 + load * 16,
      phase: i * 1.618,
    }
  })
}

function buildConnections(nodes: GraphNode[]): [number, number][] {
  const pairs: [number, number][] = []
  const added = new Set<string>()
  nodes.forEach((a, i) => {
    const sorted = nodes
      .map((b, j) => ({ j, d: Math.hypot(a.baseX - b.baseX, a.baseY - b.baseY) }))
      .filter(({ j }) => j !== i)
      .sort((x, y) => x.d - y.d)
    sorted.slice(0, 2).forEach(({ j }) => {
      const key = `${Math.min(i, j)}-${Math.max(i, j)}`
      if (!added.has(key)) { added.add(key); pairs.push([i, j]) }
    })
  })
  return pairs
}

interface HoverInfo {
  ws: Workspace
  x: number
  y: number
}

export default function NeuralGraph({
  workspaces,
  selectedWs,
  onSelectWs,
}: {
  workspaces: Workspace[]
  selectedWs: Workspace | null
  onSelectWs: (ws: Workspace | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const connectionsRef = useRef<[number, number][]>([])
  const animRef = useRef<number>(0)
  const tRef = useRef(0)
  const labelRefs = useRef<(HTMLDivElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredNode, setHoveredNode] = useState<HoverInfo | null>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })

  const initGraph = useCallback((w: number, h: number) => {
    nodesRef.current = buildNodes(workspaces, w, h)
    connectionsRef.current = buildConnections(nodesRef.current)
  }, [workspaces])

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setCanvasSize({ w: width, h: height })
      initGraph(width, height)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [initGraph])

  useEffect(() => {
    initGraph(canvasSize.w, canvasSize.h)
  }, [workspaces, canvasSize, initGraph])

  // Canvas draw loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasSize.w * dpr
    canvas.height = canvasSize.h * dpr
    ctx.scale(dpr, dpr)

    function draw() {
      if (!ctx) return
      tRef.current += 0.006
      const t = tRef.current
      ctx.clearRect(0, 0, canvasSize.w, canvasSize.h)

      const nodes = nodesRef.current
      // Update floating positions
      nodes.forEach(node => {
        node.x = node.baseX + Math.sin(t * 0.7 + node.phase) * 7
        node.y = node.baseY + Math.cos(t * 0.5 + node.phase * 1.1) * 5
      })

      // Update HTML labels
      nodes.forEach((node, i) => {
        const el = labelRefs.current[i]
        if (el) {
          el.style.left = `${node.x}px`
          el.style.top = `${node.y}px`
        }
      })

      // Draw connections
      const connections = connectionsRef.current
      connections.forEach(([i, j]) => {
        const a = nodes[i]
        const b = nodes[j]
        if (!a || !b) return

        const [ar, ag, ab] = hexToRgb(a.ws.color)
        const [br, bg, bb] = hexToRgb(b.ws.color)

        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
        grad.addColorStop(0, `rgba(${ar},${ag},${ab},0.18)`)
        grad.addColorStop(0.5, `rgba(${Math.round((ar+br)/2)},${Math.round((ag+bg)/2)},${Math.round((ab+bb)/2)},0.06)`)
        grad.addColorStop(1, `rgba(${br},${bg},${bb},0.18)`)

        ctx.beginPath()
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2 - 20
        ctx.moveTo(a.x, a.y)
        ctx.quadraticCurveTo(mx, my, b.x, b.y)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1
        ctx.setLineDash([3, 8])
        ctx.lineDashOffset = -t * 15
        ctx.stroke()
        ctx.setLineDash([])
      })

      // Draw nodes
      nodes.forEach(node => {
        const { x, y, radius, ws } = node
        const [r, g, b] = hexToRgb(ws.color)
        const isSelected = selectedWs?.id === ws.id
        const isActive = ws.active_count > 0
        const glowIntensity = isSelected ? 35 : isActive ? 18 + ws.active_count * 3 : 8
        const glowPulse = Math.sin(t * 2 + node.phase) * 0.3 + 0.7

        // Outer glow
        const outerGlow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 2.2)
        outerGlow.addColorStop(0, `rgba(${r},${g},${b},${(isSelected ? 0.25 : 0.1) * glowPulse})`)
        outerGlow.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.beginPath()
        ctx.arc(x, y, radius * 2.2, 0, Math.PI * 2)
        ctx.fillStyle = outerGlow
        ctx.fill()

        // Node body gradient
        const bodyGrad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius)
        bodyGrad.addColorStop(0, `rgba(${r},${g},${b},0.35)`)
        bodyGrad.addColorStop(1, `rgba(${r},${g},${b},0.12)`)
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fillStyle = bodyGrad
        ctx.fill()

        // Border ring
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${r},${g},${b},${isSelected ? 0.9 : 0.45})`
        ctx.lineWidth = isSelected ? 2 : 1
        ctx.shadowColor = ws.color
        ctx.shadowBlur = glowIntensity * glowPulse
        ctx.stroke()
        ctx.shadowBlur = 0

        // Activity ring (outer dashed)
        if (isActive) {
          ctx.beginPath()
          ctx.arc(x, y, radius + 6, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${r},${g},${b},0.2)`
          ctx.lineWidth = 1
          ctx.setLineDash([2, 4])
          ctx.lineDashOffset = t * 20
          ctx.stroke()
          ctx.setLineDash([])
        }

        // Blocked indicator
        if (ws.blocked_count > 0) {
          ctx.beginPath()
          ctx.arc(x + radius * 0.65, y - radius * 0.65, 5, 0, Math.PI * 2)
          const pulse = Math.sin(t * 3) * 0.4 + 0.6
          ctx.fillStyle = `rgba(245,158,11,${pulse})`
          ctx.shadowColor = '#f59e0b'
          ctx.shadowBlur = 8
          ctx.fill()
          ctx.shadowBlur = 0
        }
      })

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [canvasSize, selectedWs])

  // Mouse interaction
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const hit = nodesRef.current.find(n => Math.hypot(n.x - mx, n.y - my) < n.radius + 14)
    if (hit) {
      setHoveredNode({ ws: hit.ws, x: hit.x, y: hit.y })
    } else {
      setHoveredNode(null)
    }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const hit = nodesRef.current.find(n => Math.hypot(n.x - mx, n.y - my) < n.radius + 14)
    if (hit) {
      onSelectWs(selectedWs?.id === hit.ws.id ? null : hit.ws)
    }
  }, [selectedWs, onSelectWs])

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null)
  }, [])

  if (workspaces.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs" style={{ color: '#1e293b' }}>No workspaces configured</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: hoveredNode ? 'pointer' : 'default' }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
      />

      {/* HTML label layer */}
      {workspaces.map((ws, i) => (
        <div
          key={ws.id}
          ref={el => { labelRefs.current[i] = el }}
          className="absolute pointer-events-none"
          style={{ transform: 'translate(-50%, 0)', marginTop: 4 }}
        >
          <div className="flex flex-col items-center gap-0.5" style={{ marginTop: 28 + Math.min(1, ws.task_count / 10) * 16 + 4 }}>
            <span
              className="text-[10px] font-[700] tracking-wide whitespace-nowrap px-2 py-0.5 rounded-full"
              style={{
                color: ws.color,
                background: `${ws.color}14`,
                border: `1px solid ${ws.color}30`,
                textShadow: `0 0 8px ${ws.color}`,
              }}
            >
              {ws.name}
            </span>
            {ws.active_count > 0 && (
              <span className="text-[8px] font-[600]" style={{ color: '#22c55e' }}>
                {ws.active_count} active
              </span>
            )}
          </div>
        </div>
      ))}

      {/* Hover KPI halo */}
      {hoveredNode && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: hoveredNode.x,
            top: hoveredNode.y,
            transform: 'translate(-50%, calc(-100% - 20px))',
          }}
        >
          <div
            className="rounded-xl px-4 py-3 flex flex-col gap-2"
            style={{
              background: 'rgba(5,7,10,0.92)',
              border: `1px solid ${hoveredNode.ws.color}40`,
              backdropFilter: 'blur(16px)',
              boxShadow: `0 0 30px ${hoveredNode.ws.color}20`,
              minWidth: 180,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: hoveredNode.ws.color, boxShadow: `0 0 6px ${hoveredNode.ws.color}` }}
              />
              <span className="text-xs font-[800]" style={{ color: hoveredNode.ws.color }}>
                {hoveredNode.ws.name}
              </span>
              <span className="text-[8px] font-[600] ml-auto" style={{ color: '#334155' }}>
                {hoveredNode.ws.type}
              </span>
            </div>

            {/* Health pulse bar */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[8px] font-[600] uppercase tracking-wider" style={{ color: '#334155' }}>Health</span>
                <span className="text-[8px] font-[700]" style={{ color: hoveredNode.ws.color }}>
                  {healthPulse(hoveredNode.ws)}%
                </span>
              </div>
              <div className="h-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${healthPulse(hoveredNode.ws)}%`, background: hoveredNode.ws.color }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              {[
                { label: 'ACTIVE', val: hoveredNode.ws.active_count, color: '#00b4ff' },
                { label: 'BLOCKED', val: hoveredNode.ws.blocked_count, color: '#f59e0b' },
                { label: 'IDEAS', val: hoveredNode.ws.idea_count, color: '#475569' },
              ].map(({ label, val, color }) => (
                <div key={label}>
                  <p className="text-sm font-[800]" style={{ color }}>{val}</p>
                  <p className="text-[7px] font-[700] uppercase tracking-wider" style={{ color: '#1e293b' }}>{label}</p>
                </div>
              ))}
            </div>

            <p className="text-[9px] text-center" style={{ color: '#334155' }}>
              Click to select workspace
            </p>
          </div>
        </div>
      )}

      {/* Center hint when empty */}
      {workspaces.length > 0 && !selectedWs && !hoveredNode && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: 0.25 }}
        >
          <p className="text-[10px] font-[600] uppercase tracking-[0.3em]" style={{ color: '#00b4ff' }}>
            Neural Command Grid
          </p>
        </div>
      )}
    </div>
  )
}
