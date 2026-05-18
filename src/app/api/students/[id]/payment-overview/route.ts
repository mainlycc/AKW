import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStudentPaymentOverview } from '@/lib/actions/student-payment-overview'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params

  if (!studentId) {
    return NextResponse.json({ error: 'Missing student id' }, { status: 400 })
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const overview = await getStudentPaymentOverview(studentId)
    return NextResponse.json(overview)
  } catch (error) {
    console.error('Error fetching student payment overview:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment overview' },
      { status: 500 }
    )
  }
}
