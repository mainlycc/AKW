'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendGroupMessageEmail } from '@/lib/email/send'

export async function createStudent(
  data: {
    first_name: string
    last_name: string
  },
  parentData?: {
    first_name: string
    last_name: string
    email: string
    phone: string
  }
) {
  const supabase = await createClient()

  const { data: student, error } = await supabase
    .from('students')
    .insert({
      first_name: data.first_name,
      last_name: data.last_name,
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath('/dashboard/uczniowie')
  return student
}

export async function createStudentWithAssignment(
  data: {
    first_name: string
    last_name: string
    subject_level_id: string
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

  // Create student
  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({
      first_name: data.first_name,
      last_name: data.last_name,
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
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('students')
    .update({
      first_name: data.first_name,
      last_name: data.last_name,
    })
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

  // Pobierz uczniów z głównymi rodzicami
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select(`
      id,
      first_name,
      last_name,
      student_parents!inner (
        id,
        is_primary,
        parents (
          id,
          first_name,
          last_name,
          email
        )
      )
    `)
    .in('id', selectedStudentIds)
    .eq('student_parents.is_primary', true)

  if (studentsError) {
    console.error('Error fetching students:', studentsError)
    return { success: false, error: 'Nie udało się pobrać danych uczniów' }
  }

  if (!students || students.length === 0) {
    return { success: false, error: 'Nie znaleziono uczniów z przypisanymi głównymi rodzicami' }
  }

  // Zgrupuj uczniów według rodzica
  const parentStudentMap = new Map<string, {
    parentId: string
    parentName: string
    parentEmail: string
    studentNames: string[]
  }>()

  for (const student of students) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentParents = (student as any).student_parents as Array<{
      id: string
      is_primary: boolean
      parents: {
        id: string
        first_name: string
        last_name: string
        email: string
      } | null
    }> | null | undefined

    if (!studentParents || studentParents.length === 0) continue

    const primaryParent = studentParents.find(sp => sp?.is_primary && sp?.parents)
    if (!primaryParent || !primaryParent.parents) continue

    const parent = primaryParent.parents
    if (!parent || !parent.email || !parent.email.trim()) continue

    const studentName = `${student.first_name} ${student.last_name}`
    const parentKey = parent.id

    if (parentStudentMap.has(parentKey)) {
      const existing = parentStudentMap.get(parentKey)!
      existing.studentNames.push(studentName)
    } else {
      parentStudentMap.set(parentKey, {
        parentId: parent.id,
        parentName: `${parent.first_name} ${parent.last_name}`,
        parentEmail: parent.email,
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

