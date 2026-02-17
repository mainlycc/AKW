'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface DefaultRates {
  default_student_rate_level_1: number | null
  default_student_rate_level_2: number | null
  default_student_rate_level_3: number | null
  default_tutor_rate: number | null
}

/**
 * Pobiera domyślne stawki z system_settings
 */
export async function getDefaultRates(): Promise<DefaultRates> {
  const supabase = await createClient()

  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'default_student_rate', // legacy / alias for level 1
      'default_student_rate_level_1',
      'default_student_rate_level_2',
      'default_student_rate_level_3',
      'default_tutor_rate',
    ])

  if (error) {
    console.error('Error fetching default rates:', error)
    // Zwróć domyślne wartości w przypadku błędu
    return {
      default_student_rate_level_1: 50.0,
      default_student_rate_level_2: 50.0,
      default_student_rate_level_3: 50.0,
      default_tutor_rate: null,
    }
  }

  const rates: DefaultRates = {
    default_student_rate_level_1: 50.0, // fallback
    default_student_rate_level_2: 50.0,
    default_student_rate_level_3: 50.0,
    default_tutor_rate: null,
  }

  let legacyStudentRate: number | null = null

  if (settings) {
    for (const setting of settings) {
      if (setting.key === 'default_student_rate') {
        legacyStudentRate = setting.value ? parseFloat(setting.value) : 50.0
      } else if (setting.key === 'default_student_rate_level_1') {
        rates.default_student_rate_level_1 = setting.value
          ? parseFloat(setting.value)
          : 50.0
      } else if (setting.key === 'default_student_rate_level_2') {
        rates.default_student_rate_level_2 = setting.value
          ? parseFloat(setting.value)
          : 50.0
      } else if (setting.key === 'default_student_rate_level_3') {
        rates.default_student_rate_level_3 = setting.value
          ? parseFloat(setting.value)
          : 50.0
      } else if (setting.key === 'default_tutor_rate') {
        rates.default_tutor_rate = setting.value
          ? parseFloat(setting.value)
          : null
      }
    }
  }

  // Backward compatibility: if level_1 key missing, use legacy default_student_rate
  if (
    (rates.default_student_rate_level_1 === null ||
      Number.isNaN(rates.default_student_rate_level_1)) &&
    legacyStudentRate !== null &&
    !Number.isNaN(legacyStudentRate)
  ) {
    rates.default_student_rate_level_1 = legacyStudentRate
  }

  return rates
}

/**
 * Aktualizuje domyślne stawki w system_settings
 * Automatycznie aktualizuje istniejących użytkowników z NULL stawką
 */
