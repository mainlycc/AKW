'use server'

import { createClient } from '@/lib/supabase/server'

export async function getTutorProfile(tutorId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', tutorId)
    .eq('role', 'tutor')
    .single()

  if (error) throw error
  return data
}

export async function getTutorSubjectLevels(tutorId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tutor_subject_levels')
    .select(`
      id,
      subject_id,
      subject_level_id,
      subjects (
        id,
        name
      ),
      subject_levels (
        id,
        level_name,
        level_order,
        price_per_hour
      )
    `)
    .eq('tutor_id', tutorId)
    .order('subjects(name)')

  if (error) throw error
  return data || []
}

export async function updateTutorProfile(
  tutorId: string,
  data: {
    full_name: string
    phone: string
    bio: string
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: data.full_name,
      phone: data.phone || null,
      bio: data.bio || null,
    })
    .eq('id', tutorId)

  if (error) throw error
}

export async function updateTutorSubjectLevels(
  tutorId: string,
  subjectLevelIds: string[]
) {
  const supabase = await createClient()

  // Delete existing
  await supabase
    .from('tutor_subject_levels')
    .delete()
    .eq('tutor_id', tutorId)

  if (subjectLevelIds.length === 0) return

  // Get subject_id for each level
  const { data: levels } = await supabase
    .from('subject_levels')
    .select('id, subject_id')
    .in('id', subjectLevelIds)

  if (!levels) return

  // Insert new
  const inserts = levels.map(level => ({
    tutor_id: tutorId,
    subject_id: level.subject_id,
    subject_level_id: level.id,
  }))

  const { error } = await supabase
    .from('tutor_subject_levels')
    .insert(inserts)

  if (error) throw error
}

