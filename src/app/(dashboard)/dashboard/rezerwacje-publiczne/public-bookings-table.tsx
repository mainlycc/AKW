'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { toast } from 'sonner'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { IconTrash } from '@tabler/icons-react'
import { updateBookingStatus, deleteBooking } from './actions'
import { ConfirmDialog } from '@/components/confirm-dialog'

type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

interface PublicBookingRow {
  id: string
  tutor_id: string
  student_id: string | null
  assignment_id: string | null
  booked_slot_id: string | null
  is_recurring: boolean
  status: BookingStatus
  request_date: string
  start_time: string
  end_time: string
  created_at: string
  student_first_name: string
  student_last_name: string
  contact_email: string
  contact_phone: string | null
  notes: string | null
  tutor?: { id: string; full_name: string } | null
  assignment?: { id: string; status: string } | null
  student?: { id: string; first_name: string; last_name: string } | null
  subject?: { id: string; name: string } | null
  subject_level?: { id: string; level_name: string } | null
}

interface PublicBookingsTableProps {
  bookings: PublicBookingRow[]
}

const statusVariant: Record<BookingStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pending: { label: 'Oczekujące', variant: 'secondary' },
  confirmed: { label: 'Potwierdzone', variant: 'default' },
  cancelled: { label: 'Anulowane', variant: 'outline' },
}

const formatTime = (time: string) => {
  // Normalize time: remove seconds if present (TIME from PostgreSQL can be HH:mm:ss or HH:mm)
  const timeParts = time.split(':')
  return `${timeParts[0]}:${timeParts[1] || '00'}`
}

const formatDateTime = (date: string, time: string) => {
  try {
    // Normalize time: remove seconds if present (TIME from PostgreSQL can be HH:mm:ss or HH:mm)
    // Extract only hours and minutes
    const normalizedTime = formatTime(time)
    
    // Build ISO string: YYYY-MM-DDTHH:mm:00
    const dateTimeString = `${date}T${normalizedTime}:00`
    const parsed = new Date(dateTimeString)
    
    // Validate parsed date
    if (isNaN(parsed.getTime())) {
      console.warn('Invalid date/time:', { date, time, dateTimeString })
      return `${date} ${normalizedTime}`
    }
    
    return format(parsed, "dd MMM yyyy, HH:mm", { locale: pl })
  } catch (error) {
    // Fallback: return raw values if parsing fails
    console.error('Error parsing date/time:', { date, time, error })
    return `${date} ${formatTime(time)}`
  }
}

