import { getUserProfile } from '@/lib/actions/auth'
import { listBookedSlots } from '@/lib/actions/booked-slots'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function BookedSlotsAdminPage() {
  const profile = await getUserProfile()
  if (!profile || profile.role !== 'admin') {
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">Brak dostępu. Ta strona jest dostępna tylko dla administratorów.</p>
      </div>
    )
  }

  type BookedSlotWithRelations = Awaited<ReturnType<typeof listBookedSlots>> extends infer T
    ? T extends Array<infer U>
      ? U & {
          student_assignments?: {
            students?: { id: string; first_name: string; last_name: string } | null
            subjects?: { id: string; name: string } | null
            subject_levels?: { id: string; level_name: string } | null
          } | null
          profiles?: { id: string; full_name: string } | null
        }
      : never
    : never

  const slots = (await listBookedSlots({ scope: 'admin' })) as BookedSlotWithRelations[]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Przypisane sloty (cykliczne)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tutor</TableHead>
              <TableHead>Uczeń</TableHead>
              <TableHead>Przedmiot</TableHead>
              <TableHead>Poziom</TableHead>
              <TableHead>Dzień</TableHead>
              <TableHead>Godziny</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slots.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.profiles?.full_name ?? '—'}</TableCell>
                <TableCell>{s.student_assignments?.students ? `${s.student_assignments.students.first_name} ${s.student_assignments.students.last_name}` : '—'}</TableCell>
                <TableCell>{s.student_assignments?.subjects?.name ?? '—'}</TableCell>
                <TableCell>{s.student_assignments?.subject_levels?.level_name ?? '—'}</TableCell>
                <TableCell>{s.weekday}</TableCell>
                <TableCell>{s.start_time.substring(0,5)}–{s.end_time.substring(0,5)}</TableCell>
                <TableCell>{s.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}


