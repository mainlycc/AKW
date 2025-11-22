import { getUserProfile } from '@/lib/actions/auth'
import { getPayments, type PaymentFilters } from '@/lib/actions/payments'
import { PaymentsTable } from './payments-table'
import { createClient } from '@/lib/supabase/server'

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    studentId?: string
    billingPeriodId?: string
    [key: string]: string | undefined
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

  // Build filters
  const filters: PaymentFilters = {}
  if (params.studentId) {
    filters.studentId = params.studentId
  }

  // Get payments
  const payments = await getPayments(filters)

  // Get students and parents for filters
  const [studentsResult, parentsResult] = await Promise.all([
    supabase
      .from('students')
      .select('id, first_name, last_name')
      .order('last_name'),
    supabase
      .from('parents')
      .select('id, first_name, last_name')
      .order('last_name'),
  ])

  const students = studentsResult.data || []
  const parents = parentsResult.data || []

  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground">
          Przegląd wszystkich płatności z możliwością edycji i eksportu
        </p>
      </div>
      <PaymentsTable payments={payments} students={students} parents={parents} />
    </div>
  )
}

