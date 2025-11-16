'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/actions/notifications'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'

type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: booking, error: fetchError } = await supabase
    .from('public_booking_requests')
    .select(
      'assignment_id, booked_slot_id, tutor_id, request_date, weekday, start_time, end_time, student_first_name, student_last_name, subject_id, subject_level_id'
    )
    .eq('id', bookingId)
    .maybeSingle()

  if (fetchError) {
    throw fetchError
  }

  if (!booking) {
    throw new Error('Rezerwacja nie została znaleziona.')
  }

  // Update booking status
  const { error: updateError } = await admin
    .from('public_booking_requests')
    .update({ status })
    .eq('id', bookingId)

  if (updateError) {
    throw updateError
  }

  // Update assignment status
  if (booking.assignment_id) {
    let nextAssignmentStatus: 'pending' | 'active' | 'cancelled' = 'pending'
    if (status === 'confirmed') {
      nextAssignmentStatus = 'active'
    } else if (status === 'cancelled') {
      nextAssignmentStatus = 'cancelled'
    }

    const { error: assignmentError } = await admin
      .from('student_assignments')
      .update({ status: nextAssignmentStatus })
      .eq('id', booking.assignment_id)

    if (assignmentError) {
      throw assignmentError
    }
  }

  // Handle booked_slot: create when confirmed, cancel/delete when cancelled
  if (status === 'confirmed') {
    // Create booked_slot if it doesn't exist
    if (!booking.booked_slot_id) {
      // Check if slot already exists (might have been created manually)
      const { data: existingSlot } = await admin
        .from('booked_slots')
        .select('id, status')
        .eq('tutor_id', booking.tutor_id)
        .eq('student_assignment_id', booking.assignment_id)
        .eq('weekday', booking.weekday)
        .eq('start_time', booking.start_time)
        .eq('end_time', booking.end_time)
        .maybeSingle()

      if (existingSlot) {
        // Update existing slot to booked
        if (existingSlot.status !== 'booked') {
          const { error: slotUpdateError } = await admin
            .from('booked_slots')
            .update({ status: 'booked' })
            .eq('id', existingSlot.id)

          if (slotUpdateError) {
            throw slotUpdateError
          }
        }

        // Update booking request with booked_slot_id
        await admin
          .from('public_booking_requests')
          .update({ booked_slot_id: existingSlot.id })
          .eq('id', bookingId)
      } else {
        // Create new booked_slot
        const { data: newSlot, error: slotInsertError } = await admin
          .from('booked_slots')
          .insert({
            tutor_id: booking.tutor_id,
            student_assignment_id: booking.assignment_id!,
            weekday: booking.weekday,
            start_time: booking.start_time,
            end_time: booking.end_time,
            status: 'booked',
            created_by: booking.tutor_id,
          })
          .select('id')
          .single()

        if (slotInsertError || !newSlot) {
          throw slotInsertError ?? new Error('Nie udało się utworzyć rezerwacji slotu.')
        }

        // Update booking request with booked_slot_id
        await admin
          .from('public_booking_requests')
          .update({ booked_slot_id: newSlot.id })
          .eq('id', bookingId)
      }
    } else {
      // Update existing booked_slot to booked status
      const { error: slotUpdateError } = await admin
        .from('booked_slots')
        .update({ status: 'booked' })
        .eq('id', booking.booked_slot_id)

      if (slotUpdateError) {
        throw slotUpdateError
      }
    }
  } else if (status === 'cancelled' && booking.booked_slot_id) {
    // Cancel booked_slot if it exists
    const { error: slotCancelError } = await admin
      .from('booked_slots')
      .update({ status: 'cancelled' })
      .eq('id', booking.booked_slot_id)

    if (slotCancelError) {
      throw slotCancelError
    }
  }

  // Powiadomienie dla tutora o zmianie statusu rezerwacji
  try {
    if (booking.tutor_id && (status === 'confirmed' || status === 'cancelled')) {
      // Pobierz dane potrzebne do powiadomienia
      const [subjectData, levelData] = await Promise.all([
        booking.subject_id
          ? admin
              .from('subjects')
              .select('name')
              .eq('id', booking.subject_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        booking.subject_level_id
          ? admin
              .from('subject_levels')
              .select('level_name')
              .eq('id', booking.subject_level_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      const formattedDate = format(parseISO(booking.request_date), 'd MMMM yyyy', { locale: pl })
      const timeRange = `${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)}`
      const studentName = `${booking.student_first_name} ${booking.student_last_name}`
      const subjectLabel = subjectData.data?.name
        ? `${subjectData.data.name}${levelData.data?.level_name ? ` - ${levelData.data.level_name}` : ''}`
        : ''

      if (status === 'confirmed') {
        await createNotification({
          userId: booking.tutor_id,
          type: 'public_booking_confirmed',
          title: 'Rezerwacja potwierdzona',
          message: `Rezerwacja dla ${studentName} na ${formattedDate} ${timeRange}${subjectLabel ? ` (${subjectLabel})` : ''} została potwierdzona.`,
          metadata: {
            booking_id: bookingId,
            student_name: studentName,
            date: booking.request_date,
            time: timeRange,
          },
        })
      } else if (status === 'cancelled') {
        await createNotification({
          userId: booking.tutor_id,
          type: 'public_booking_cancelled',
          title: 'Rezerwacja anulowana',
          message: `Rezerwacja dla ${studentName} na ${formattedDate} ${timeRange}${subjectLabel ? ` (${subjectLabel})` : ''} została anulowana.`,
          metadata: {
            booking_id: bookingId,
            student_name: studentName,
            date: booking.request_date,
            time: timeRange,
          },
        })
      }
    }
  } catch (notificationError) {
    // Logujemy błąd, ale nie przerywamy procesu
    console.error('Failed to create notification:', notificationError)
  }

  revalidatePath('/dashboard/rezerwacje-publiczne')
  revalidatePath('/public/rezerwacje')
  revalidatePath('/dashboard')
}

export async function deleteBooking(id: string) {
  const admin = createAdminClient()

  // Pobierz rezerwację, aby sprawdzić czy ma booked_slot_id
  const { data: booking } = await admin
    .from('public_booking_requests')
    .select('booked_slot_id, assignment_id')
    .eq('id', id)
    .maybeSingle()

  // Usuń booked_slot jeśli istnieje
  if (booking?.booked_slot_id) {
    await admin
      .from('booked_slots')
      .delete()
      .eq('id', booking.booked_slot_id)
  }

  // Usuń przypisanie jeśli istnieje (opcjonalnie, można zostawić)
  // if (booking?.assignment_id) {
  //   await admin
  //     .from('student_assignments')
  //     .delete()
  //     .eq('id', booking.assignment_id)
  // }

  // Usuń rezerwację
  const { error } = await admin
    .from('public_booking_requests')
    .delete()
    .eq('id', id)

  if (error) throw error

  revalidatePath('/dashboard/rezerwacje-publiczne')
  revalidatePath('/public/rezerwacje')
}


