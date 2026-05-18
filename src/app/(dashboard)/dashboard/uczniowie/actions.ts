'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendGroupMessageEmail } from '@/lib/email/send'
import type { NotificationChannel } from '@/lib/types/notifications'
import { sendGroupMessageSms } from '@/lib/sms/send'
import { sendWithChannel } from '@/lib/notifications/send-with-channel'
import {
  createBulkSendStats,
  formatBulkSendResultMessage,
  recordBulkSendOutcome,
} from '@/lib/notifications/bulk-send-summary'
import { linkParentToStudent as linkParentToStudentLib, unlinkParentFromStudent as unlinkParentFromStudentLib, createParent } from '@/lib/actions/parents'
import { getDefaultStudentRateForLevel } from '../stawki/actions'
import { getUserProfile } from '@/lib/actions/auth'

const normalizeRateLevel = (level: unknown): 1 | 2 | 3 => {
  const n = typeof level === 'number' ? level : parseInt(String(level ?? ''), 10)
  if (n === 2) return 2
  if (n === 3) return 3
  return 1
}

/**
 * Check if a student with the same first and last name already exists
 */
export async function checkStudentExists(
  first_name: string,
  last_name: string,
  excludeId?: string
): Promise<{ exists: boolean; student?: { id: string; first_name: string; last_name: string } }> {
  const supabase = await createClient()

  let query = supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('first_name', first_name.trim())
    .eq('last_name', last_name.trim())
    .limit(1)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query.single()

  if (error) {
    // If no rows found, student doesn't exist
    if (error.code === 'PGRST116') {
      return { exists: false }
    }
    throw error
  }

  return { exists: true, student: data || undefined }
}

export async function createStudent(
  data: {
    first_name: string
    last_name: string
    hourly_rate?: number
    rate_level?: 1 | 2 | 3
    hourly_rate_is_overridden?: boolean
  },
  parentData?: {
    first_name: string
    last_name: string
    email: string
    phone: string
  }
) {
  const supabase = await createClient()

  // Check if student already exists
  const { exists, student: existingStudent } = await checkStudentExists(
    data.first_name,
    data.last_name
  )

  if (exists && existingStudent) {
    throw new Error(
      `Uczeń o imieniu "${data.first_name} ${data.last_name}" już istnieje w systemie. ` +
      `Jeśli to ta sama osoba, edytuj istniejącego ucznia zamiast tworzyć nowego.`
    )
  }

  const rateLevel = normalizeRateLevel(data.rate_level)
  const wantsOverride = data.hourly_rate_is_overridden === true
  const defaultRate = await getDefaultStudentRateForLevel(rateLevel)
  const hourlyRate =
    wantsOverride && data.hourly_rate !== undefined && !Number.isNaN(data.hourly_rate)
      ? data.hourly_rate
      : defaultRate
  const isOverridden = wantsOverride && hourlyRate !== defaultRate

  const { data: student, error } = await supabase
    .from('students')
    .insert({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      rate_level: rateLevel,
      hourly_rate: hourlyRate,
      hourly_rate_is_overridden: isOverridden,
    })
    .select()
    .single()

  if (error) throw error

  // Create and link parent if parentData is provided
  if (parentData && (parentData.email || parentData.first_name || parentData.last_name)) {
    if (!parentData.email) {
      console.warn('[createStudent] Parent email is required, skipping parent creation')
    } else {
      try {
        const parent = await createParent({
          first_name: parentData.first_name || 'Rodzic',
          last_name: parentData.last_name || data.last_name,
          email: parentData.email,
          phone: parentData.phone || '',
          parent_type: 'other',
        })

        const linkResult = await linkParentToStudentAction(parent.id, student.id, true)
        if (!linkResult.success) {
          console.error('[createStudent] Error linking parent to student:', linkResult.message)
          // Don't throw - student was already created, just log the error
        }
      } catch (error) {
        console.error('[createStudent] Error creating/linking parent:', error)
        // Don't throw - student was already created, just log the error
        // The error might be that parent already exists, which is fine
      }
    }
  }

  revalidatePath('/dashboard/uczniowie')
  return student
}

