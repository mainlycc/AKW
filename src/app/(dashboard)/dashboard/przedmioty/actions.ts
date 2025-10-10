'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Subject actions
export async function createSubject(data: { name: string; description: string }) {
  const supabase = await createClient()

  // Utwórz przedmiot
  const { data: subject, error: subjectError } = await supabase
    .from('subjects')
    .insert({
      name: data.name,
      description: data.description || null,
    })
    .select()
    .single()

  if (subjectError) {
    throw subjectError
  }

  // Automatycznie dodaj 3 standardowe poziomy
  const standardLevels = [
    { subject_id: subject.id, level_name: 'Szkoła podstawowa', level_order: 1, price_per_hour: 0 },
    { subject_id: subject.id, level_name: 'Szkoła średnia podstawa', level_order: 2, price_per_hour: 0 },
    { subject_id: subject.id, level_name: 'Szkoła średnia rozszerzenie', level_order: 3, price_per_hour: 0 },
  ]

  const { error: levelsError } = await supabase
    .from('subject_levels')
    .insert(standardLevels)

  if (levelsError) {
    // Usuń przedmiot jeśli nie udało się dodać poziomów
    await supabase.from('subjects').delete().eq('id', subject.id)
    throw levelsError
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
// DEPRECATED: Levels are now automatically created when creating a subject
// Keeping for backward compatibility, but should not be used
/**
 * @deprecated Poziomy są teraz automatycznie tworzone przy tworzeniu przedmiotu.
 * Każdy przedmiot ma 3 standardowe poziomy. Nie używaj tej funkcji.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function createSubjectLevel(
  _subjectId: string,
  _data: {
    level_name: string
    level_order: number
    price_per_hour?: number
  }
) {
  console.warn('createSubjectLevel is deprecated. Levels are automatically created.')
  throw new Error('Nie można dodawać nowych poziomów. Każdy przedmiot ma 3 standardowe poziomy.')
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export async function updateSubjectLevel(
  id: string,
  data: {
    level_name: string
    level_order: number
    price_per_hour?: number  // Deprecated: defaults to 0
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('subject_levels')
    .update({
      level_name: data.level_name,
      level_order: data.level_order,
      price_per_hour: data.price_per_hour ?? 0,  // Default to 0 (deprecated field)
    })
    .eq('id', id)

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/przedmioty')
}

/**
 * @deprecated Poziomy są nieusuwalne. Każdy przedmiot musi mieć 3 standardowe poziomy.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function deleteSubjectLevel(_id: string) {
  console.warn('deleteSubjectLevel is deprecated. Levels cannot be deleted.')
  throw new Error('Nie można usuwać poziomów. Każdy przedmiot musi mieć 3 standardowe poziomy.')
}
/* eslint-enable @typescript-eslint/no-unused-vars */

