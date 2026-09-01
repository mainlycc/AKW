'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/actions/notifications'
import { createConfirmedBookingResources, cancelConfirmedBookingResources } from '@/lib/actions/public-booking'
import { sendFinalBookingConfirmationEmail } from '@/lib/email/send'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { SLOT_DURATION_MINUTES } from '@/lib/types/availability.types'

type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: booking, error: fetchError } = await supabase
    .from('public_booking_requests')
    .select(
      'assignment_id, booked_slot_id, session_id, tutor_id, student_id, request_date, weekday, start_time, end_time, student_first_name, student_last_name, contact_email, subject_id, subject_level_id, is_recurring'
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

  // Handle booked_slot or one-time session when confirming/cancelling
  if (status === 'confirmed') {
    await createConfirmedBookingResources(admin, {
      id: bookingId,
      assignment_id: booking.assignment_id,
      booked_slot_id: booking.booked_slot_id,
      session_id: booking.session_id,
      tutor_id: booking.tutor_id,
      student_id: booking.student_id,
      request_date: booking.request_date,
      weekday: booking.weekday,
      start_time: booking.start_time,
      end_time: booking.end_time,
      is_recurring: booking.is_recurring ?? false,
    })
  } else if (status === 'cancelled') {
    await cancelConfirmedBookingResources(admin, {
      booked_slot_id: booking.booked_slot_id,
      session_id: booking.session_id,
    })
  }

  // Powiadomienie dla tutora i email dla osoby rezerwującej o zmianie statusu rezerwacji
  try {
    if (booking.tutor_id && (status === 'confirmed' || status === 'cancelled')) {
      // Pobierz dane potrzebne do powiadomienia i emaila
      const [subjectData, levelData, tutorData] = await Promise.all([
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
        admin
          .from('profiles')
          .select('full_name')
          .eq('id', booking.tutor_id)
          .single(),
      ])

      const formattedDate = format(parseISO(booking.request_date), 'd MMMM yyyy', { locale: pl })
      const timeRange = `${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)}`
      const studentName = `${booking.student_first_name} ${booking.student_last_name}`
      const subjectLabel = subjectData.data?.name
        ? `${subjectData.data.name}${levelData.data?.level_name ? ` - ${levelData.data.level_name}` : ''}`
        : ''

      if (status === 'confirmed') {
        // Powiadomienie dla tutora
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

        // Wyślij email z ostatecznym potwierdzeniem do osoby, która zarezerwowała
        if (
          booking.contact_email &&
          tutorData.data &&
          subjectData.data &&
          levelData.data
        ) {
          try {
            const emailResult = await sendFinalBookingConfirmationEmail({
              to: booking.contact_email,
              studentName: studentName,
              tutorName: tutorData.data.full_name,
              subject: subjectData.data.name,
              level: levelData.data.level_name,
              date: formattedDate,
              time: timeRange,
              duration: SLOT_DURATION_MINUTES,
            })

            if (!emailResult.success) {
              console.error('Final booking confirmation email failed:', {
                error: emailResult.error,
                email: booking.contact_email,
                bookingId: bookingId,
              })
            } else {
              console.log('Final booking confirmation email sent successfully:', {
                messageId: emailResult.messageId,
                email: booking.contact_email,
                bookingId: bookingId,
              })
            }
          } catch (emailError) {
            // Logujemy błąd, ale nie przerywamy procesu
            console.error('Failed to send final booking confirmation email:', {
              error: emailError instanceof Error ? emailError.message : String(emailError),
              email: booking.contact_email,
              bookingId: bookingId,
            })
          }
        } else {
          console.error('Missing data for final booking confirmation email:', {
            hasEmail: !!booking.contact_email,
            hasTutor: !!tutorData.data,
            hasSubject: !!subjectData.data,
            hasLevel: !!levelData.data,
          })
        }
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
    console.error('Failed to create notification or send email:', notificationError)
  }

  revalidatePath('/dashboard/rezerwacje-publiczne')
  revalidatePath('/dashboard/kalendarz-lekcji')
  revalidatePath('/public/rezerwacje')
  revalidatePath('/dashboard')
}

export async function deleteBooking(id: string) {
  const admin = createAdminClient()

  // Pobierz rezerwację, aby sprawdzić czy ma booked_slot_id
  const { data: booking } = await admin
    .from('public_booking_requests')
    .select('booked_slot_id, session_id, assignment_id')
    .eq('id', id)
    .maybeSingle()

  if (booking?.booked_slot_id) {
    await admin
      .from('booked_slots')
      .delete()
      .eq('id', booking.booked_slot_id)
  }

  if (booking?.session_id) {
    await admin
      .from('tutoring_sessions')
      .delete()
      .eq('id', booking.session_id)
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


