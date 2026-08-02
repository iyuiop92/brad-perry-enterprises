'use client'

import { useRef } from 'react'

export type PendingImage = {
  id: string
  filename: string
  mediaType: string
  url: string
}

const MAX_IMAGES = 8
const MAX_IMAGE_BYTES = 15 * 1024 * 1024

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function readImageAttachments(files: FileList | null): Promise<PendingImage[]> {
  const accepted = Array.from(files ?? []).filter(file => file.type.startsWith('image/') && file.size <= MAX_IMAGE_BYTES).slice(0, MAX_IMAGES)
  return Promise.all(accepted.map(async file => ({
    id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
    filename: file.name,
    mediaType: file.type,
    url: await readAsDataUrl(file),
  })))
}

export function ImageAttachmentPicker({
  images,
  onChange,
  disabled = false,
  color = '#00b4ff',
}: {
  images: PendingImage[]
  onChange: (images: PendingImage[]) => void
  disabled?: boolean
  color?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      const added = await readImageAttachments(event.target.files)
      if (added.length) onChange([...images, ...added].slice(0, MAX_IMAGES))
    } finally {
      event.target.value = ''
    }
  }

  return <>
    <input ref={inputRef} type="file" accept="image/*" multiple onChange={pick} className="hidden" />
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={disabled || images.length >= MAX_IMAGES}
      aria-label="Attach photos"
      title="Attach photos"
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px] disabled:opacity-40"
      style={{ background: 'transparent', border: 'none', color, cursor: disabled ? 'default' : 'pointer' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
    </button>
    {images.length > 0 && (
      <div className="flex shrink-0 gap-1 overflow-x-auto" aria-label={`${images.length} attached photo${images.length === 1 ? '' : 's'}`}>
        {images.map(image => (
          <div key={image.id} className="relative h-[34px] w-[34px] shrink-0 overflow-hidden rounded-[7px]" style={{ border: `1px solid ${color}66` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.filename} className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(images.filter(item => item.id !== image.id))} aria-label={`Remove ${image.filename}`} className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center border-0 text-[12px] font-bold" style={{ background: 'rgba(4,4,10,0.88)', color: '#f87171', cursor: 'pointer' }}>×</button>
          </div>
        ))}
      </div>
    )}
  </>
}
