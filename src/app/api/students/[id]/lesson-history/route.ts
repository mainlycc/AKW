import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface LessonHistoryItem {
  id: string
  session_date: string
  duration_minutes: number
  status: 'completed' | 'scheduled' | 'cancelled'
  notes: string | null
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

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('first_name, last_name')
    .eq('id', studentId)
    .single()

  if (studentError || !student) {
    console.error('Error fetching student for lesson history:', studentError)
    return NextResponse.json(
      { error: 'Student not found' },
      { status: 404 }
    )
  }

  const { data: matchingStudents, error: matchingStudentsError } = await supabase
    .rpc('get_student_history_student_ids', {
      p_student_id: studentId,
    })

  if (matchingStudentsError) {
    console.error('Error fetching duplicate student ids for lesson history:', matchingStudentsError)
    return NextResponse.json(
      { error: 'Failed to fetch lesson history' },
      { status: 500 }
    )
  }

  const studentIds = Array.from(
    new Set([studentId, ...(matchingStudents || []).map((row: { id: string }) => row.id)])
  )

  const { data, error } = await supabase
    .from('tutoring_sessions')
    .select(`
      id,
      session_date,
      duration_minutes,
      status,
      notes,
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
    .in('student_id', studentIds)
    .in('status', ['completed', 'scheduled', 'cancelled'])
    .order('session_date', { ascending: false })
    .limit(300)

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
        status: session.status ?? 'scheduled',
        notes: session.notes ?? null,
        tutor_name: tutor?.full_name ?? null,
        subject_name: subject?.name ?? null,
        level_name: level?.level_name ?? null,
      }
    })

  return NextResponse.json({ sessions })
}
