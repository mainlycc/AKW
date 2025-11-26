import { getUserProfile } from '@/lib/actions/auth'
import { getStudentBillingsFromReports } from '@/lib/actions/billing'
import { BillingFromReportsTable } from './billing-from-reports-table'
import { createClient } from '@/lib/supabase/server'

export default async function BillingFromReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
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
  const currentDate = new Date()
  const monthParam = params.month ? parseInt(params.month) : currentDate.getMonth() + 1
  const yearParam = params.year ? parseInt(params.year) : currentDate.getFullYear()
  
  // Validate month and year
  const month = (monthParam >= 1 && monthParam <= 12) ? monthParam : currentDate.getMonth() + 1
  const year = (yearParam >= 2000 && yearParam <= 2100) ? yearParam : currentDate.getFullYear()

  // Get billings calculated from tutor reports
  let billings
  try {
    billings = await getStudentBillingsFromReports(month, year)
  } catch (error) {
    console.error('Error fetching billings from reports:', error)
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          Błąd podczas pobierania danych: {error instanceof Error ? error.message : 'Nieznany błąd'}
        </p>
      </div>
    )
  }

  // Get all students with their parents for payment dialog
  const supabase = await createClient()
  const { data: studentsData } = await supabase
    .from('students')
    .select(
      `
      id,
      first_name,
      last_name,
      student_parents (
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
      // Extract parent data - najpierw szukaj głównego z emailem, jeśli nie ma - pierwszego dostępnego z emailem
      let parentData: ParentData | undefined
      
      // Przetwórz student_parents do tablicy
      const parentsArray = Array.isArray(student.student_parents)
        ? student.student_parents
        : [student.student_parents]
      
      // Najpierw szukaj głównego rodzica z emailem
      const primaryParentWithEmail = parentsArray.find(sp => {
        const parent = Array.isArray(sp.parents) ? sp.parents[0] : sp.parents
        return sp.is_primary && parent && parent.email && parent.email.trim()
      })
      
      if (primaryParentWithEmail) {
        parentData = Array.isArray(primaryParentWithEmail.parents)
          ? primaryParentWithEmail.parents[0]
          : primaryParentWithEmail.parents
      } else {
        // Jeśli nie ma głównego z emailem, użyj pierwszego dostępnego z emailem
        const parentWithEmail = parentsArray.find(sp => {
          const parent = Array.isArray(sp.parents) ? sp.parents[0] : sp.parents
          return parent && parent.email && parent.email.trim()
        })
        
        if (parentWithEmail) {
          parentData = Array.isArray(parentWithEmail.parents)
            ? parentWithEmail.parents[0]
            : parentWithEmail.parents
        } else if (parentsArray.length > 0) {
          // Ostateczny fallback - pierwszy dostępny rodzic
          const firstParent = parentsArray[0]
          parentData = Array.isArray(firstParent.parents)
            ? firstParent.parents[0]
            : firstParent.parents
        }
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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground">
          Przegląd należności i płatności dla wybranego okresu (obliczone na podstawie raportów tutorów)
        </p>
      </div>
      <BillingFromReportsTable
        billings={billings}
        currentMonth={month}
        currentYear={year}
        students={students}
      />
    </div>
  )
}