export async function createStudentWithAssignment(
  data: {
    first_name: string
    last_name: string
    subject_level_id: string
    hourly_rate?: number
    rate_level?: 1 | 2 | 3
    hourly_rate_is_overridden?: boolean
  },
  tutorId: string
) {
  const supabase = await createClient()

  const profile = await getUserProfile()
  if (!profile || profile.id !== tutorId) {
    throw new Error('Brak uprawnień do dodawania ucznia w tej roli.')
  }

  // Stawki ustawia wyłącznie system (domyślny poziom 1) — ignorujemy pola z klienta
  const tutorRateLevel = 1 as const
  const tutorDefaultHourly = await getDefaultStudentRateForLevel(tutorRateLevel)

  // Check if student already exists
  const { exists, student: existingStudent } = await checkStudentExists(
    data.first_name,
    data.last_name
  )

  if (exists && existingStudent) {
    // If student exists, use existing student instead of creating new one
    // Check if assignment already exists
    const { data: level } = await supabase
      .from('subject_levels')
      .select('subject_id')
      .eq('id', data.subject_level_id)
      .single()

    if (!level) throw new Error('Subject level not found')

    // Check if assignment already exists
    const { data: existingAssignment } = await supabase
      .from('student_assignments')
      .select('id')
      .eq('student_id', existingStudent.id)
      .eq('tutor_id', tutorId)
      .eq('subject_id', level.subject_id)
      .eq('subject_level_id', data.subject_level_id)
      .eq('status', 'active')
      .single()

    if (existingAssignment) {
      throw new Error(
        `Uczeń "${data.first_name} ${data.last_name}" już istnieje i ma aktywne przypisanie do tego tutora i przedmiotu.`
      )
    }

    // Create assignment for existing student
    const { error: assignmentError } = await supabase
      .from('student_assignments')
      .insert({
        student_id: existingStudent.id,
        tutor_id: tutorId,
        subject_id: level.subject_id,
        subject_level_id: data.subject_level_id,
        assigned_by: tutorId,
        status: 'active',
      })

    if (assignmentError) throw assignmentError

    // Create student_subject entry if not exists
    const { data: existingSubject } = await supabase
      .from('student_subjects')
      .select('id')
      .eq('student_id', existingStudent.id)
      .eq('subject_id', level.subject_id)
      .eq('subject_level_id', data.subject_level_id)
      .single()

    if (!existingSubject) {
      await supabase
        .from('student_subjects')
        .insert({
          student_id: existingStudent.id,
          subject_id: level.subject_id,
          subject_level_id: data.subject_level_id,
        })
    }

    revalidatePath('/dashboard/uczniowie')
    return existingStudent
  }

  // Create new student — stawki wyłącznie z ustawień systemu (tutor nie konfiguruje stawek)
  const rateLevel = tutorRateLevel
  const hourlyRate = tutorDefaultHourly
  const isOverridden = false

  // Create new student
  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      rate_level: rateLevel,
      hourly_rate: hourlyRate,
      hourly_rate_is_overridden: isOverridden,
    })
    .select()
    .single()

  if (studentError) throw studentError

  // Get subject_id from level
  const { data: level } = await supabase
    .from('subject_levels')
    .select('subject_id')
    .eq('id', data.subject_level_id)
    .single()

  if (!level) throw new Error('Subject level not found')

  // Create assignment
  const { error: assignmentError } = await supabase
    .from('student_assignments')
    .insert({
      student_id: student.id,
      tutor_id: tutorId,
      subject_id: level.subject_id,
      subject_level_id: data.subject_level_id,
      assigned_by: tutorId,
      status: 'active',
    })

  if (assignmentError) throw assignmentError

  // Create student_subject entry
  await supabase
    .from('student_subjects')
    .insert({
      student_id: student.id,
      subject_id: level.subject_id,
      subject_level_id: data.subject_level_id,
    })

  revalidatePath('/dashboard/uczniowie')
  return student
}

