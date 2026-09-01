'use server'

import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/actions/auth'
import { createPayUOrderForAdminReservation } from '@/lib/actions/payu'
import { sendPaymentLinkEmail, sendTutorBookingNotificationEmail } from '@/lib/email/send'
import { sendPaymentLinkSms, sendTutorAdminBookingNotificationSms } from '@/lib/sms/send'
import { SLOT_DURATION_MINUTES, DAY_NAMES, type DayOfWeek } from '@/lib/types/availability.types'
import { calculateAdminReservationAmount } from '@/lib/utils/admin-reservation-pricing'
import {
  isSessionDisplaySlot,
  SESSION_SLOT_ID_PREFIX,
} from '@/lib/utils/booked-slot-helpers'

export type ReservationNotificationContext = {
  bookedSlotId: string
  studentId: string
  tutorId: string
  isRecurring: boolean
  weekday: DayOfWeek
  startTime: string
  endTime: string
  studentName: string
  subjectName: string
  levelName: string
  parentEmail: string | null
  parentPhone: string | null
  parentName: string
  tutorName: string
  tutorEmail: string
  tutorPhone: string | null
  nextOccurrenceDate?: string
  hourlyRate?: number | null
}

export type SendAdminReservationNotificationsInput = {
  context: ReservationNotificationContext
  notifyParent: boolean
  parentEmail: boolean
  parentSms: boolean
  notifyTutor: boolean
  tutorEmail: boolean
  tutorSms: boolean
  lessonCount: number
  hourlyRate: number
}

export type NotificationChannelResult = {
  channel: string
  success: boolean
  error?: string
}

export type SendAdminReservationNotificationsResult = {
  success: boolean
  results: NotificationChannelResult[]
  paymentUrl?: string
}

async function assertAdmin() {
  const profile = await getUserProfile()
  if (!profile || profile.role !== 'admin') {
    throw new Error('Brak uprawnień administratora')
  }
  return profile
}

export async function getStudentHourlyRateForAdminReservation(
  studentId: string
): Promise<number | null> {
  await assertAdmin()
  const supabase = await createClient()

  const { data: student } = await supabase
    .from('students')
    .select('hourly_rate')
    .eq('id', studentId)
    .single()

  if (student?.hourly_rate == null) {
    return null
  }

  const rate = parseFloat(student.hourly_rate.toString())
  return Number.isNaN(rate) ? null : rate
}

export async function getAdminReservationPricePreview(
  hourlyRate: number,
  lessonCount: number,
  isRecurring: boolean
): Promise<number> {
  await assertAdmin()
  return calculateAdminReservationAmount(hourlyRate, lessonCount, isRecurring)
}

function buildPeriodLabel(lessonCount: number, isRecurring: boolean): string {
  const lessonWord =
    lessonCount === 1 ? '1 lekcja' : lessonCount < 5 ? `${lessonCount} lekcje` : `${lessonCount} lekcji`
  const typeLabel = isRecurring ? 'cykliczna' : 'jednorazowa'
  return `${lessonWord} (${typeLabel})`
}

function formatReservationDate(context: ReservationNotificationContext): string {
  if (!context.isRecurring && context.nextOccurrenceDate) {
    return format(parseISO(context.nextOccurrenceDate), 'd MMMM yyyy', { locale: pl })
  }
  return DAY_NAMES[context.weekday]
}

