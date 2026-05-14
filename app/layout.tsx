import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '600', '800'],
  variable: '--font-outfit',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Brad Perry Enterprises',
  description: 'Web designer and operator of profitable niche sites.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${outfit.variable} h-full`}>
      <body className="min-h-full font-[family-name:var(--font-outfit)]">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
