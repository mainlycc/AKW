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
  // Validate input data
  if (!data.email || !data.email.trim()) {
    throw new Error('Email rodzica jest wymagany')
  }
  
  if (!data.first_name || !data.first_name.trim()) {
    throw new Error('Imię rodzica jest wymagane')
  }
  
  if (!data.last_name || !data.last_name.trim()) {
    throw new Error('Nazwisko rodzica jest wymagane')
  }

  const supabase = await createClient()

  try {
    // Check if parent with this email already exists
    const normalizedEmail = data.email.trim().toLowerCase()
    const { data: existingParent, error: checkError } = await supabase
      .from('parents')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking for existing parent:', checkError)
      throw new Error(`Nie udało się sprawdzić czy rodzic istnieje: ${checkError.message}`)
    }

    if (existingParent) {
      // Parent already exists, return existing parent
      // Return only serializable fields (no dates to avoid serialization issues)
      // Use JSON.parse/stringify to ensure full serialization
      return JSON.parse(JSON.stringify({
        id: existingParent.id,
        first_name: existingParent.first_name,
        last_name: existingParent.last_name,
        email: existingParent.email,
        phone: existingParent.phone,
        parent_type: existingParent.parent_type,
      }))
    }

    // Create new parent
    const { data: parent, error } = await supabase
      .from('parents')
      .insert({
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        email: normalizedEmail,
        phone: data.phone?.trim() || null,
        parent_type: data.parent_type,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating parent:', error)
      
      // Check for duplicate email error (in case of race condition)
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        // Try to fetch the existing parent
        const { data: existing, error: fetchError } = await supabase
          .from('parents')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle()
        
        if (fetchError) {
          console.error('Error fetching existing parent after duplicate:', fetchError)
          throw new Error(`Nie udało się utworzyć rodzica: ${fetchError.message}`)
        }
        
        if (existing) {
          // Return only serializable fields (no dates to avoid serialization issues)
          // Use JSON.parse/stringify to ensure full serialization
          return JSON.parse(JSON.stringify({
            id: existing.id,
            first_name: existing.first_name,
            last_name: existing.last_name,
            email: existing.email,
            phone: existing.phone,
            parent_type: existing.parent_type,
          }))
        }
      }
      
      // Check for RLS policy error
      if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
        throw new Error(`Brak uprawnień do utworzenia rodzica. Sprawdź czy jesteś zalogowany jako administrator.`)
      }
      
      throw new Error(`Nie udało się utworzyć rodzica: ${error.message || error.code || 'Nieznany błąd'}`)
    }

    if (!parent) {
      throw new Error('Nie udało się utworzyć rodzica: Brak danych zwróconych z bazy')
    }

    // Return only serializable fields (no dates to avoid serialization issues)
    // Use JSON.parse/stringify to ensure full serialization
    return JSON.parse(JSON.stringify({
      id: parent.id,
      first_name: parent.first_name,
      last_name: parent.last_name,
      email: parent.email,
      phone: parent.phone,
      parent_type: parent.parent_type,
    }))
  } catch (error) {
    // Log full error for debugging
    console.error('Full error in createParent:', {
      error,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    
    // Re-throw errors that are already Error instances
    if (error instanceof Error) {
      // Ensure error message is a string for serialization
      const errorMessage = error.message || 'Nieznany błąd'
      throw new Error(errorMessage)
    }
    // Wrap other errors
    throw new Error(`Nieoczekiwany błąd podczas tworzenia rodzica: ${String(error)}`)
  }
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
}

export async function deleteParent(parentId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('parents')
    .delete()
    .eq('id', parentId)

  if (error) throw error
}

export async function linkParentToStudent(
  parentId: string,
  studentId: string,
  isPrimary = false
): Promise<{ success: boolean; message?: string }> {
  try {
    // Validate input first
    if (!parentId || !studentId) {
      const errorMessage = 'ID rodzica i ucznia są wymagane'
      console.error('[linkParentToStudent] Validation error:', errorMessage)
      return { success: false, message: errorMessage }
    }

    // Create Supabase client inside try-catch
    const supabase = await createClient()

    // Check if relationship already exists
    const { data: existing, error: checkError } = await supabase
      .from('student_parents')
      .select('id')
      .eq('parent_id', parentId)
      .eq('student_id', studentId)
      .maybeSingle()

    if (checkError) {
      console.error('[linkParentToStudent] Error checking existing relationship:', {
        error: checkError,
        parentId,
        studentId,
      })
      const errorMessage = `Nie udało się sprawdzić przypisania rodzica: ${checkError.message}`
      return { success: false, message: errorMessage }
    }

    if (existing) {
      // Relationship already exists, return success (idempotent)
      console.log('[linkParentToStudent] Relationship already exists, returning success')
      return { success: true }
    }

    const { error } = await supabase
      .from('student_parents')
      .insert({
        parent_id: parentId,
        student_id: studentId,
        is_primary: isPrimary,
      })

    if (error) {
      console.error('[linkParentToStudent] Error inserting relationship:', {
        error,
        errorCode: error.code,
        errorMessage: error.message,
        parentId,
        studentId,
      })
      
      // Check for unique constraint violation
      if (error.code === '23505') {
        // Duplicate key error - relationship already exists (race condition)
        console.log('[linkParentToStudent] Duplicate key error (race condition), returning success')
        return { success: true }
      }
      
      // Check for RLS policy error
      if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
        const errorMessage = 'Brak uprawnień do przypisania rodzica. Sprawdź czy jesteś zalogowany jako administrator.'
        console.error('[linkParentToStudent] RLS policy error:', errorMessage)
        return { success: false, message: errorMessage }
      }
      
      const errorMessage = `Nie udało się przypisać rodzica do ucznia: ${error.message || error.code || 'Nieznany błąd'}`
      return { success: false, message: errorMessage }
    }

    // Success - return success (revalidation will be done in wrapper action)
    console.log('[linkParentToStudent] Successfully linked parent to student')
    return { success: true }
  } catch (error) {
    // Log full error for debugging (server-side)
    console.error('[linkParentToStudent] Unexpected error:', {
      error,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      parentId,
      studentId,
    })
    
    // Return error response instead of throwing
    const errorMessage = error instanceof Error 
      ? error.message 
      : `Nieoczekiwany błąd podczas przypisywania rodzica: ${String(error)}`
    return { success: false, message: errorMessage }
  }
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

