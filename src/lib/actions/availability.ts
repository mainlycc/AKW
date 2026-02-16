'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  AvailabilitySlot,
  AvailabilityTemplate,
  DayOfWeek,
  SuggestedTimeSlot,
  TimeSlot,
  TutorAvailabilityData,
  TutorAvailabilitySummary,
} from '@/lib/types/availability.types'
import {
  DEFAULT_WORKING_HOURS,
  DAY_NAMES,
  SLOT_DURATION_MINUTES,
} from '@/lib/types/availability.types'

const normalizeTimeForDb = (time: string): string => {
  const [hourStr = '00', minuteStr = '00'] = time.split(':')
  const hours = hourStr.padStart(2, '0')
  const minutes = minuteStr.padStart(2, '0')
  return `${hours}:${minutes}`
}

const timeToMinutes = (time: string): number => {
  const [hoursStr = '0', minutesStr = '0'] = normalizeTimeForDb(time).split(':')
  const hours = Number.parseInt(hoursStr, 10)
  const minutes = Number.parseInt(minutesStr, 10)
  return hours * 60 + minutes
}

const validateSlots = (slots: TimeSlot[]) => {
  if (!slots.length) {
    throw new Error('Musisz zaznaczyć przynajmniej jeden slot w grafiku.')
  }

  const uniqueKeys = new Set<string>()
  let availableCount = 0

  for (const slot of slots) {
    const normalizedStart = normalizeTimeForDb(slot.startTime)
    const normalizedEnd = normalizeTimeForDb(slot.endTime)
    const startMinutes = timeToMinutes(normalizedStart)
    const endMinutes = timeToMinutes(normalizedEnd)

    if (endMinutes <= startMinutes) {
      throw new Error(`Slot ${normalizedStart}-${normalizedEnd} ma nieprawidłowy zakres czasu.`)
    }

    const duration = endMinutes - startMinutes
    if (duration !== SLOT_DURATION_MINUTES) {
      throw new Error(`Slot ${normalizedStart}-${normalizedEnd} musi mieć dokładnie ${SLOT_DURATION_MINUTES} minut.`)
    }

    if (startMinutes % SLOT_DURATION_MINUTES !== 0 || endMinutes % SLOT_DURATION_MINUTES !== 0) {
      throw new Error(`Slot ${normalizedStart}-${normalizedEnd} musi zaczynać i kończyć się o pełnej godzinie.`)
    }

    const key = `${slot.day}-${normalizedStart}`
    if (uniqueKeys.has(key)) {
      throw new Error(`Slot ${normalizedStart} w dniu ${slot.day} został zdefiniowany więcej niż raz.`)
    }
    uniqueKeys.add(key)

    const workingHours = slot.day >= 1 && slot.day <= 5 ? DEFAULT_WORKING_HOURS.weekday : DEFAULT_WORKING_HOURS.weekend
    const workingStart = timeToMinutes(workingHours.start)
    const workingEnd = timeToMinutes(workingHours.end)

    if (startMinutes < workingStart || endMinutes > workingEnd) {
      throw new Error(`Slot ${normalizedStart}-${normalizedEnd} jest poza dozwolonymi godzinami pracy.`)
    }

    if (slot.isAvailable) {
      availableCount += 1
    }
  }

  if (availableCount === 0) {
    throw new Error('Musisz zaznaczyć przynajmniej jeden dostępny slot.')
  }
}

