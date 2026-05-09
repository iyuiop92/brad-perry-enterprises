const BRAND_COLORS: Record<string, string> = {
  bradperryenterprises: '#8b5cf6',
  bpe:                  '#8b5cf6',
  mipura:               '#c17f3c',
  aetherhockey:         '#00b4ff',
  studiothree60:        '#8b5cf6',
  startpaddle:          '#f97316',
  drivenbaseballathletics: '#ef4444',
  driven:               '#ef4444',
  studiothree65:        '#22c55e',
  petprosusa:           '#10b981',
  superwatchesstore:    '#f59e0b',
  azice:                '#38bdf8',
}

function brandColor(brand: string | null | undefined): string {
  if (!brand) return '#475569'
  const key = brand.toLowerCase().replace(/[\s\-_.]/g, '')
  return BRAND_COLORS[key] ?? '#475569'
}

export default function StatusDot({ brand }: { brand?: string | null }) {
  const color = brandColor(brand)
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{
        width: 8,
        height: 8,
        background: color,
        boxShadow: `0 0 4px ${color}`,
      }}
      title={brand ?? undefined}
    />
  )
}
