import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'bpe_dashboard_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function getDashboardPassword() {
  return process.env.DASHBOARD_PASSWORD || process.env.BPE_PASSCODE || ''
}

function getSigningSecret() {
  return process.env.AUTH_SECRET || process.env.DASHBOARD_AUTH_SECRET || getDashboardPassword()
}

function sign(value: string) {
  return createHmac('sha256', getSigningSecret()).update(value).digest('hex')
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function isPasswordAuthConfigured() {
  return Boolean(getDashboardPassword())
}

export function verifyDashboardPassword(password: string) {
  const expected = getDashboardPassword()
  return Boolean(expected) && safeEqual(password, expected)
}

export function createDashboardSessionValue() {
  const createdAt = Date.now().toString()
  return `${createdAt}.${sign(createdAt)}`
}

export function isValidDashboardSession(value?: string) {
  if (!value || !getSigningSecret()) return false

  const [createdAt, signature] = value.split('.')
  if (!createdAt || !signature || !safeEqual(signature, sign(createdAt))) return false

  const ageMs = Date.now() - Number(createdAt)
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= MAX_AGE_SECONDS * 1000
}

export async function hasDashboardSession() {
  const cookieStore = await cookies()
  return isValidDashboardSession(cookieStore.get(COOKIE_NAME)?.value)
}

export function getDashboardCookieOptions() {
  return {
    name: COOKIE_NAME,
    maxAge: MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  }
}

export { COOKIE_NAME }