export async function updateStudent(
  id: string,
  data: {
    first_name: string
    last_name: string
    hourly_rate?: number
    rate_level?: 1 | 2 | 3
    hourly_rate_is_overridden?: boolean
  }
) {
  const supabase = await createClient()
  const profile = await getUserProfile()

  // Tutor może zmieniać wyłącznie imię i nazwisko — bez stawek
  if (profile?.role === 'tutor') {
    const { exists, student: existingStudent } = await checkStudentExists(
      data.first_name,
      data.last_name,
      id
    )

    if (exists && existingStudent) {
      throw new Error(
        `Uczeń o imieniu "${data.first_name} ${data.last_name}" już istnieje w systemie. ` +
          `Nie można zmienić nazwy na istniejącą.`
      )
    }

    const { error } = await supabase
      .from('students')
      .update({
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
      })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/dashboard/uczniowie')
    return
  }

  // Check if another student with the same name exists (excluding current student)
  const { exists, student: existingStudent } = await checkStudentExists(
    data.first_name,
    data.last_name,
    id
  )

  if (exists && existingStudent) {
    throw new Error(
      `Uczeń o imieniu "${data.first_name} ${data.last_name}" już istnieje w systemie. ` +
      `Nie można zmienić nazwy na istniejącą.`
    )
  }

  const updateData: {
    first_name: string
    last_name: string
    hourly_rate?: number
    rate_level?: 1 | 2 | 3
    hourly_rate_is_overridden?: boolean
  } = {
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
  }

  if (data.rate_level !== undefined) {
    updateData.rate_level = normalizeRateLevel(data.rate_level)
  }

  if (data.hourly_rate_is_overridden !== undefined) {
    const wantsOverride = data.hourly_rate_is_overridden === true
    const levelForDefault = normalizeRateLevel(data.rate_level ?? 1)
    const defaultRate = await getDefaultStudentRateForLevel(levelForDefault)

    if (wantsOverride) {
      updateData.hourly_rate_is_overridden = true
      if (data.hourly_rate !== undefined) {
        updateData.hourly_rate = data.hourly_rate
      }
    } else {
      updateData.hourly_rate_is_overridden = false
      updateData.hourly_rate = defaultRate
    }
  } else if (data.hourly_rate !== undefined) {
    // Backward compatibility: if old callers still pass hourly_rate only
    updateData.hourly_rate = data.hourly_rate
  }

  const { error } = await supabase
    .from('students')
    .update(updateData)
    .eq('id', id)

  if (error) throw error

  revalidatePath('/dashboard/uczniowie')
}

export async function updateStudentSubjects(
  studentId: string,
  subjectLevelIds: string[]
) {
  const supabase = await createClient()

  // Delete existing
  await supabase
    .from('student_subjects')
    .delete()
    .eq('student_id', studentId)

  if (subjectLevelIds.length === 0) return

  // Get subject_id for each level
  const { data: levels } = await supabase
    .from('subject_levels')
    .select('id, subject_id')
    .in('id', subjectLevelIds)

  if (!levels) return

  // Insert new
  const inserts = levels.map(level => ({
    student_id: studentId,
    subject_id: level.subject_id,
    subject_level_id: level.id,
  }))

  const { error } = await supabase
    .from('student_subjects')
    .insert(inserts)

  if (error) throw error

  revalidatePath('/dashboard/uczniowie')
}

export async function deleteStudent(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('students').delete().eq('id', id)

  if (error) throw error

  revalidatePath('/dashboard/uczniowie')
}

