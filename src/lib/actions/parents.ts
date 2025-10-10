'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ParentType = 'mother' | 'father' | 'legal_guardian' | 'other'

export async function getParents() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('parents')
    .select(`
      *,
      student_parents (
        student_id,
        students (
          id,
          first_name,
          last_name
        )
      )
    `)
    .order('last_name')

  if (error) throw error
  return data || []
}

export async function getParentById(parentId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('parents')
    .select('*')
    .eq('id', parentId)
    .single()

  if (error) throw error
  return data
}

export async function createParent(data: {
  first_name: string
  last_name: string
  email: string
  phone: string
  parent_type: ParentType
}) {
  const supabase = await createClient()

  const { data: parent, error } = await supabase
    .from('parents')
    .insert({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone || null,
      parent_type: data.parent_type,
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath('/dashboard/rodzice')
  return parent
}

export async function updateParent(
  parentId: string,
  data: {
    first_name: string
    last_name: string
    email: string
    phone: string
    parent_type: ParentType
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('parents')
    .update({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone || null,
      parent_type: data.parent_type,
    })
    .eq('id', parentId)

  if (error) throw error

  revalidatePath('/dashboard/rodzice')
}

export async function deleteParent(parentId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('parents')
    .delete()
    .eq('id', parentId)

  if (error) throw error

  revalidatePath('/dashboard/rodzice')
}

export async function linkParentToStudent(parentId: string, studentId: string, isPrimary = false) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('student_parents')
    .insert({
      parent_id: parentId,
      student_id: studentId,
      is_primary: isPrimary,
    })

  if (error) throw error

  revalidatePath('/dashboard/uczniowie')
  revalidatePath('/dashboard/rodzice')
}

export async function unlinkParentFromStudent(parentId: string, studentId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('student_parents')
    .delete()
    .eq('parent_id', parentId)
    .eq('student_id', studentId)

  if (error) throw error

  revalidatePath('/dashboard/uczniowie')
  revalidatePath('/dashboard/rodzice')
}

export async function getStudentParents(studentId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('student_parents')
    .select(`
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
    `)
    .eq('student_id', studentId)

  if (error) throw error
  return data || []
}

