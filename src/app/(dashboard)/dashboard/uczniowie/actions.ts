'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendGroupMessageEmail } from '@/lib/email/send'
import { linkParentToStudent as linkParentToStudentLib, unlinkParentFromStudent as unlinkParentFromStudentLib, createParent } from '@/lib/actions/parents'

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

  const { data: student, error } = await supabase
    .from('students')
    .insert({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      hourly_rate: data.hourly_rate ?? 50.00,
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
    parent?: {
      first_name: string
      last_name: string
      email: string
      phone: string
    }
  },
  tutorId: string
) {
  const supabase = await createClient()

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

    // Create and link parent if parent data is provided (for existing student)
    if (data.parent && (data.parent.email || data.parent.first_name || data.parent.last_name)) {
      if (!data.parent.email) {
        console.warn('[createStudentWithAssignment] Parent email is required, skipping parent creation')
      } else {
        try {
          const parent = await createParent({
            first_name: data.parent.first_name || 'Rodzic',
            last_name: data.parent.last_name || data.last_name,
            email: data.parent.email,
            phone: data.parent.phone || '',
            parent_type: 'other',
          })

          const linkResult = await linkParentToStudentAction(parent.id, existingStudent.id, true)
          if (!linkResult.success) {
            console.error('[createStudentWithAssignment] Error linking parent to existing student:', linkResult.message)
            // Don't throw - assignment was already created, just log the error
          }
        } catch (error) {
          console.error('[createStudentWithAssignment] Error creating/linking parent for existing student:', error)
          // Don't throw - assignment was already created, just log the error
        }
      }
    }

    revalidatePath('/dashboard/uczniowie')
    return existingStudent
  }

  // Create new student
  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      hourly_rate: data.hourly_rate ?? 50.00,
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

  // Create and link parent if parent data is provided (for new student)
  if (data.parent && (data.parent.email || data.parent.first_name || data.parent.last_name)) {
    if (!data.parent.email) {
      console.warn('[createStudentWithAssignment] Parent email is required, skipping parent creation')
    } else {
      try {
        const parent = await createParent({
          first_name: data.parent.first_name || 'Rodzic',
          last_name: data.parent.last_name || data.last_name,
          email: data.parent.email,
          phone: data.parent.phone || '',
          parent_type: 'other',
        })

        const linkResult = await linkParentToStudentAction(parent.id, student.id, true)
        if (!linkResult.success) {
          console.error('[createStudentWithAssignment] Error linking parent to new student:', linkResult.message)
          // Don't throw - student was already created, just log the error
        }
      } catch (error) {
        console.error('[createStudentWithAssignment] Error creating/linking parent for new student:', error)
        // Don't throw - student was already created, just log the error
        // The error might be that parent already exists, which is fine
      }
    }
  }

  revalidatePath('/dashboard/uczniowie')
  return student
}

export async function updateStudent(
  id: string,
  data: {
    first_name: string
    last_name: string
    hourly_rate?: number
  }
) {
  const supabase = await createClient()

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
  } = {
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
  }

  if (data.hourly_rate !== undefined) {
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
  message: string
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
        email
      )
    `)
    .in('student_id', studentIds)
    .order('is_primary', { ascending: false }) // Główni rodzice najpierw

  if (parentError) {
    console.error('Error fetching parents:', parentError)
    return { success: false, error: 'Nie udało się pobrać danych rodziców' }
  }

  // Zgrupuj uczniów według rodzica
  const parentStudentMap = new Map<string, {
    parentId: string
    parentName: string
    parentEmail: string
    studentNames: string[]
  }>()

  // Utwórz mapę student_id -> student dla szybkiego wyszukiwania
  const studentMap = new Map(students.map(s => [s.id, s]))

  // Utwórz mapę student_id -> lista rodziców z emailami
  const studentParentsMap = new Map<string, Array<{
    id: string
    is_primary: boolean
    parent: {
      id: string
      first_name: string
      last_name: string
      email: string
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
        email: string
      } | null

      if (!parent || !parent.email || !parent.email.trim()) continue

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
        },
      })
    }
  }

  // Dla każdego ucznia wybierz rodzica: najpierw głównego z emailem, jeśli nie ma - pierwszego dostępnego z emailem
  for (const student of students) {
    const parents = studentParentsMap.get(student.id) || []
    
    if (parents.length === 0) continue

    // Najpierw szukaj głównego rodzica z emailem
    let selectedParent = parents.find(p => p.is_primary && p.parent.email && p.parent.email.trim())
    
    // Jeśli nie ma głównego z emailem, użyj pierwszego dostępnego z emailem
    if (!selectedParent) {
      selectedParent = parents.find(p => p.parent.email && p.parent.email.trim())
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
        parentEmail: selectedParent.parent.email,
        studentNames: [studentName],
      })
    }
  }

  // Sprawdź czy są rodzice z emailami
  if (parentStudentMap.size === 0) {
    return { success: false, error: 'Nie znaleziono rodziców z adresami email dla zaznaczonych uczniów' }
  }

  // Wyślij email do każdego rodzica
  let sentCount = 0
  let failedCount = 0
  const errors: string[] = []

  for (const [_, data] of parentStudentMap) {
    const result = await sendGroupMessageEmail({
      to: data.parentEmail,
      parentName: data.parentName,
      studentNames: data.studentNames,
      message: message.trim(),
    })

    if (result.success) {
      sentCount++
    } else {
      failedCount++
      errors.push(`${data.parentName}: ${result.error || 'Nieznany błąd'}`)
    }
  }

  revalidatePath('/dashboard/uczniowie')

  if (failedCount > 0 && sentCount === 0) {
    return {
      success: false,
      error: `Nie udało się wysłać żadnej wiadomości. Błędy: ${errors.join('; ')}`,
      sentCount,
      failedCount,
    }
  }

  if (failedCount > 0) {
    return {
      success: true,
      error: `Wysłano ${sentCount} wiadomości, nie udało się wysłać ${failedCount}. Błędy: ${errors.join('; ')}`,
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
  message: string
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
  return await sendGroupMessage(studentIds, message)
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
        revalidatePath('/dashboard/rodzice')
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
  revalidatePath('/dashboard/rodzice')
}