export async function sendGroupMessage(
  selectedStudentIds: string[],
  message: string,
  channel: NotificationChannel = 'email'
): Promise<{ success: boolean; error?: string; sentCount?: number; failedCount?: number }> {
  const supabase = await createClient()

  if (!selectedStudentIds || selectedStudentIds.length === 0) {
    return { success: false, error: 'Nie wybrano uczniów' }
  }

  if (!message || !message.trim()) {
    return { success: false, error: 'Treść wiadomości nie może być pusta' }
  }

  // Najpierw pobierz uczniów
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select(`
      id,
      first_name,
      last_name
    `)
    .in('id', selectedStudentIds)

  if (studentsError) {
    console.error('Error fetching students:', studentsError)
    return { success: false, error: 'Nie udało się pobrać danych uczniów' }
  }

  if (!students || students.length === 0) {
    return { success: false, error: 'Nie znaleziono zaznaczonych uczniów' }
  }

  const studentIds = students.map(s => s.id)

  // Pobierz wszystkich rodziców dla tych uczniów (nie tylko głównych)
  const { data: parentData, error: parentError } = await supabase
    .from('student_parents')
    .select(`
      student_id,
      is_primary,
      parents (
        id,
        first_name,
        last_name,
        email,
        phone
      )
    `)
    .in('student_id', studentIds)
    .order('is_primary', { ascending: false }) // Główni rodzice najpierw

  if (parentError) {
    console.error('Error fetching parents:', parentError)
    return { success: false, error: 'Nie udało się pobrać danych rodziców' }
  }

  // Zgrupuj uczniów według rodzica
  const parentStudentMap = new Map<
    string,
    {
      parentId: string
      parentName: string
      parentEmail: string | null
      parentPhone: string | null
      studentNames: string[]
    }
  >()

  // Utwórz mapę student_id -> student dla szybkiego wyszukiwania
  const studentMap = new Map(students.map(s => [s.id, s]))

  // Utwórz mapę student_id -> lista rodziców z danymi kontaktowymi
  const studentParentsMap = new Map<string, Array<{
    id: string
    is_primary: boolean
    parent: {
      id: string
      first_name: string
      last_name: string
      email: string | null
      phone: string | null
    }
  }>>()

  // Przetwórz dane rodziców - zgrupuj według student_id
  if (parentData) {
    for (const sp of parentData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parent = (sp as any).parents as {
        id: string
        first_name: string
        last_name: string
        email: string | null
        phone: string | null
      } | null

      if (!parent) continue

      if (!studentParentsMap.has(sp.student_id)) {
        studentParentsMap.set(sp.student_id, [])
      }

      studentParentsMap.get(sp.student_id)!.push({
        id: sp.student_id,
        is_primary: sp.is_primary,
        parent: {
          id: parent.id,
          first_name: parent.first_name,
          last_name: parent.last_name,
            email: parent.email,
            phone: parent.phone,
        },
      })
    }
  }

  // Dla każdego ucznia wybierz rodzica: najpierw głównego z kontaktem, jeśli nie ma - pierwszego dostępnego
  for (const student of students) {
    const parents = studentParentsMap.get(student.id) || []

    if (parents.length === 0) continue

    // Najpierw szukaj głównego rodzica z emailem lub telefonem
    let selectedParent = parents.find(
      (p) =>
        p.is_primary &&
        ((p.parent.email && p.parent.email.trim()) ||
          (p.parent.phone && p.parent.phone.trim()))
    )

    // Jeśli nie ma głównego z danymi kontaktowymi, użyj pierwszego dostępnego
    if (!selectedParent) {
      selectedParent = parents.find(
        (p) =>
          (p.parent.email && p.parent.email.trim()) ||
          (p.parent.phone && p.parent.phone.trim())
      )
    }

    if (!selectedParent) continue

    const studentName = `${student.first_name} ${student.last_name}`
    const parentKey = selectedParent.parent.id

    if (parentStudentMap.has(parentKey)) {
      const existing = parentStudentMap.get(parentKey)!
      existing.studentNames.push(studentName)
    } else {
      parentStudentMap.set(parentKey, {
        parentId: selectedParent.parent.id,
        parentName: `${selectedParent.parent.first_name} ${selectedParent.parent.last_name}`,
        parentEmail: selectedParent.parent.email || null,
        parentPhone: selectedParent.parent.phone || null,
        studentNames: [studentName],
      })
    }
  }

  // Sprawdź czy są rodzice z co najmniej jednym kanałem kontaktu
  if (parentStudentMap.size === 0) {
    return {
      success: false,
      error:
        'Nie znaleziono rodziców z danymi kontaktowymi (email/telefon) dla zaznaczonych uczniów',
    }
  }

  // Wyślij wiadomość do każdego rodzica według wybranego kanału
  let sentCount = 0
  let failedCount = 0
  const bulkStats = createBulkSendStats()

  // URL aplikacji do budowy absolutnego linku do obrazka
  let appUrl = 'http://localhost:3000'
  if (process.env.NEXT_PUBLIC_APP_URL) {
    appUrl = process.env.NEXT_PUBLIC_APP_URL
  } else if (process.env.VERCEL_URL) {
    appUrl = `https://${process.env.VERCEL_URL}`
  }
  const headerImageUrl = `${appUrl}/akademia_wiedzy.png`

  for (const [_, data] of parentStudentMap) {
    const hasEmail = !!(data.parentEmail && data.parentEmail.trim())
    const hasPhone = !!(data.parentPhone && data.parentPhone.trim())

    const result = await sendWithChannel(channel, {
      sendEmail:
        hasEmail && (channel === 'email' || channel === 'both')
          ? () =>
              sendGroupMessageEmail({
                to: data.parentEmail as string,
                parentName: data.parentName,
                studentNames: data.studentNames,
                message: message.trim(),
                headerImageUrl,
              })
          : undefined,
      sendSms:
        hasPhone && (channel === 'sms' || channel === 'both')
          ? () =>
              sendGroupMessageSms({
                toPhone: data.parentPhone as string,
                parentName: data.parentName,
                studentNames: data.studentNames,
                message: message.trim(),
              })
          : undefined,
    })

    if (result.success) {
      sentCount++
      recordBulkSendOutcome(bulkStats, {
        success: true,
        channel,
        hasEmail,
        hasPhone,
        details: result.details,
      })
    } else {
      failedCount++
      recordBulkSendOutcome(bulkStats, {
        success: false,
        channel,
        hasEmail,
        hasPhone,
        details: result.details,
      })
    }
  }

  revalidatePath('/dashboard/uczniowie')

  const summaryMessage = formatBulkSendResultMessage(sentCount, bulkStats)

  if (failedCount > 0 && sentCount === 0) {
    return {
      success: false,
      error: summaryMessage ?? 'Nie udało się wysłać żadnej wiadomości.',
      sentCount,
      failedCount,
    }
  }

  if (summaryMessage) {
    return {
      success: true,
      error: summaryMessage,
      sentCount,
      failedCount,
    }
  }

  return {
    success: true,
    sentCount,
    failedCount: 0,
  }
}

