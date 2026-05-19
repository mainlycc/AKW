'use server'

import { createClient } from '@/lib/supabase/server'

/** Wszystkie przeszłe lekcje tutora ze statusem scheduled (bez limitu daty / miesiąca). */
export async function getPendingPastSessionsCount(tutorId: string): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('tutoring_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('tutor_id', tutorId)
    .eq('status', 'scheduled')
    .lt('session_date', new Date().toISOString())

  if (error) {
    console.error('[getPendingPastSessionsCount]', error.message)
    return 0
  }

  return count ?? 0
}
