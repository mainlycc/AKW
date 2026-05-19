import type { StudentPaymentOverview } from '@/lib/actions/student-payment-overview'

const CACHE_TTL_MS = 5 * 60 * 1000

const cache = new Map<
  string,
  { overview: StudentPaymentOverview; fetchedAt: number }
>()

export function getCachedPaymentOverview(
  studentId: string
): StudentPaymentOverview | null {
  const entry = cache.get(studentId)
  return entry?.overview ?? null
}

export function isPaymentOverviewCacheFresh(studentId: string): boolean {
  const entry = cache.get(studentId)
  if (!entry) return false
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS
}

export function setCachedPaymentOverview(
  studentId: string,
  overview: StudentPaymentOverview
): void {
  cache.set(studentId, { overview, fetchedAt: Date.now() })
}

export function invalidatePaymentOverviewCache(studentId?: string): void {
  if (studentId) {
    cache.delete(studentId)
  } else {
    cache.clear()
  }
}