/**
 * Wysyła wiadomość grupową do wszystkich uczniów przypisanych do tutora
 * Funkcja dla tutorów - wysyła do wszystkich swoich uczniów bez zaznaczania
 */
export async function sendGroupMessageToAllMyStudents(
  tutorId: string,
  message: string,
  channel: NotificationChannel = 'email'
): Promise<{ success: boolean; error?: string; sentCount?: number; failedCount?: number }> {
  const supabase = await createClient()

  if (!message || !message.trim()) {
    return { success: false, error: 'Treść wiadomości nie może być pusta' }
  }

  // Pobierz wszystkich aktywnych uczniów przypisanych do tutora
  const { data: assignments, error: assignmentsError } = await supabase
    .from('student_assignments')
    .select('student_id')
    .eq('tutor_id', tutorId)
    .eq('status', 'active')

  if (assignmentsError) {
    console.error('Error fetching assignments:', assignmentsError)
    return { success: false, error: 'Nie udało się pobrać przypisań uczniów' }
  }

  if (!assignments || assignments.length === 0) {
    return { success: false, error: 'Nie masz przypisanych aktywnych uczniów' }
  }

  const studentIds = assignments.map(a => a.student_id)

  // Użyj istniejącej funkcji sendGroupMessage
  return await sendGroupMessage(studentIds, message, channel)
}

/**
 * Link parent to student - wrapper action
 */
