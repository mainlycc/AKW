import { getUserProfile } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/server"
import { getTutorSubjectLevels } from "@/lib/actions/tutor"
import { ProfileForm } from "./profile-form"
import { SubjectSelection } from "./subject-selection"
import { redirect } from "next/navigation"

export default async function ProfilePage() {
  const profile = await getUserProfile()

  if (!profile || profile.role !== 'tutor') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Get all subjects with levels
  const { data: subjects } = await supabase
    .from('subjects')
    .select(`
      id,
      name,
      color,
      subject_levels (
        id,
        level_name,
        level_order,
        price_per_hour
      )
    `)
    .order('name')

  // Get tutor's selected subject levels
  const tutorLevels = await getTutorSubjectLevels(profile.id)

  return (
    <div className="space-y-6">
      <ProfileForm profile={profile} />
      <SubjectSelection
        tutorId={profile.id}
        subjects={subjects || []}
        tutorLevels={tutorLevels}
      />
    </div>
  )
}

