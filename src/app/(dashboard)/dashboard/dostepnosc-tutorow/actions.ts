'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function clearTutorsAvailability(tutorIds: string[]) {
  if (!tutorIds.length) return

  const supabase = await createClient()

  const { error } = await supabase
    .from('tutor_availability_templates')
    .update({ is_active: false })
    .in('tutor_id', tutorIds)
    .eq('is_active', true)

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/dostepnosc-tutorow')
  revalidatePath('/dashboard/kalendarz')
}


