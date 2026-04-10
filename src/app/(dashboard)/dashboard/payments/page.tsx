import { getUserProfile } from '@/lib/actions/auth'
import { getPayments, type PaymentFilters } from '@/lib/actions/payments'
import { PaymentsTable } from './payments-table'
import { createClient } from '@/lib/supabase/server'

function normalizeName(firstName: string, lastName: string) {
  return `${(firstName || '').trim().toLowerCase()} ${(lastName || '').trim().toLowerCase()}`
    .replace(/\s+/g, ' ')
    .trim()
}

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

  // Get students (with parent for create dialog) and parents for filters
  const [studentsResult, parentsResult] = await Promise.all([
    supabase
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
      .order('last_name'),
    supabase
      .from('parents')
      .select('id, first_name, last_name')
      .order('last_name'),
  ])

  const studentsRaw =
    (studentsResult.data || []).map((s) => {
      const parentsArray = Array.isArray(s.student_parents)
        ? s.student_parents
        : s.student_parents
          ? [s.student_parents]
          : []

      const normalized = parentsArray
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((sp: any) => {
          const p = sp?.parents
            ? (Array.isArray(sp.parents) ? sp.parents[0] : sp.parents)
            : null
          return {
            is_primary: Boolean(sp?.is_primary),
            parent: p as
              | {
                  id: string
                  first_name: string
                  last_name: string
                  email: string
                  phone: string | null
                }
              | null,
          }
        })
        .filter((x) => Boolean(x.parent))

      const hasContact = (p: { email: string; phone: string | null }) =>
        Boolean((p.email && p.email.trim()) || (p.phone && p.phone.trim()))

      const primaryWithContact = normalized.find((x) => x.is_primary && x.parent && hasContact(x.parent))
      const anyWithContact = normalized.find((x) => x.parent && hasContact(x.parent))
      const firstAny = normalized[0]
      const selected = (primaryWithContact || anyWithContact || firstAny)?.parent || undefined

      return {
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        parent: selected
          ? {
              id: selected.id,
              first_name: selected.first_name,
              last_name: selected.last_name,
              email: selected.email,
              phone: selected.phone,
            }
          : undefined,
      }
    }) || []

  // Usuń puste/błędne rekordy oraz duplikaty (np. kilka rekordów z tym samym imię+nazwisko)
  const students = (() => {
    const byNormalized = new Map<
      string,
      {
        id: string
        first_name: string
        last_name: string
        parent?: { id: string; first_name: string; last_name: string; email: string; phone: string | null }
      }
    >()

    // stabilne sortowanie: najpierw po nazwisku, potem po imieniu
    const sorted = [...studentsRaw].sort((a, b) => {
      const al = (a.last_name || '').trim()
      const bl = (b.last_name || '').trim()
      const af = (a.first_name || '').trim()
      const bf = (b.first_name || '').trim()
      const c1 = al.localeCompare(bl, 'pl', { sensitivity: 'base' })
      if (c1 !== 0) return c1
      return af.localeCompare(bf, 'pl', { sensitivity: 'base' })
    })

    for (const s of sorted) {
      const first = (s.first_name || '').trim()
      const last = (s.last_name || '').trim()
      if (!first || !last) continue

      const key = normalizeName(first, last)
      if (!key) continue

      if (!byNormalized.has(key)) {
        byNormalized.set(key, {
          id: s.id,
          first_name: first,
          last_name: last,
          parent: s.parent,
        })
      }
    }

    return Array.from(byNormalized.values())
  })()
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

