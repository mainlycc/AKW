'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/actions/notifications'
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, format } from 'date-fns'

export type DeclarationStatus = 'draft' | 'submitted' | 'approved'

export interface DeclarationEntry {
  student_id: string
  session_date: string // YYYY-MM-DD
  start_time: string // HH:mm
  duration_minutes: number
  assignment_id: string
}

export async function createOrUpdateDeclaration(
  tutorId: string,
  month: number,
  year: number,
  entries: DeclarationEntry[],
  status: DeclarationStatus = 'draft'
) {
  const supabase = await createClient()

  // Check if declaration exists
  const { data: existing } = await supabase
    .from('monthly_declarations')
    .select('id')
    .eq('tutor_id', tutorId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  let declarationId: string

  if (existing) {
    // Update existing declaration
    await supabase
      .from('monthly_declarations')
      .update({
        status,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null,
      })
      .eq('id', existing.id)

    // Delete old entries
    await supabase
      .from('monthly_declaration_entries')
      .delete()
      .eq('declaration_id', existing.id)

    // Insert new entries
    if (entries.length > 0) {
      await supabase
        .from('monthly_declaration_entries')
        .insert(
          entries.map(e => ({
            declaration_id: existing.id,
            student_id: e.student_id,
            session_date: e.session_date,
            start_time: e.start_time,
            duration_minutes: e.duration_minutes,
            assignment_id: e.assignment_id,
          }))
        )
    }
    declarationId = existing.id
  } else {
    // Create new declaration
    const { data: declaration, error } = await supabase
      .from('monthly_declarations')
      .insert({
        tutor_id: tutorId,
        month,
        year,
        status,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (error) throw error

    // Insert entries
    if (entries.length > 0) {
      await supabase
        .from('monthly_declaration_entries')
        .insert(
          entries.map(e => ({
            declaration_id: declaration.id,
            student_id: e.student_id,
            session_date: e.session_date,
            start_time: e.start_time,
            duration_minutes: e.duration_minutes,
            assignment_id: e.assignment_id,
          }))
        )
    }
    declarationId = declaration.id
  }

  if (status === 'submitted' && entries.length > 0) {
    await generateSessionsFromDeclarationEntries(tutorId, entries)
  }

  revalidatePath('/dashboard/moje-deklaracje')
  revalidatePath('/dashboard/kalendarz-lekcji')
  return declarationId
}

export async function deleteDeclaration(declarationId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('monthly_declarations')
    .delete()
    .eq('id', declarationId)

  if (error) throw error

  revalidatePath('/dashboard/moje-deklaracje')
}

export async function generateLessonsFromBookedSlots(
  tutorId: string,
  month: number,
  year: number
): Promise<DeclarationEntry[]> {
  const supabase = await createClient()

  // Get all active booked slots for the tutor
  const { data: bookedSlots, error: slotsError } = await supabase
    .from('booked_slots')
    .select(`
      id,
      weekday,
      start_time,
      end_time,
      student_assignment_id,
      student_assignments (
        id,
        student_id
      )
    `)
    .eq('tutor_id', tutorId)
    .eq('status', 'booked')

  if (slotsError) {
    throw new Error(`Failed to fetch booked slots: ${slotsError.message}`)
  }

  if (!bookedSlots || bookedSlots.length === 0) {
    return []
  }

  // Calculate month boundaries
  const monthStart = startOfMonth(new Date(year, month - 1, 1))
  const monthEnd = endOfMonth(new Date(year, month - 1, 1))
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const entries: DeclarationEntry[] = []

  // For each booked slot, generate entries for all matching weekdays in the month
  for (const slot of bookedSlots) {
    const assignment = Array.isArray(slot.student_assignments)
      ? slot.student_assignments[0]
      : slot.student_assignments

    if (!assignment || !assignment.student_id) continue

    // Calculate duration in minutes
    const startTime = new Date(`2000-01-01T${slot.start_time}`)
    const endTime = new Date(`2000-01-01T${slot.end_time}`)
    const durationMs = endTime.getTime() - startTime.getTime()
    const durationMinutes = Math.round(durationMs / (1000 * 60))

    // Find all days in the month with the matching weekday
    // Note: getDay() returns 0 (Sunday) to 6 (Saturday)
    // booked_slots.weekday is 1 (Monday) to 7 (Sunday)
    // So we need to convert: booked_slots weekday 1-7 -> getDay() 0-6
    const targetWeekday = slot.weekday === 7 ? 0 : slot.weekday // Convert Sunday: 7 -> 0

    for (const day of daysInMonth) {
      const dayOfWeek = getDay(day) // 0 = Sunday, 6 = Saturday
      
      if (dayOfWeek === targetWeekday) {
        entries.push({
          student_id: assignment.student_id,
          session_date: format(day, 'yyyy-MM-dd'),
          start_time: slot.start_time,
          duration_minutes: durationMinutes,
          assignment_id: slot.student_assignment_id,
        })
      }
    }
  }

  return entries
}

async function generateSessionsFromDeclarationEntries(
  tutorId: string,
  entries: DeclarationEntry[]
) {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const entry of entries) {
    const entryDate = new Date(entry.session_date)
    if (entryDate < today) {
      continue
    }
    const sessionDateTime = `${entry.session_date}T${entry.start_time}:00`

    const { data: existing, error: existingError } = await supabase
      .from('tutoring_sessions')
      .select('id')
      .eq('assignment_id', entry.assignment_id)
      .eq('session_date', sessionDateTime)
      .maybeSingle()

    if (existingError) {
      throw existingError
    }

    if (existing) {
      continue
    }
    const { error: insertError } = await supabase
      .from('tutoring_sessions')
      .insert({
        assignment_id: entry.assignment_id,
        tutor_id: tutorId,
        student_id: entry.student_id,
        session_date: sessionDateTime,
        duration_minutes: entry.duration_minutes,
        created_by: tutorId,
      })
    if (insertError) {
      throw insertError
    }
  }
}