export async function updateDefaultRates(
  studentRateLevel1: number | null,
  studentRateLevel2: number | null,
  studentRateLevel3: number | null,
  tutorRate: number | null,
  updateAllStudents: boolean = false
): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
  const supabase = await createClient()

  // Walidacja
  if (studentRateLevel1 !== null && (isNaN(studentRateLevel1) || studentRateLevel1 < 0)) {
    return {
      success: false,
      error: 'Stawka dla poziomu 1 musi być liczbą dodatnią',
    }
  }

  if (studentRateLevel2 !== null && (isNaN(studentRateLevel2) || studentRateLevel2 < 0)) {
    return {
      success: false,
      error: 'Stawka dla poziomu 2 musi być liczbą dodatnią',
    }
  }

  if (studentRateLevel3 !== null && (isNaN(studentRateLevel3) || studentRateLevel3 < 0)) {
    return {
      success: false,
      error: 'Stawka dla poziomu 3 musi być liczbą dodatnią',
    }
  }

  if (tutorRate !== null && (isNaN(tutorRate) || tutorRate < 0)) {
    return {
      success: false,
      error: 'Stawka dla tutorów musi być liczbą dodatnią',
    }
  }

  try {
    // Aktualizuj lub wstaw domyślne stawki dla poziomów (oraz legacy alias dla poziomu 1)
    const { error: student1Error } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: 'default_student_rate_level_1',
          value: studentRateLevel1 !== null ? studentRateLevel1.toString() : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'key',
        }
      )

    if (student1Error) {
      console.error('Error updating level 1 student rate:', student1Error)
      return {
        success: false,
        error: `Błąd podczas aktualizacji stawki dla poziomu 1: ${student1Error.message}`,
      }
    }

    // Legacy alias for level 1
    const { error: legacyStudentError } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: 'default_student_rate',
          value: studentRateLevel1 !== null ? studentRateLevel1.toString() : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'key',
        }
      )

    if (legacyStudentError) {
      console.error('Error updating legacy student rate alias:', legacyStudentError)
      return {
        success: false,
        error: `Błąd podczas aktualizacji aliasu stawki dla poziomu 1: ${legacyStudentError.message}`,
      }
    }

    const { error: student2Error } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: 'default_student_rate_level_2',
          value: studentRateLevel2 !== null ? studentRateLevel2.toString() : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'key',
        }
      )

    if (student2Error) {
      console.error('Error updating level 2 student rate:', student2Error)
      return {
        success: false,
        error: `Błąd podczas aktualizacji stawki dla poziomu 2: ${student2Error.message}`,
      }
    }

    const { error: student3Error } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: 'default_student_rate_level_3',
          value: studentRateLevel3 !== null ? studentRateLevel3.toString() : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'key',
        }
      )

    if (student3Error) {
      console.error('Error updating level 3 student rate:', student3Error)
      return {
        success: false,
        error: `Błąd podczas aktualizacji stawki dla poziomu 3: ${student3Error.message}`,
      }
    }

    // Aktualizuj lub wstaw domyślną stawkę dla tutorów
    const { error: tutorError } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: 'default_tutor_rate',
          value: tutorRate !== null ? tutorRate.toString() : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'key',
        }
      )

    if (tutorError) {
      console.error('Error updating tutor rate:', tutorError)
      return {
        success: false,
        error: `Błąd podczas aktualizacji stawki dla tutorów: ${tutorError.message}`,
      }
    }

    // Aktualizuj istniejących użytkowników
    let updatedCount = 0

    // Aktualizuj studentów wg poziomu (jeśli stawki są ustawione)
    // Domyślnie aktualizujemy TYLKO uczniów bez override (hourly_rate_is_overridden = false).
    // Jeśli updateAllStudents = true, nadpisujemy także indywidualne stawki i resetujemy override.
    const shouldUpdateStudents =
      studentRateLevel1 !== null ||
      studentRateLevel2 !== null ||
      studentRateLevel3 !== null

    if (shouldUpdateStudents) {
      const updateForLevel = async (level: 1 | 2 | 3, rate: number | null) => {
        if (rate === null) return { success: true as const }

        let query = supabase.from('students').update({
          hourly_rate: rate,
          ...(updateAllStudents ? { hourly_rate_is_overridden: false } : {}),
        })

        if (!updateAllStudents) {
          query = query.eq('hourly_rate_is_overridden', false)
        }

        query = query.eq('rate_level', level)

        const { data: updatedStudents, error: updateStudentsError } = await query.select('id')

        if (updateStudentsError) {
          console.error(`Error updating students for level ${level}:`, updateStudentsError)
          return {
            success: false as const,
            error: `Błąd podczas aktualizacji uczniów (poziom ${level}): ${updateStudentsError.message}`,
          }
        }

        if (updatedStudents) {
          updatedCount += updatedStudents.length
        }

        return { success: true as const }
      }

      const r1 = await updateForLevel(1, studentRateLevel1)
      if (!r1.success) return r1
      const r2 = await updateForLevel(2, studentRateLevel2)
      if (!r2.success) return r2
      const r3 = await updateForLevel(3, studentRateLevel3)
      if (!r3.success) return r3
    }

    // Aktualizuj tutorów z NULL stawką (jeśli tutorRate jest ustawione)
    if (tutorRate !== null) {
      const { data: updatedTutors, error: updateTutorsError } = await supabase
        .from('profiles')
        .update({ hourly_rate: tutorRate })
        .eq('role', 'tutor')
        .is('hourly_rate', null)
        .select('id')

      if (updateTutorsError) {
        console.error('Error updating tutors:', updateTutorsError)
        // Nie przerywamy - już zaktualizowaliśmy studentów
      } else if (updatedTutors) {
        updatedCount += updatedTutors.length
      }
    }

    revalidatePath('/dashboard/stawki')
    revalidatePath('/dashboard/uczniowie')
    revalidatePath('/dashboard/tutorzy')

    return {
      success: true,
      updatedCount,
    }
  } catch (error) {
    console.error('Unexpected error updating rates:', error)
    return {
      success: false,
      error: `Nieoczekiwany błąd: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Pobiera domyślną stawkę dla studentów (poziom 1) - kompatybilność wstecz
 */
export async function getDefaultStudentRate(): Promise<number> {
  const supabase = await createClient()

  // Prefer new level_1 key; fall back to legacy alias
  const { data: level1, error: level1Error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'default_student_rate_level_1')
    .maybeSingle()

  if (!level1Error && level1?.value) {
    const rate = parseFloat(level1.value)
    if (!Number.isNaN(rate)) return rate
  }

  const { data: legacy, error: legacyError } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'default_student_rate')
    .maybeSingle()

  if (legacyError || !legacy?.value) {
    return 50.0
  }

  const legacyRate = parseFloat(legacy.value)
  return Number.isNaN(legacyRate) ? 50.0 : legacyRate
}

/**
 * Pobiera domyślną stawkę dla studentów dla wybranego poziomu (1..3)
 */
export async function getDefaultStudentRateForLevel(level: 1 | 2 | 3): Promise<number> {
  const supabase = await createClient()

  const key = `default_student_rate_level_${level}`

  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error || !data || !data.value) {
    if (level === 1) {
      return await getDefaultStudentRate()
    }
    // fallback: level 1
    return await getDefaultStudentRate()
  }

  const rate = parseFloat(data.value)
  if (Number.isNaN(rate)) {
    return await getDefaultStudentRate()
  }

  return rate
}

/**
 * Pobiera domyślną stawkę dla tutorów (używane przy tworzeniu nowych tutorów)
 */
export async function getDefaultTutorRate(): Promise<number | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'default_tutor_rate')
    .maybeSingle()

  if (error || !data || !data.value) {
    return null
  }

  const rate = parseFloat(data.value)
  return isNaN(rate) ? null : rate
}