export async function sendAdminReservationNotifications(
  input: SendAdminReservationNotificationsInput
): Promise<SendAdminReservationNotificationsResult> {
  await assertAdmin()

  const { context } = input
  const results: NotificationChannelResult[] = []
  let paymentUrl: string | undefined

  const timeRange = `${context.startTime.substring(0, 5)}-${context.endTime.substring(0, 5)}`
  const formattedDate = formatReservationDate(context)
  const periodLabel = buildPeriodLabel(input.lessonCount, context.isRecurring)

  const bookedSlotId = isSessionDisplaySlot(context.bookedSlotId)
    ? undefined
    : context.bookedSlotId
  const tutoringSessionId = isSessionDisplaySlot(context.bookedSlotId)
    ? context.bookedSlotId.slice(SESSION_SLOT_ID_PREFIX.length)
    : undefined

  const needsPayU =
    input.notifyParent && (input.parentEmail || input.parentSms) && !!context.parentEmail

  if (needsPayU) {
    if (!input.hourlyRate || input.hourlyRate <= 0) {
      return {
        success: false,
        results: [
          {
            channel: 'payu',
            success: false,
            error: 'Podaj prawidłową stawkę godzinową',
          },
        ],
      }
    }

    const amount = calculateAdminReservationAmount(
      input.hourlyRate,
      input.lessonCount,
      context.isRecurring
    )

    const payuResult = await createPayUOrderForAdminReservation({
      studentId: context.studentId,
      amount,
      lessonCount: input.lessonCount,
      parentEmail: context.parentEmail!,
      parentName: context.parentName,
      studentName: context.studentName,
      subjectName: context.subjectName,
      levelName: context.levelName,
      tutorName: context.tutorName,
      bookedSlotId,
      tutoringSessionId,
      isRecurring: context.isRecurring,
      formattedDate,
      timeRange,
    })

    if (!payuResult.success || !payuResult.redirectUrl) {
      results.push({
        channel: 'payu',
        success: false,
        error: payuResult.error || 'Nie udało się utworzyć linku PayU',
      })
    } else {
      paymentUrl = payuResult.redirectUrl
      results.push({ channel: 'payu', success: true })

      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()

      if (input.parentEmail && context.parentEmail) {
        const emailResult = await sendPaymentLinkEmail({
          to: context.parentEmail,
          parentName: context.parentName,
          studentName: context.studentName,
          amount,
          month,
          year,
          paymentUrl,
          periodLabel,
        })
        results.push({
          channel: 'parent_email',
          success: emailResult.success,
          error: emailResult.error,
        })
      }

      if (input.parentSms && context.parentPhone) {
        const smsResult = await sendPaymentLinkSms({
          toPhone: context.parentPhone,
          parentName: context.parentName,
          studentName: context.studentName,
          amount,
          month,
          year,
          paymentUrl,
          periodLabel,
        })
        results.push({
          channel: 'parent_sms',
          success: smsResult.success,
          error: smsResult.error,
        })
      }
    }
  } else if (input.notifyParent && (input.parentEmail || input.parentSms)) {
    if (input.parentEmail && !context.parentEmail) {
      results.push({
        channel: 'parent_email',
        success: false,
        error: 'Brak adresu email rodzica',
      })
    }
    if (input.parentSms && !context.parentPhone) {
      results.push({
        channel: 'parent_sms',
        success: false,
        error: 'Brak numeru telefonu rodzica',
      })
    }
  }

  if (input.notifyTutor) {
    if (input.tutorEmail && context.tutorEmail) {
      const emailResult = await sendTutorBookingNotificationEmail({
        to: context.tutorEmail,
        tutorName: context.tutorName,
        studentName: context.studentName,
        subject: context.subjectName,
        level: context.levelName,
        date: formattedDate,
        time: timeRange,
        duration: SLOT_DURATION_MINUTES,
        contactEmail: context.parentEmail || '',
        contactPhone: context.parentPhone,
        source: 'admin',
      })
      results.push({
        channel: 'tutor_email',
        success: emailResult.success,
        error: emailResult.error,
      })
    } else if (input.tutorEmail) {
      results.push({
        channel: 'tutor_email',
        success: false,
        error: 'Brak adresu email tutora',
      })
    }

    if (input.tutorSms && context.tutorPhone) {
      const smsResult = await sendTutorAdminBookingNotificationSms({
        toPhone: context.tutorPhone,
        studentName: context.studentName,
        subject: context.subjectName,
        date: formattedDate,
        time: timeRange.split('-')[0],
      })
      results.push({
        channel: 'tutor_sms',
        success: smsResult.success,
        error: smsResult.error,
      })
    } else if (input.tutorSms) {
      results.push({
        channel: 'tutor_sms',
        success: false,
        error: 'Brak numeru telefonu tutora',
      })
    }
  }

  const attempted = results.filter((r) => r.channel !== 'payu' || results.length === 1)
  const allOk = attempted.every((r) => r.success)

  return {
    success: allOk || attempted.length === 0,
    results,
    paymentUrl,
  }
}

export async function fetchParentInfoForStudent(studentId: string): Promise<{
  parentEmail: string | null
  parentPhone: string | null
  parentName: string
}> {
  await assertAdmin()
  const supabase = await createClient()

  const { data: student } = await supabase
    .from('students')
    .select(`
      parent_email,
      parent_phone,
      student_parents (
        is_primary,
        parents (
          first_name,
          last_name,
          email,
          phone
        )
      )
    `)
    .eq('id', studentId)
    .single()

  if (!student) {
    return { parentEmail: null, parentPhone: null, parentName: 'Rodzic' }
  }

  const parents = student.student_parents ?? []
  const primary = parents.find((p) => p.is_primary) ?? parents[0]
  const parent = primary?.parents
  const parentObj = Array.isArray(parent) ? parent[0] : parent

  if (parentObj) {
    return {
      parentEmail: parentObj.email || student.parent_email || null,
      parentPhone: parentObj.phone || student.parent_phone || null,
      parentName: `${parentObj.first_name} ${parentObj.last_name}`.trim() || 'Rodzic',
    }
  }

  return {
    parentEmail: student.parent_email || null,
    parentPhone: student.parent_phone || null,
    parentName: 'Rodzic',
  }
}
