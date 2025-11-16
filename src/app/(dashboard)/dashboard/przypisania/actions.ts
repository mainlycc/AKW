'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/actions/notifications'

export async function createAssignment(data: {
  student_id: string
  tutor_id: string
  subject_id: string
  subject_level_id: string
  assigned_by: string
}) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { error } = await supabase.from('student_assignments').insert({
    student_id: data.student_id,
    tutor_id: data.tutor_id,
    subject_id: data.subject_id,
    subject_level_id: data.subject_level_id,
    assigned_by: data.assigned_by,
    status: 'active',
  })

  if (error) {
    throw error
  }

  // Powiadomienie dla tutora o nowym przypisaniu
  try {
    const [studentData, subjectData, levelData] = await Promise.all([
      admin
        .from('students')
        .select('first_name, last_name')
        .eq('id', data.student_id)
        .single(),
      admin
        .from('subjects')
        .select('name')
        .eq('id', data.subject_id)
        .single(),
      admin
        .from('subject_levels')
        .select('level_name')
        .eq('id', data.subject_level_id)
        .single(),
    ])

    if (studentData.data && subjectData.data && levelData.data) {
      const studentName = `${studentData.data.first_name} ${studentData.data.last_name}`
      await createNotification({
        userId: data.tutor_id,
        type: 'assignment_created',
        title: 'Nowe przypisanie ucznia',
        message: `Przypisano Ci ucznia ${studentName} do przedmiotu ${subjectData.data.name} (${levelData.data.level_name})`,
        metadata: {
          student_id: data.student_id,
          student_name: studentName,
          subject_id: data.subject_id,
          subject_name: subjectData.data.name,
          subject_level_id: data.subject_level_id,
          level_name: levelData.data.level_name,
        },
      })
    }
  } catch (notificationError) {
    // Logujemy błąd, ale nie przerywamy procesu
    console.error('Failed to create notification:', notificationError)
  }

  revalidatePath('/dashboard/przypisania')
}

export async function updateAssignmentStatus(
  id: string,
  status: 'active' | 'completed' | 'cancelled'
) {
  const supabase = await createClient()
  const admin = createAdminClient()

  // Pobierz dane przypisania przed aktualizacją
  const { data: assignment } = await supabase
    .from('student_assignments')
    .select('tutor_id, student_id, subject_id, subject_level_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('student_assignments')
    .update({ status })
    .eq('id', id)

  if (error) {
    throw error
  }

  // Powiadomienie dla tutora o zmianie statusu
  try {
    if (assignment?.tutor_id) {
      const [studentData, subjectData, levelData] = await Promise.all([
        assignment.student_id
          ? admin
              .from('students')
              .select('first_name, last_name')
              .eq('id', assignment.student_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        assignment.subject_id
          ? admin
              .from('subjects')
              .select('name')
              .eq('id', assignment.subject_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        assignment.subject_level_id
          ? admin
              .from('subject_levels')
              .select('level_name')
              .eq('id', assignment.subject_level_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      const studentName = studentData.data
        ? `${studentData.data.first_name} ${studentData.data.last_name}`
        : 'Uczeń'
      const subjectLabel = subjectData.data?.name
        ? `${subjectData.data.name}${levelData.data?.level_name ? ` (${levelData.data.level_name})` : ''}`
        : ''

      let title = ''
      let message = ''

      if (status === 'completed') {
        title = 'Przypisanie zakończone'
        message = `Przypisanie dla ${studentName}${subjectLabel ? ` - ${subjectLabel}` : ''} zostało zakończone.`
      } else if (status === 'cancelled') {
        title = 'Przypisanie anulowane'
        message = `Przypisanie dla ${studentName}${subjectLabel ? ` - ${subjectLabel}` : ''} zostało anulowane.`
      } else if (status === 'active') {
        title = 'Przypisanie aktywowane'
        message = `Przypisanie dla ${studentName}${subjectLabel ? ` - ${subjectLabel}` : ''} zostało aktywowane.`
      }

      if (title && message) {
        await createNotification({
          userId: assignment.tutor_id,
          type: 'assignment_status_changed',
          title,
          message,
          metadata: {
            assignment_id: id,
            student_id: assignment.student_id,
            student_name: studentName,
            status,
            subject_id: assignment.subject_id,
            subject_level_id: assignment.subject_level_id,
          },
        })
      }
    }
  } catch (notificationError) {
    // Logujemy błąd, ale nie przerywamy procesu
    console.error('Failed to create notification:', notificationError)
  }

  revalidatePath('/dashboard/przypisania')
}

