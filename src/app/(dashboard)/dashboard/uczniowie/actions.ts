'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createStudent(data: {
  first_name: string
  last_name: string
}) {
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

