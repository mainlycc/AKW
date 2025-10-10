'use server'

import { revalidatePath } from 'next/cache'
import { updateTutorProfile, updateTutorSubjectLevels } from '@/lib/actions/tutor'

export async function saveProfile(
  tutorId: string,
  data: {
    full_name: string
    phone: string
    bio: string
  }
) {
  await updateTutorProfile(tutorId, data)
  revalidatePath('/dashboard/profil')
}

export async function saveSubjectLevels(
  tutorId: string,
  subjectLevelIds: string[]
) {
  await updateTutorSubjectLevels(tutorId, subjectLevelIds)
  revalidatePath('/dashboard/profil')
}

