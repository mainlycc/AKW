import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface LessonHistoryItem {
  id: string
  session_date: string
  duration_minutes: number
  notes: string | null
  status: 'scheduled' | 'completed' | 'cancelled'
  tutor_name: string | null
  subject_name: string | null
  level_name: string | null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params

  if (!studentId) {
    return NextResponse.json(
      { error: 'Missing student id' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // W profilu ucznia chcemy pokazać lekcje przeszłe:
  // - completed (odbyte)
  // - scheduled, ale tylko jeśli data już minęła (niepotwierdzone/nieoznaczone)
  // - cancelled pomijamy
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('tutoring_sessions')
    .select(`
      id,
      session_date,
      duration_minutes,
      notes,
      status,
      profiles!tutoring_sessions_tutor_id_fkey (
        id,
        full_name
      ),
      student_assignments!tutoring_sessions_assignment_id_fkey (
        subjects!student_assignments_subject_id_fkey (
          id,
          name
        ),
        subject_levels!student_assignments_subject_level_id_fkey (
          id,
          level_name
        )
      )
    `)
    .eq('student_id', studentId)
    .in('status', ['completed', 'scheduled'])
    .lt('session_date', nowIso)
    .order('session_date', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching student lesson history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lesson history' },
      { status: 500 }
    )
  }

  const sessions: LessonHistoryItem[] =
    (data || []).map((session: any) => {
      const tutor = Array.isArray(session.profiles)
        ? session.profiles[0]
        : session.profiles

      const assignment = Array.isArray(session.student_assignments)
        ? session.student_assignments[0]
        : session.student_assignments

      const subject = assignment && (Array.isArray(assignment.subjects)
        ? assignment.subjects[0]
        : assignment.subjects)

      const level = assignment && (Array.isArray(assignment.subject_levels)
        ? assignment.subject_levels[0]
        : assignment.subject_levels)

      return {
        id: session.id,
        session_date: session.session_date,
        duration_minutes: session.duration_minutes ?? 0,
        notes: session.notes ?? null,
        status: session.status ?? 'scheduled',
        tutor_name: tutor?.full_name ?? null,
        subject_name: subject?.name ?? null,
        level_name: level?.level_name ?? null,
      }
    })

  return NextResponse.json({ sessions })
}

