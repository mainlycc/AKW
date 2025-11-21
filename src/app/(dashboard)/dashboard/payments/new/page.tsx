import { getUserProfile } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PaymentForm } from './payment-form'
import { getOrCreateBillingPeriod } from '@/lib/actions/payments'

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{
    studentId?: string
    billingPeriodId?: string
    month?: string
    year?: string
  }>
}) {
  const profile = await getUserProfile()

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          Brak dostępu. Ta strona jest dostępna tylko dla administratorów.
        </p>
      </div>
    )
  }

  const params = await searchParams
  const supabase = await createClient()
  const currentDate = new Date()
  const month = params.month
    ? parseInt(params.month)
    : currentDate.getMonth() + 1
  const year = params.year
    ? parseInt(params.year)
    : currentDate.getFullYear()

  // Get all students with their primary parents
  const { data: studentsData } = await supabase
    .from('students')
    .select(
      `
      id,
      first_name,
      last_name,
      student_parents!inner (
        is_primary,
        parents (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      )
    `
    )
    .eq('student_parents.is_primary', true)
    .order('last_name')

  // Transform data
  interface ParentData {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
  }

  interface StudentParentData {
    is_primary: boolean
    parents: ParentData | ParentData[]
  }

  interface StudentData {
    id: string
    first_name: string
    last_name: string
    student_parents: StudentParentData | StudentParentData[]
  }

  const students =
    studentsData?.map((student: StudentData) => {
      // Extract parent data - handle both single object and array
      let parentData: ParentData | undefined
      
      if (Array.isArray(student.student_parents)) {
        const firstParent = student.student_parents[0]
        if (firstParent) {
          parentData = Array.isArray(firstParent.parents)
            ? firstParent.parents[0]
            : firstParent.parents
        }
      } else {
        parentData = Array.isArray(student.student_parents.parents)
          ? student.student_parents.parents[0]
          : student.student_parents.parents
      }

      return {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        parent: parentData
          ? {
              id: parentData.id,
              first_name: parentData.first_name,
              last_name: parentData.last_name,
              email: parentData.email,
              phone: parentData.phone,
            }
          : undefined,
      }
    }) || []

  // Get billing period ID if provided
  let billingPeriodId = params.billingPeriodId
  if (!billingPeriodId && params.month && params.year) {
    billingPeriodId = await getOrCreateBillingPeriod(
      parseInt(params.month),
      parseInt(params.year)
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Dodaj płatność</h1>
        <p className="text-muted-foreground">
          Zarejestruj nową płatność dla wybranego ucznia
        </p>
      </div>
      <div className="max-w-2xl">
        <PaymentForm
          students={students}
          currentMonth={month}
          currentYear={year}
          initialStudentId={params.studentId}
          initialBillingPeriodId={billingPeriodId}
        />
      </div>
    </div>
  )
}

