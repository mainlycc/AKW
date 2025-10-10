'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  AvailabilitySlot,
  AvailabilityTemplate,
  TimeSlot,
  TutorAvailabilityData,
  TutorAvailabilitySummary,
} from '@/lib/types/availability.types'

// Pobierz aktywny szablon dostępności tutora
export async function getTutorAvailability(tutorId: string): Promise<TutorAvailabilityData | null> {
  const supabase = await createClient()

  const { data: template, error: templateError } = await supabase
    .from('tutor_availability_templates')
    .select('*')
    .eq('tutor_id', tutorId)
    .eq('is_active', true)
    .single()

  if (templateError || !template) {
    return null
  }

  const { data: slots, error: slotsError } = await supabase
    .from('tutor_availability_slots')
    .select('*')
    .eq('template_id', template.id)
    .order('day_of_week')
    .order('start_time')

  if (slotsError) {
    throw slotsError
  }

  return {
    template: template as AvailabilityTemplate,
    slots: (slots || []) as AvailabilitySlot[],
  }
}

// Pobierz historię wersji szablonów tutora
export async function getAvailabilityHistory(tutorId: string): Promise<AvailabilityTemplate[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tutor_availability_templates')
    .select('*')
    .eq('tutor_id', tutorId)
    .order('version', { ascending: false })

  if (error) throw error
  return (data || []) as AvailabilityTemplate[]
}

// Utwórz nowy szablon dostępności
export async function createAvailabilityTemplate(
  tutorId: string,
  slots: TimeSlot[]
): Promise<TutorAvailabilityData> {
  const supabase = await createClient()

  // Walidacja
  if (slots.length === 0) {
    throw new Error('Musisz zaznaczyć przynajmniej jeden dostępny slot')
  }

  // Sprawdź najwyższą wersję
  const { data: existingTemplates } = await supabase
    .from('tutor_availability_templates')
    .select('version')
    .eq('tutor_id', tutorId)
    .order('version', { ascending: false })
    .limit(1)

  const nextVersion = existingTemplates && existingTemplates.length > 0 
    ? existingTemplates[0].version + 1 
    : 1

  // Utwórz nowy szablon
  const { data: template, error: templateError } = await supabase
    .from('tutor_availability_templates')
    .insert({
      tutor_id: tutorId,
      version: nextVersion,
      is_active: true,
    })
    .select()
    .single()

  if (templateError) throw templateError

  // Dodaj sloty
  const slotsToInsert = slots.map((slot) => ({
    template_id: template.id,
    day_of_week: slot.day,
    start_time: slot.startTime,
    end_time: slot.endTime,
    is_available: slot.isAvailable,
  }))

  const { data: insertedSlots, error: slotsError } = await supabase
    .from('tutor_availability_slots')
    .insert(slotsToInsert)
    .select()

  if (slotsError) {
    // Usuń szablon jeśli nie udało się dodać slotów
    await supabase.from('tutor_availability_templates').delete().eq('id', template.id)
    throw slotsError
  }

  revalidatePath('/dashboard/kalendarz')
  revalidatePath('/dashboard/dostepnosc-tutorow')

  return {
    template: template as AvailabilityTemplate,
    slots: (insertedSlots || []) as AvailabilitySlot[],
  }
}

// Aktualizuj szablon (tworzy nową wersję)
export async function updateAvailabilityTemplate(
  tutorId: string,
  slots: TimeSlot[]
): Promise<TutorAvailabilityData> {
  return createAvailabilityTemplate(tutorId, slots)
}

// Pobierz dostępność wszystkich tutorów (dla admina)
export async function getAllTutorsAvailability(): Promise<TutorAvailabilitySummary[]> {
  const supabase = await createClient()

  // Pobierz wszystkich tutorów
  const { data: tutors, error: tutorsError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'tutor')
    .order('full_name')

  if (tutorsError) throw tutorsError

  // Pobierz aktywne szablony
  const { data: templates, error: templatesError } = await supabase
    .from('tutor_availability_templates')
    .select('tutor_id, version, updated_at')
    .eq('is_active', true)

  if (templatesError) throw templatesError

  const templatesMap = new Map(
    templates?.map((t) => [t.tutor_id, { version: t.version, updated_at: t.updated_at }])
  )

  return (tutors || []).map((tutor) => {
    const template = templatesMap.get(tutor.id)
    return {
      tutor_id: tutor.id,
      tutor_name: tutor.full_name,
      has_availability: !!template,
      version: template?.version || null,
      last_updated: template?.updated_at || null,
    }
  })
}


