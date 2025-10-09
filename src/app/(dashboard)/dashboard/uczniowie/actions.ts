'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createStudent(data: {
  first_name: string
  last_name: string
  parent_email: string
  parent_phone: string
  notes: string
}) {
  const supabase = await createClient()

  const { error } = await supabase.from('students').insert({
    first_name: data.first_name,
    last_name: data.last_name,
    parent_email: data.parent_email,
    parent_phone: data.parent_phone || null,
    notes: data.notes || null,
  })

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/uczniowie')
}

export async function updateStudent(
  id: string,
  data: {
    first_name: string
    last_name: string
    parent_email: string
    parent_phone: string
    notes: string
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('students')
    .update({
      first_name: data.first_name,
      last_name: data.last_name,
      parent_email: data.parent_email,
      parent_phone: data.parent_phone || null,
      notes: data.notes || null,
    })
    .eq('id', id)

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/uczniowie')
}

export async function deleteStudent(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('students').delete().eq('id', id)

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/uczniowie')
}

