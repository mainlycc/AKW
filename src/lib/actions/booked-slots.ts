'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveCorrelationId, resolveRoute, type MonitoringMeta } from '@/lib/monitoring/correlation'
import { logSupabaseFailure } from '@/lib/monitoring/support-events'

export interface CreateBookedSlotInput {
  student_assignment_id: string
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
  start_time: string // HH:MM
  end_time: string   // HH:MM
}

export type BookedSlotStatus = 'booked' | 'cancelled'

export interface BookedSlot {
  id: string
  tutor_id: string
  student_assignment_id: string
  weekday: number
  start_time: string
  end_time: string
  status: BookedSlotStatus
  created_by: string
  created_at: string
  updated_at: string
  // enriched
  students?: { id: string; first_name: string; last_name: string } | null
  profiles?: { id: string; full_name: string } | null
  subjects?: { id: string; name: string } | null
  subject_levels?: { id: string; level_name: string } | null
}

export async function listBookedSlots(params: {
  scope: 'admin' | 'tutor'
  tutorId?: string
}) {
  const supabase = await createClient()

  let query = supabase
    .from('booked_slots')
    .select(`
      *,
      student_assignments (*,
        students (id, first_name, last_name),
        subjects (id, name),
        subject_levels (id, level_name)
      ),
      profiles!booked_slots_tutor_id_fkey (id, full_name)
    `)
    .order('weekday')
    .order('start_time')

  // Filtruj po tutorId jeśli jest podane (dla obu scope: 'tutor' i 'admin')
  if (params.tutorId) {
    query = query.eq('tutor_id', params.tutorId)
  }

  const { data, error } = await query
  if (error) throw error
  return data as unknown as BookedSlot[]
}

export async function createBookedSlot(
  createdBy: string,
  input: CreateBookedSlotInput,
  meta?: MonitoringMeta
) {
  const supabase = await createClient()
  const correlationId = resolveCorrelationId(meta)
  const route = resolveRoute(meta)

  // pobierz przypisanie, aby wyciągnąć tutora i zweryfikować spójność
  const { data: assignment, error: assErr } = await supabase
    .from('student_assignments')
    .select('id, tutor_id, status')
    .eq('id', input.student_assignment_id)
    .single()

  if (assErr || !assignment) {
    if (assErr) {
      await logSupabaseFailure({
        action: 'booked_slots.assignment.fetch',
        correlationId,
        route,
        request: { student_assignment_id: input.student_assignment_id },
        supabaseError: assErr,
      })
    }
    throw new Error('Nie znaleziono przypisania')
  }
  if (assignment.status !== 'active') {
    throw new Error('Przypisanie nie jest aktywne')
  }

  const { error } = await supabase.from('booked_slots').insert({
    tutor_id: assignment.tutor_id,
    student_assignment_id: input.student_assignment_id,
    weekday: input.weekday,
    start_time: input.start_time,
    end_time: input.end_time,
    status: 'booked',
    created_by: createdBy,
  })
  if (error) {
    await logSupabaseFailure({
      action: 'booked_slots.insert',
      correlationId,
      route,
      request: { ...input, tutor_id: assignment.tutor_id, created_by: createdBy },
      supabaseError: error,
    })
    throw error
  }

  // Revaliduj kalendarz dostępności i kalendarz lekcji
  revalidatePath('/dashboard/kalendarz')
  revalidatePath('/dashboard/kalendarz-lekcji')
}

export async function cancelBookedSlot(slotId: string, meta?: MonitoringMeta) {
  const supabase = await createClient()
  const correlationId = resolveCorrelationId(meta)
  const route = resolveRoute(meta)
  const { error } = await supabase
    .from('booked_slots')
    .update({ status: 'cancelled' })
    .eq('id', slotId)
  if (error) {
    await logSupabaseFailure({
      action: 'booked_slots.cancel',
      correlationId,
      route,
      request: { slotId },
      supabaseError: error,
    })
    throw error
  }
  
  // Revaliduj kalendarz dostępności i kalendarz lekcji
  revalidatePath('/dashboard/kalendarz')
  revalidatePath('/dashboard/kalendarz-lekcji')
}

// Funkcja pomocnicza: generuje sesje dla wszystkich aktywnych booked_slots
// Przydatne gdy migracja została zastosowana po utworzeniu booked_slots
export async function generateSessionsForAllBookedSlots(
  startDate?: string,
  endDate?: string
): Promise<number> {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('generate_sessions_for_all_booked_slots', {
    p_start_date: startDate || new Date().toISOString().split('T')[0],
    p_end_date: endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  })
  
  if (error) throw error
  
  // Revaliduj kalendarz lekcji
  revalidatePath('/dashboard/kalendarz-lekcji')
  
  return data || 0
}


