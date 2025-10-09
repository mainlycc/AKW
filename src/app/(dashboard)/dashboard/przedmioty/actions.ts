'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Subject actions
export async function createSubject(data: { name: string; description: string }) {
  const supabase = await createClient()

  const { error } = await supabase.from('subjects').insert({
    name: data.name,
    description: data.description || null,
  })

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/przedmioty')
}

export async function updateSubject(id: string, data: { name: string; description: string }) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('subjects')
    .update({
      name: data.name,
      description: data.description || null,
    })
    .eq('id', id)

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/przedmioty')
}

export async function deleteSubject(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('subjects').delete().eq('id', id)

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/przedmioty')
}

// Subject Level actions
export async function createSubjectLevel(
  subjectId: string,
  data: {
    level_name: string
    level_order: number
    price_per_hour: number
  }
) {
  const supabase = await createClient()

  const { error } = await supabase.from('subject_levels').insert({
    subject_id: subjectId,
    level_name: data.level_name,
    level_order: data.level_order,
    price_per_hour: data.price_per_hour,
  })

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/przedmioty')
}

export async function updateSubjectLevel(
  id: string,
  data: {
    level_name: string
    level_order: number
    price_per_hour: number
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('subject_levels')
    .update({
      level_name: data.level_name,
      level_order: data.level_order,
      price_per_hour: data.price_per_hour,
    })
    .eq('id', id)

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/przedmioty')
}

export async function deleteSubjectLevel(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('subject_levels').delete().eq('id', id)

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/przedmioty')
}

