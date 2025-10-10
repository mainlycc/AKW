'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function getStudentNotes(studentId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('student_notes')
    .select(`
      id,
      content,
      created_at,
      created_by,
      profiles (
        id,
        full_name
      )
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createStudentNote(
  studentId: string,
  content: string,
  createdBy: string
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('student_notes')
    .insert({
      student_id: studentId,
      content,
      created_by: createdBy,
    })

  if (error) throw error

  revalidatePath('/dashboard/uczniowie')
}