export async function linkParentToStudentAction(
  parentId: string,
  studentId: string,
  isPrimary: boolean = false
): Promise<{ success: boolean; message?: string }> {
  // Validate inputs
  if (!parentId || typeof parentId !== 'string' || parentId.trim() === '') {
    return { success: false, message: 'Nieprawidłowy ID rodzica' }
  }
  if (!studentId || typeof studentId !== 'string' || studentId.trim() === '') {
    return { success: false, message: 'Nieprawidłowy ID ucznia' }
  }
  
  try {
    console.log('[linkParentToStudentAction] Starting with params:', { parentId, studentId, isPrimary })
    
    let result: { success: boolean; message?: string }
    try {
      result = await linkParentToStudentLib(parentId.trim(), studentId.trim(), Boolean(isPrimary))
    } catch (innerError) {
      console.error('[linkParentToStudentAction] Error calling linkParentToStudentLib:', innerError)
      const errorMessage = innerError instanceof Error 
        ? innerError.message 
        : 'Błąd podczas wywoływania funkcji linkowania'
      return { success: false, message: errorMessage }
    }
    
    console.log('[linkParentToStudentAction] Result:', result)
    
    // Ensure we always return a valid object with consistent structure
    if (!result || typeof result !== 'object' || typeof result.success !== 'boolean') {
      console.error('[linkParentToStudentAction] Invalid result format:', result)
      return { success: false, message: 'Nieprawidłowa odpowiedź z serwera' }
    }
    
    // Revalidate paths only on success
    if (result.success === true) {
      try {
        revalidatePath('/dashboard/uczniowie')
      } catch (revalidateError) {
        // Log but don't fail if revalidation fails
        console.error('[linkParentToStudentAction] Error revalidating paths:', revalidateError)
      }
    }
    
    // Ensure consistent return format - don't include message if it's undefined
    // Use JSON.parse/stringify to ensure proper serialization
    const response: { success: boolean; message?: string } = {
      success: result.success,
    }
    if (result.message) {
      response.message = result.message
    }
    
    // Ensure proper serialization for Next.js server actions
    try {
      return JSON.parse(JSON.stringify(response))
    } catch (serializationError) {
      console.error('[linkParentToStudentAction] Serialization error:', serializationError)
      // Fallback to basic object if serialization fails
      return { success: response.success, ...(response.message ? { message: String(response.message) } : {}) }
    }
  } catch (error) {
    // Catch any unexpected errors and return a proper response
    // Handle empty object errors (serialization issues)
    const isEmptyObject = error && typeof error === 'object' && Object.keys(error).length === 0
    
    console.error('[linkParentToStudentAction] Unexpected error:', {
      error,
      isEmptyObject,
      errorType: typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    
    let errorMessage = 'Nieoczekiwany błąd podczas przypisywania rodzica'
    
    if (isEmptyObject) {
      errorMessage = 'Błąd serializacji odpowiedzi. Sprawdź logi serwera dla szczegółów.'
    } else if (error instanceof Error) {
      errorMessage = error.message || errorMessage
    } else if (typeof error === 'string') {
      errorMessage = error
    } else if (error && typeof error === 'object') {
      try {
        const errorObj = error as Record<string, unknown>
        if (errorObj.message && typeof errorObj.message === 'string') {
          errorMessage = errorObj.message
        } else {
          errorMessage = JSON.stringify(errorObj)
        }
      } catch {
        errorMessage = 'Nieznany błąd podczas przypisywania rodzica'
      }
    }
    
    // Always return a valid object - never throw
    // Ensure proper serialization for Next.js server actions
    try {
      return JSON.parse(JSON.stringify({ success: false, message: errorMessage }))
    } catch (serializationError) {
      console.error('[linkParentToStudentAction] Serialization error in catch:', serializationError)
      // Fallback to basic object if serialization fails
      return { success: false, message: String(errorMessage) }
    }
  }
}

/**
 * Unlink parent from student - wrapper action
 */
export async function unlinkParentFromStudentAction(
  parentId: string,
  studentId: string
): Promise<void> {
  await unlinkParentFromStudentLib(parentId, studentId)
  revalidatePath('/dashboard/uczniowie')
}

export async function createParentAndLinkToStudentAction(
  studentId: string,
  parentData: {
    first_name: string
    last_name: string
    email: string
    phone: string
    parent_type?: 'mother' | 'father' | 'legal_guardian' | 'other'
  },
  isPrimary: boolean = false
): Promise<{ success: boolean; message?: string }> {
  if (!studentId || typeof studentId !== 'string' || studentId.trim() === '') {
    return { success: false, message: 'Nieprawidłowy ID ucznia' }
  }
  if (!parentData?.email || typeof parentData.email !== 'string' || parentData.email.trim() === '') {
    return { success: false, message: 'Email rodzica jest wymagany' }
  }

  try {
    const parent = await createParent({
      first_name: (parentData.first_name || 'Rodzic').trim(),
      last_name: (parentData.last_name || '').trim() || '—',
      email: parentData.email.trim(),
      phone: (parentData.phone || '').trim(),
      parent_type: parentData.parent_type || 'other',
    })

    const linkResult = await linkParentToStudentAction(parent.id, studentId.trim(), Boolean(isPrimary))
    if (!linkResult.success) {
      return { success: false, message: linkResult.message || 'Nie udało się przypisać rodzica do ucznia' }
    }

    try {
      revalidatePath('/dashboard/uczniowie')
    } catch (e) {
      console.error('[createParentAndLinkToStudentAction] revalidatePath error:', e)
    }

    return JSON.parse(JSON.stringify({ success: true }))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return JSON.parse(JSON.stringify({ success: false, message: msg || 'Nie udało się utworzyć i przypisać rodzica' }))
  }
}

export async function getAllParentsForSelectAction(): Promise<
  Array<{ id: string; first_name: string; last_name: string; email: string; phone: string | null; parent_type: string }>
> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('parents').select('id, first_name, last_name, email, phone, parent_type').order('last_name')
  if (error) throw error
  return (data || []) as Array<{ id: string; first_name: string; last_name: string; email: string; phone: string | null; parent_type: string }>
}

export async function getAllSubjectsWithLevelsAction(): Promise<
  Array<{
    id: string
    name: string
    color?: string | null
    subject_levels: Array<{ id: string; level_name: string; level_order: number; price_per_hour: number }>
  }>
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('subjects')
    .select(
      `
        id,
        name,
        color,
        subject_levels (
          id,
          level_name,
          level_order,
          price_per_hour
        )
      `
    )
    .order('name')

  if (error) throw error
  return (data || []) as Array<{
    id: string
    name: string
    color?: string | null
    subject_levels: Array<{ id: string; level_name: string; level_order: number; price_per_hour: number }>
  }>
}

