'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/actions/auth'
import type { SessionStatus } from '@/lib/types/database.types'

export async function updateSessionStatus(
  sessionId: string,
  status: 'completed' | 'cancelled'
) {
  const supabase = await createClient()
  const profile = await getUserProfile()

  if (!profile) {
    throw new Error('Unauthorized')
  }

  // Sprawdź czy sesja należy do tutora
  const { data: session, error: fetchError } = await supabase
    .from('tutoring_sessions')
    .select('tutor_id, status, session_date')
    .eq('id', sessionId)
    .single()

  if (fetchError || !session) {
    throw new Error('Session not found')
  }

  // Tylko tutor może aktualizować swoje sesje
  if (session.tutor_id !== profile.id) {
    throw new Error('Unauthorized - you can only update your own sessions')
  }

  // Tylko sesje ze statusem 'scheduled' można aktualizować
  if (session.status !== 'scheduled') {
    throw new Error('Only scheduled sessions can be updated')
  }

  // Zaktualizuj status
  const { error } = await supabase
    .from('tutoring_sessions')
    .update({ status: status as SessionStatus })
    .eq('id', sessionId)

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/kalendarz-lekcji')
}

