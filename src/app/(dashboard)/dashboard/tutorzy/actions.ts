'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendTutorGroupMessageEmail } from '@/lib/email/send'

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
  revalidatePath(`/dashboard/tutorzy/${tutorId}`)
}

export async function deleteTutor(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('profiles').delete().eq('id', id).eq('role', 'tutor')

  if (error) throw error

  revalidatePath('/dashboard/tutorzy')
}

export async function sendGroupMessageToTutors(
  selectedTutorIds: string[],
  message: string
): Promise<{ success: boolean; error?: string; sentCount?: number; failedCount?: number }> {
  const supabase = await createClient()

  if (!selectedTutorIds || selectedTutorIds.length === 0) {
    return { success: false, error: 'Nie wybrano tutorów' }
  }

  if (!message || !message.trim()) {
    return { success: false, error: 'Treść wiadomości nie może być pusta' }
  }

  // Pobierz tutorów z emailami
  const { data: tutors, error: tutorsError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', selectedTutorIds)
    .eq('role', 'tutor')

  if (tutorsError) {
    console.error('Error fetching tutors:', tutorsError)
    return { success: false, error: 'Nie udało się pobrać danych tutorów' }
  }

  if (!tutors || tutors.length === 0) {
    return { success: false, error: 'Nie znaleziono zaznaczonych tutorów' }
  }

  // Filtruj tylko tutorów z emailami
  const tutorsWithEmails = tutors.filter(tutor => tutor.email && tutor.email.trim())

  if (tutorsWithEmails.length === 0) {
    return { success: false, error: 'Nie znaleziono tutorów z adresami email dla zaznaczonych tutorów' }
  }

  // Wyślij email do każdego tutora
  let sentCount = 0
  let failedCount = 0
  const errors: string[] = []

  for (const tutor of tutorsWithEmails) {
    const result = await sendTutorGroupMessageEmail({
      to: tutor.email,
      tutorName: tutor.full_name,
      message: message.trim(),
    })

    if (result.success) {
      sentCount++
    } else {
      failedCount++
      errors.push(`${tutor.full_name}: ${result.error || 'Nieznany błąd'}`)
    }
  }

  revalidatePath('/dashboard/tutorzy')

  if (failedCount > 0 && sentCount === 0) {
    return {
      success: false,
      error: `Nie udało się wysłać żadnej wiadomości. Błędy: ${errors.join('; ')}`,
      sentCount,
      failedCount,
    }
  }

  if (failedCount > 0) {
    return {
      success: true,
      error: `Wysłano ${sentCount} wiadomości, nie udało się wysłać ${failedCount}. Błędy: ${errors.join('; ')}`,
      sentCount,
      failedCount,
    }
  }

  return {
    success: true,
    sentCount,
    failedCount: 0,
  }
}

