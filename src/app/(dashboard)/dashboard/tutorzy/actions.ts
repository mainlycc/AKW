'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateTutorDetails(
  tutorId: string,
  data: {
    full_name: string
    phone: string
    bio: string
    hourly_rate: number | null
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: data.full_name,
      phone: data.phone || null,
      bio: data.bio || null,
      hourly_rate: data.hourly_rate,
    })
    .eq('id', tutorId)

  if (error) throw error

  revalidatePath('/dashboard/tutorzy')
}

