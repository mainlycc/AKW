'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createAssignment(data: {
  student_id: string
  tutor_id: string
  subject_id: string
  subject_level_id: string
  assigned_by: string
}) {
  const supabase = await createClient()

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

  revalidatePath('/dashboard/przypisania')
}

export async function updateAssignmentStatus(
  id: string,
  status: 'active' | 'completed' | 'cancelled'
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('student_assignments')
    .update({ status })
    .eq('id', id)

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/przypisania')
}