export function PublicBookingsTable({ bookings }: PublicBookingsTableProps) {
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogContent, setConfirmDialogContent] = useState<{ title: string; description: string; onConfirm: () => void }>({ title: '', description: '', onConfirm: () => {} })

  const filteredBookings = bookings.filter(
    (booking) => {
      const searchLower = search.toLowerCase()
      const studentLabel = booking.student
        ? `${booking.student.first_name} ${booking.student.last_name}`
        : `${booking.student_first_name} ${booking.student_last_name}`
      const tutorName = booking.tutor?.full_name ?? ''
      const subjectLabel = booking.subject
        ? `${booking.subject.name}${booking.subject_level ? ` · ${booking.subject_level.level_name}` : ''}`
        : ''
      
      return (
        studentLabel.toLowerCase().includes(searchLower) ||
        tutorName.toLowerCase().includes(searchLower) ||
        subjectLabel.toLowerCase().includes(searchLower) ||
        booking.contact_email.toLowerCase().includes(searchLower) ||
        (booking.contact_phone?.toLowerCase().includes(searchLower) ?? false)
      )
    }
  )

  const selectedBookings = filteredBookings.filter((booking) => selectedIds.has(booking.id))
  const selectedPending = selectedBookings.filter((booking) => booking.status === 'pending')
  const selectedCancellable = selectedBookings.filter(
    (booking) => booking.status === 'pending' || booking.status === 'confirmed'
  )

  const handleConfirmSelected = () => {
    if (selectedPending.length === 0) return

    startTransition(async () => {
      try {
        for (const booking of selectedPending) {
          await updateBookingStatus(booking.id, 'confirmed')
        }
        setSelectedIds(new Set())
        toast.success(
          selectedPending.length === 1
            ? 'Rezerwacja została potwierdzona.'
            : `Potwierdzono ${selectedPending.length} rezerwacji.`
        )
      } catch (error) {
        console.error(error)
        toast.error('Nie udało się potwierdzić rezerwacji.')
      }
    })
  }

  const handleCancelSelected = () => {
    if (selectedCancellable.length === 0) return

    startTransition(async () => {
      try {
        for (const booking of selectedCancellable) {
          await updateBookingStatus(booking.id, 'cancelled')
        }
        setSelectedIds(new Set())
        toast.success(
          selectedCancellable.length === 1
            ? 'Rezerwacja została anulowana.'
            : `Anulowano ${selectedCancellable.length} rezerwacji.`
        )
      } catch (error) {
        console.error(error)
        toast.error('Nie udało się anulować rezerwacji.')
      }
    })
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    
    const count = selectedIds.size
    setConfirmDialogContent({
      title: 'Usuwanie rezerwacji',
      description: `Czy na pewno chcesz usunąć ${count} ${count === 1 ? 'rezerwację' : 'rezerwacji'}?`,
      onConfirm: async () => {
        for (const id of selectedIds) {
          try {
            await deleteBooking(id)
          } catch (error) {
            console.error('Error deleting booking:', error)
            toast.error('Nie udało się usunąć niektórych rezerwacji.')
          }
        }
        setSelectedIds(new Set())
        toast.success(`Usunięto ${count} ${count === 1 ? 'rezerwację' : 'rezerwacji'}.`)
      }
    })
    setConfirmDialogOpen(true)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBookings.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredBookings.map(b => b.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  if (bookings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Brak zgłoszeń. Gdy ktoś zarezerwuje termin przez stronę publiczną, zobaczysz go tutaj.
      </p>
    )
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Szukaj rezerwacji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button
          size="sm"
          disabled={isPending || selectedPending.length === 0}
          onClick={handleConfirmSelected}
        >
          Potwierdź{selectedPending.length > 0 ? ` (${selectedPending.length})` : ''}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending || selectedCancellable.length === 0}
          onClick={handleCancelSelected}
        >
          Anuluj{selectedCancellable.length > 0 ? ` (${selectedCancellable.length})` : ''}
        </Button>
        {selectedIds.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteSelected}
          >
            <IconTrash className="mr-2 h-4 w-4" />
            Usuń zaznaczone ({selectedIds.size})
          </Button>
        )}
      </div>

      <div className="min-w-0 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === filteredBookings.length && filteredBookings.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Utworzono</TableHead>
              <TableHead>Przedmiot</TableHead>
              <TableHead>Tutor</TableHead>
              <TableHead>Uczeń</TableHead>
              <TableHead>Termin</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="max-w-[160px]">Notatki</TableHead>
            </TableRow>
          </TableHeader>
        <TableBody>
          {filteredBookings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                Brak rezerwacji do wyświetlenia
              </TableCell>
            </TableRow>
          ) : (
            filteredBookings.map((booking) => {
              const statusMeta = statusVariant[booking.status]
              const studentLabel = booking.student
                ? `${booking.student.first_name} ${booking.student.last_name}`
                : `${booking.student_first_name} ${booking.student_last_name}`
              const subjectLabel = booking.subject
                ? `${booking.subject.name}${booking.subject_level ? ` · ${booking.subject_level.level_name}` : ''}`
                : '—'

              return (
                <TableRow key={booking.id}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(booking.id)}
                      onCheckedChange={() => toggleSelectOne(booking.id)}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(booking.created_at), "dd MMM yyyy, HH:mm", { locale: pl })}
                  </TableCell>
                <TableCell className="text-sm">{subjectLabel}</TableCell>
                <TableCell className="font-medium">
                  {booking.tutor?.full_name ?? '—'}
                </TableCell>
                <TableCell>{studentLabel}</TableCell>
                <TableCell>
                  {formatDateTime(booking.request_date, booking.start_time)} &ndash; {formatTime(booking.end_time)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{booking.is_recurring ? 'Cykliczna' : 'Jednorazowa'}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  <div>{booking.contact_email}</div>
                  {booking.contact_phone && (
                    <div className="text-muted-foreground">{booking.contact_phone}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                </TableCell>
                <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                  {booking.notes || '—'}
                </TableCell>
              </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      </div>

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title={confirmDialogContent.title}
        description={confirmDialogContent.description}
        onConfirm={confirmDialogContent.onConfirm}
        confirmText="Usuń"
        cancelText="Anuluj"
      />
    </div>
  )
}


