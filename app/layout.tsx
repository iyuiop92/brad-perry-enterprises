import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '600', '800'],
  variable: '--font-outfit',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#04040a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Brad Perry Enterprises',
  description: 'Web designer and operator of profitable niche sites.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BPE OS',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${outfit.variable} h-full`}>
      <head>
        <link rel="apple-touch-icon" href="/bpe-logo.png" />
      </head>
      <body className="min-h-full font-[family-name:var(--font-outfit)]">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
