'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface DefaultRates {
  default_student_rate: number | null
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
    .in('key', ['default_student_rate', 'default_tutor_rate'])

  if (error) {
    console.error('Error fetching default rates:', error)
    // Zwróć domyślne wartości w przypadku błędu
    return {
      default_student_rate: 50.00,
      default_tutor_rate: null,
    }
  }

  const rates: DefaultRates = {
    default_student_rate: 50.00, // fallback
    default_tutor_rate: null,
  }

  if (settings) {
    for (const setting of settings) {
      if (setting.key === 'default_student_rate') {
        rates.default_student_rate = setting.value
          ? parseFloat(setting.value)
          : 50.00
      } else if (setting.key === 'default_tutor_rate') {
        rates.default_tutor_rate = setting.value
          ? parseFloat(setting.value)
          : null
      }
    }
  }

  return rates
}

/**
 * Aktualizuje domyślne stawki w system_settings
 * Automatycznie aktualizuje istniejących użytkowników z NULL stawką
 */
export async function updateDefaultRates(
  studentRate: number | null,
  tutorRate: number | null,
  updateAllStudents: boolean = false
): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
  const supabase = await createClient()

  // Walidacja
  if (studentRate !== null && (isNaN(studentRate) || studentRate < 0)) {
    return {
      success: false,
      error: 'Stawka dla studentów musi być liczbą dodatnią',
    }
  }

  if (tutorRate !== null && (isNaN(tutorRate) || tutorRate < 0)) {
    return {
      success: false,
      error: 'Stawka dla tutorów musi być liczbą dodatnią',
    }
  }

  try {
    // Aktualizuj lub wstaw domyślną stawkę dla studentów
    const { error: studentError } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: 'default_student_rate',
          value: studentRate !== null ? studentRate.toString() : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'key',
        }
      )

    if (studentError) {
      console.error('Error updating student rate:', studentError)
      return {
        success: false,
        error: `Błąd podczas aktualizacji stawki dla studentów: ${studentError.message}`,
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

    // Aktualizuj studentów (jeśli studentRate jest ustawione)
    if (studentRate !== null) {
      // Jeśli updateAllStudents = true, aktualizuj wszystkich
      // W przeciwnym razie aktualizuj tylko tych z NULL stawką
      if (updateAllStudents) {
        // Aktualizuj wszystkich studentów - używamy warunku który zawsze jest prawdziwy
        const { data: updatedStudents, error: updateStudentsError } =
          await supabase
            .from('students')
            .update({ hourly_rate: studentRate })
            .neq('id', '00000000-0000-0000-0000-000000000000') // Warunek zawsze prawdziwy (nie istniejący UUID)
            .select('id')

        if (updateStudentsError) {
          console.error('Error updating students:', updateStudentsError)
          return {
            success: false,
            error: `Błąd podczas aktualizacji studentów: ${updateStudentsError.message}`,
          }
        }
        
        if (updatedStudents) {
          updatedCount += updatedStudents.length
        }
      } else {
        // Aktualizuj tylko studentów z NULL stawką
        const { data: updatedStudents, error: updateStudentsError } =
          await supabase
            .from('students')
            .update({ hourly_rate: studentRate })
            .is('hourly_rate', null)
            .select('id')

        if (updateStudentsError) {
          console.error('Error updating students:', updateStudentsError)
          // Nie przerywamy - kontynuujemy z tutorami
        } else if (updatedStudents) {
          updatedCount += updatedStudents.length
        }
      }
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
 * Pobiera domyślną stawkę dla studentów (używane przy tworzeniu nowych studentów)
 */
export async function getDefaultStudentRate(): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'default_student_rate')
    .maybeSingle()

  if (error || !data || !data.value) {
    // Fallback do wartości domyślnej z kolumny
    return 50.00
  }

  const rate = parseFloat(data.value)
  return isNaN(rate) ? 50.00 : rate
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
