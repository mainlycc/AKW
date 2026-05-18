export interface LessonHistoryItem {
  id: string
  session_date: string
  duration_minutes: number
  status: 'completed' | 'scheduled' | 'cancelled'
  notes: string | null
  tutor_name: string | null
  subject_name: string | null
  level_name: string | null
}

const CACHE_TTL_MS = 5 * 60 * 1000

const cache = new Map<
  string,
  { sessions: LessonHistoryItem[]; fetchedAt: number }
>()

export function getCachedLessonHistory(
  studentId: string
): LessonHistoryItem[] | null {
  const entry = cache.get(studentId)
  return entry?.sessions ?? null
}

export function isLessonHistoryCacheFresh(studentId: string): boolean {
  const entry = cache.get(studentId)
  if (!entry) return false
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS
}

export function setCachedLessonHistory(
  studentId: string,
  sessions: LessonHistoryItem[]
): void {
  cache.set(studentId, { sessions, fetchedAt: Date.now() })
}

export function invalidateLessonHistoryCache(studentId?: string): void {
  if (studentId) {
    cache.delete(studentId)
  } else {
    cache.clear()
  }
}
