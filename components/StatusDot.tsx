import type { TaskOwner } from '@/lib/types'

const OWNER_COLORS: Record<TaskOwner, string> = {
  brad: '#00b4ff',
  wendy: '#a855f7',
  ellie: '#22c55e',
}

export default function StatusDot({ owner }: { owner: TaskOwner }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{
        width: 8,
        height: 8,
        background: OWNER_COLORS[owner],
        boxShadow: `0 0 4px ${OWNER_COLORS[owner]}`,
      }}
      title={owner}
    />
  )
}
