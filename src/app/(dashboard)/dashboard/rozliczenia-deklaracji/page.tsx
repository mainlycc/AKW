import { getUserProfile } from '@/lib/actions/auth'
import { getAllStudentBillingsFromDeclarations } from '@/lib/actions/billing'
import { DeclarationBillingsTable } from './declaration-billings-table'
import { createClient } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels/reports-declarations'

export default async function DeclarationBillingsPage() {
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

  let billings
  try {
    billings = await getAllStudentBillingsFromDeclarations()
  } catch (error) {
    console.error('Error fetching billings from declarations:', error)
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          Błąd podczas pobierania danych: {error instanceof Error ? error.message : 'Nieznany błąd'}
        </p>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: studentsData, error: studentsError } = await supabase
    .from('students')
    .select(`
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
    `)
    .order('last_name')

  if (studentsError) {
    console.error('Error fetching students:', studentsError)
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          Błąd podczas pobierania danych uczniów: {studentsError.message}
        </p>
      </div>
    )
  }

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
      let parentData: ParentData | undefined
      
      const parentsArray = Array.isArray(student.student_parents)
        ? student.student_parents
        : [student.student_parents]
      
      const primaryParentWithEmail = parentsArray.find(sp => {
        const parent = Array.isArray(sp.parents) ? sp.parents[0] : sp.parents
        return sp.is_primary && parent && parent.email && parent.email.trim()
      })
      
      if (primaryParentWithEmail) {
        parentData = Array.isArray(primaryParentWithEmail.parents)
          ? primaryParentWithEmail.parents[0]
          : primaryParentWithEmail.parents
      } else {
        const parentWithEmail = parentsArray.find(sp => {
          const parent = Array.isArray(sp.parents) ? sp.parents[0] : sp.parents
          return parent && parent.email && parent.email.trim()
        })
        
        if (parentWithEmail) {
          parentData = Array.isArray(parentWithEmail.parents)
            ? parentWithEmail.parents[0]
            : parentWithEmail.parents
        } else if (parentsArray.length > 0) {
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
          {LABELS.billingFromNextMonthPlanDescription}
        </p>
      </div>
      <DeclarationBillingsTable
        billings={billings}
        students={students}
      />
    </div>
  )
}