const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

  // Normalizuj i popraw sloty przed walidacją
  const normalizedSlots: TimeSlot[] = slots.map((slot) => {
    const normalizedStart = normalizeTimeForDb(slot.startTime)
    let startMinutes = timeToMinutes(normalizedStart)
    
    // Zaokrąglij czas rozpoczęcia w dół do najbliższej pełnej godziny
    const correctedStartMinutes = Math.floor(startMinutes / SLOT_DURATION_MINUTES) * SLOT_DURATION_MINUTES
    const correctedStartHours = Math.floor(correctedStartMinutes / 60)
    const correctedStartMins = correctedStartMinutes % 60
    const correctedStart = `${correctedStartHours.toString().padStart(2, '0')}:${correctedStartMins.toString().padStart(2, '0')}`
    
    // Oblicz czas zakończenia jako czas rozpoczęcia + 60 minut
    const expectedEndMinutes = correctedStartMinutes + SLOT_DURATION_MINUTES
    const expectedEndHours = Math.floor(expectedEndMinutes / 60)
    const expectedEndMins = expectedEndMinutes % 60
    const expectedEnd = `${expectedEndHours.toString().padStart(2, '0')}:${expectedEndMins.toString().padStart(2, '0')}`
    
    const normalizedEnd = normalizeTimeForDb(slot.endTime)
    const endMinutes = timeToMinutes(normalizedEnd)
    
    // Sprawdź czy potrzebna jest korekta
    const needsCorrection = startMinutes !== correctedStartMinutes || endMinutes !== expectedEndMinutes
    
    if (needsCorrection) {
      console.warn(`Poprawiam slot ${normalizedStart}-${normalizedEnd} na ${correctedStart}-${expectedEnd}`)
      return {
        ...slot,
        startTime: correctedStart,
        endTime: expectedEnd,
      }
    }
    
    return {
      ...slot,
      startTime: normalizedStart,
      endTime: normalizedEnd,
    }
  })

  // Walidacja
  validateSlots(normalizedSlots)

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
  const slotsToInsert = normalizedSlots.map((slot) => ({
    template_id: template.id,
    day_of_week: slot.day,
    start_time: normalizeTimeForDb(slot.startTime),
    end_time: normalizeTimeForDb(slot.endTime),
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

// Zaproponuj najbliższe dostępne sloty dla sesji
export async function getSuggestedTimeSlots(
  tutorId: string,
  _studentId: string,
  durationMinutes = SLOT_DURATION_MINUTES
): Promise<SuggestedTimeSlot[]> {
  if (durationMinutes !== SLOT_DURATION_MINUTES) {
    throw new Error('Sugestie są dostępne tylko dla sesji trwających 60 minut.')
  }

  const supabase = await createClient()

  const { data: template, error: templateError } = await supabase
    .from('tutor_availability_templates')
    .select('id')
    .eq('tutor_id', tutorId)
    .eq('is_active', true)
    .single()

  if (templateError || !template) {
    return []
  }

  const { data: availableSlots, error: slotsError } = await supabase
    .from('tutor_availability_slots')
    .select('day_of_week, start_time, end_time, is_available')
    .eq('template_id', template.id)
    .eq('is_available', true)
    .order('day_of_week')
    .order('start_time')

  if (slotsError || !availableSlots?.length) {
    return []
  }

  const { data: bookedSlots } = await supabase
    .from('booked_slots')
    .select('weekday, start_time, end_time, status')
    .eq('tutor_id', tutorId)
    .eq('status', 'booked')

  const bookedSet = new Set(
    (bookedSlots || []).map(
      (slot) => `${slot.weekday}-${normalizeTimeForDb(slot.start_time)}-${normalizeTimeForDb(slot.end_time)}`
    )
  )

  const now = new Date()
  now.setSeconds(0, 0)
  const suggestions: SuggestedTimeSlot[] = []

  const MAX_DAYS_AHEAD = 28
  const MAX_SUGGESTIONS = 10

  for (let offset = 0; offset < MAX_DAYS_AHEAD && suggestions.length < MAX_SUGGESTIONS; offset++) {
    const date = new Date(now)
    date.setHours(0, 0, 0, 0)
    date.setDate(now.getDate() + offset)

    const weekday = (((date.getDay() + 6) % 7) + 1) as DayOfWeek

    const daySlots = availableSlots.filter((slot) => slot.day_of_week === weekday)

    for (const slot of daySlots) {
      const startTime = normalizeTimeForDb(slot.start_time)
      const endTime = normalizeTimeForDb(slot.end_time)
      const uniqueKey = `${weekday}-${startTime}-${endTime}`

      if (bookedSet.has(uniqueKey)) {
        continue
      }

      const slotDateTime = new Date(date)
      const [startHour, startMinute] = startTime.split(':').map((value) => Number.parseInt(value, 10))
      slotDateTime.setHours(startHour, startMinute, 0, 0)

      if (slotDateTime <= now) {
        continue
      }

      const localizedDate = formatDate(slotDateTime)
      const label = `${DAY_NAMES[weekday]} ${localizedDate.split('-').reverse().join('.')} · ${startTime}-${endTime}`

      suggestions.push({
        weekday,
        date: localizedDate,
        startTime,
        endTime,
        label,
      })

      if (suggestions.length >= MAX_SUGGESTIONS) {
        break
      }
    }
  }

  return suggestions
}