export async function mergeStudentsAction(
  primaryStudentId: string,
  duplicateStudentId: string
): Promise<{ success: boolean; message?: string }> {
  const profile = await getUserProfile()
  if (!profile || profile.role !== 'admin') {
    return { success: false, message: 'Brak uprawnień (tylko admin)' }
  }

  if (!primaryStudentId || !duplicateStudentId) {
    return { success: false, message: 'Brakuje ID uczniów do scalenia' }
  }
  if (primaryStudentId === duplicateStudentId) {
    return { success: false, message: 'Nie można scalić ucznia z samym sobą' }
  }

  const supabase = await createClient()

  try {
    // Ensure both students exist
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .in('id', [primaryStudentId, duplicateStudentId])

    if (studentsError) throw studentsError
    if (!students || students.length !== 2) {
      return { success: false, message: 'Nie znaleziono obu uczniów w bazie' }
    }

    // 1) Link parents: insert missing relationships, then delete duplicate rows
    const { data: dupParents } = await supabase
      .from('student_parents')
      .select('parent_id, is_primary')
      .eq('student_id', duplicateStudentId)

    if (dupParents && dupParents.length > 0) {
      const upserts = dupParents.map((sp) => ({
        student_id: primaryStudentId,
        parent_id: sp.parent_id,
        is_primary: Boolean(sp.is_primary),
      }))
      // Unique(student_id, parent_id)
      await supabase
        .from('student_parents')
        .upsert(upserts, { onConflict: 'student_id,parent_id' })

      await supabase
        .from('student_parents')
        .delete()
        .eq('student_id', duplicateStudentId)
    }

    // 2) Subjects: insert missing, then delete duplicate rows
    const { data: dupSubjects } = await supabase
      .from('student_subjects')
      .select('subject_id, subject_level_id')
      .eq('student_id', duplicateStudentId)

    if (dupSubjects && dupSubjects.length > 0) {
      const upserts = dupSubjects.map((ss) => ({
        student_id: primaryStudentId,
        subject_id: ss.subject_id,
        subject_level_id: ss.subject_level_id,
      }))
      // Unique(student_id, subject_level_id)
      await supabase
        .from('student_subjects')
        .upsert(upserts, { onConflict: 'student_id,subject_level_id' })

      await supabase
        .from('student_subjects')
        .delete()
        .eq('student_id', duplicateStudentId)
    }

    // 3) Simple FK reassignments (no unique constraints)
    const fkTables: Array<{ table: string; column?: string }> = [
      { table: 'student_assignments' },
      { table: 'tutoring_sessions' },
      { table: 'student_notes' },
      { table: 'monthly_report_entries' },
      { table: 'payments' },
      { table: 'payment_reminders' },
      { table: 'monthly_declaration_entries' },
      { table: 'public_booking_requests' }, // nullable in schema, but safe to update
      { table: 'payu_payments' },
    ]

    for (const t of fkTables) {
      const { error } = await supabase
        .from(t.table)
        .update({ student_id: primaryStudentId })
        .eq('student_id', duplicateStudentId)
      if (error) {
        // Some installs might not have all tables; skip only if table missing
        if (String(error.message || '').toLowerCase().includes('does not exist')) continue
        throw error
      }
    }

    // 4) Merge student_billings (unique per period)
    const { data: dupBillings, error: dupBillingsError } = await supabase
      .from('student_billings')
      .select('id, billing_period_id, total_due, total_paid')
      .eq('student_id', duplicateStudentId)
    if (dupBillingsError) throw dupBillingsError

    for (const b of dupBillings || []) {
      const { data: primaryBilling } = await supabase
        .from('student_billings')
        .select('id, total_due, total_paid')
        .eq('student_id', primaryStudentId)
        .eq('billing_period_id', b.billing_period_id)
        .maybeSingle()

      if (!primaryBilling) {
        const { error } = await supabase
          .from('student_billings')
          .update({ student_id: primaryStudentId })
          .eq('id', b.id)
        if (error) throw error
      } else {
        const totalDue = Number(primaryBilling.total_due || 0) + Number(b.total_due || 0)
        const totalPaid = Number(primaryBilling.total_paid || 0) + Number(b.total_paid || 0)
        const balance = totalDue - totalPaid
        const status = balance <= 0 ? 'paid' : totalPaid > 0 ? 'partially_paid' : 'unpaid'

        const { error: updErr } = await supabase
          .from('student_billings')
          .update({
            total_due: totalDue,
            total_paid: totalPaid,
            balance,
            status,
          })
          .eq('id', primaryBilling.id)
        if (updErr) throw updErr

        // delete duplicate billing row
        const { error: delErr } = await supabase
          .from('student_billings')
          .delete()
          .eq('id', b.id)
        if (delErr) throw delErr
      }
    }

    // 5) Merge declaration_billings (unique per period)
    const { data: dupDeclBillings, error: dupDeclErr } = await supabase
      .from('declaration_billings')
      .select('id, billing_period_id, declaration_hours')
      .eq('student_id', duplicateStudentId)
    if (dupDeclErr) throw dupDeclErr

    for (const db of dupDeclBillings || []) {
      const { data: primaryDb } = await supabase
        .from('declaration_billings')
        .select('id, declaration_hours')
        .eq('student_id', primaryStudentId)
        .eq('billing_period_id', db.billing_period_id)
        .maybeSingle()

      if (!primaryDb) {
        const { error } = await supabase
          .from('declaration_billings')
          .update({ student_id: primaryStudentId })
          .eq('id', db.id)
        if (error) throw error
      } else {
        const hours = Number(primaryDb.declaration_hours || 0) + Number(db.declaration_hours || 0)
        const { error: updErr } = await supabase
          .from('declaration_billings')
          .update({ declaration_hours: hours })
          .eq('id', primaryDb.id)
        if (updErr) throw updErr

        const { error: delErr } = await supabase
          .from('declaration_billings')
          .delete()
          .eq('id', db.id)
        if (delErr) throw delErr
      }
    }

    // 6) Finally delete duplicate student
    const { error: deleteErr } = await supabase
      .from('students')
      .delete()
      .eq('id', duplicateStudentId)
    if (deleteErr) throw deleteErr

    revalidatePath('/dashboard/uczniowie')
    revalidatePath('/dashboard/payments')
    revalidatePath('/dashboard/billing')
    revalidatePath('/dashboard/rozliczenia-deklaracji')

    return { success: true }
  } catch (error) {
    console.error('[mergeStudentsAction] Error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Get full student data with all relations
 */
export async function getStudentWithRelations(studentId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('students')
    .select(`
      *,
      student_parents (
        id,
        is_primary,
        parents (
          id,
          first_name,
          last_name,
          email,
          phone,
          parent_type
        )
      ),
      student_notes (
        id,
        content,
        created_at,
        profiles (
          id,
          full_name
        )
      ),
      student_subjects (
        subject_level_id,
        subjects (
          name,
          color
        ),
        subject_levels (
          level_name
        )
      ),
      student_assignments (
        id,
        tutor_id,
        status,
        profiles!student_assignments_tutor_id_fkey (
          id,
          full_name,
          email
        ),
        subjects (
          id,
          name
        ),
        subject_levels (
          id,
          level_name
        )
      )
    `)
    .eq('id', studentId)
    .single()

  if (error) throw error
  
  return data
}