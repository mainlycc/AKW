'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { sendGroupMessageToTutors } from './actions'
import { toast } from 'sonner'
import { IconAlertCircle, IconMail, IconPhone } from '@tabler/icons-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { NotificationChannel } from '@/lib/types/notifications'

interface TutorWithStats {
  id: string
  full_name: string
  email: string
  phone: string | null
  bio: string | null
  hourly_rate: number | null
  created_at: string
  activeAssignments: number
  totalHours: number
  totalSessions?: number
}

interface GroupMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedTutors: TutorWithStats[]
}

export function GroupMessageDialog({
  open,
  onOpenChange,
  selectedTutors,
}: GroupMessageDialogProps) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState<NotificationChannel>('email')

  const handleSend = async () => {
    if (!message.trim()) {
      setError('Treść wiadomości nie może być pusta')
      return
    }

     if ((channel === 'sms' || channel === 'both') && tutorsMissingPhone.length > 0) {
      setError('Nie wszyscy tutorzy mają podany numer telefonu. Uzupełnij brakujące numery lub wybierz kanał Email.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const tutorIds = selectedTutors.map(t => t.id)
      const result = await sendGroupMessageToTutors(tutorIds, message, channel)

      if (result.success) {
        const sentCount = result.sentCount ?? 0
        toast.success(
          `Wysłano ${sentCount} ${sentCount === 1 ? 'wiadomość' : sentCount < 5 ? 'wiadomości' : 'wiadomości'}`
        )
        if (result.error) {
          toast.warning(result.error)
        }
        setMessage('')
        onOpenChange(false)
      } else {
        setError(result.error || 'Nie udało się wysłać wiadomości')
        toast.error(result.error || 'Nie udało się wysłać wiadomości')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Nieoczekiwany błąd'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Sprawdź czy tutorzy mają emaile
  const tutorsWithEmails = selectedTutors.filter(
    (tutor) => tutor.email && tutor.email.trim()
  )

  const hasNoEmails = tutorsWithEmails.length === 0 && selectedTutors.length > 0

  // Sprawdź czy tutorzy mają numery telefonów (dla SMS)
  const tutorsWithPhones = selectedTutors.filter(
    (tutor) => tutor.phone && tutor.phone.trim()
  )

  const tutorsMissingPhone = selectedTutors.filter(
    (tutor) => !tutorsWithPhones.some((t) => t.id === tutor.id)
  )

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setMessage('')
      setError(null)
      setChannel('email')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wyślij wiadomość grupową</DialogTitle>
          <DialogDescription>
            Wyślij wiadomość do {selectedTutors.length}{' '}
            {selectedTutors.length === 1 ? 'zaznaczonego tutora' : 'zaznaczonych tutorów'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {hasNoEmails ? (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
              <div className="flex items-start gap-2">
                <IconAlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Brak adresów email
                  </p>
                  <p className="text-sm text-destructive/80 mt-1">
                    Nie znaleziono tutorów z adresami email dla zaznaczonych tutorów. 
                    Upewnij się, że tutorzy mają wypełnione adresy email.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="channel">Kanał powiadomienia</Label>
                <Select
                  value={channel}
                  onValueChange={(value) => setChannel(value as NotificationChannel)}
                  disabled={loading}
                >
                  <SelectTrigger id="channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="both">Email + SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Treść wiadomości</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value)
                    setError(null)
                  }}
                  placeholder="Wpisz treść wiadomości do tutorów..."
                  rows={8}
                  disabled={loading}
                  className="resize-none"
                />
                {error && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                    <div className="flex items-start gap-2">
                      <IconAlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-md bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  <IconMail className="inline h-4 w-4 mr-1" />
                  Email: wiadomość może być wysłana do {tutorsWithEmails.length}{' '}
                  {tutorsWithEmails.length === 1 ? 'tutora' : 'tutorów'} z adresami email.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  <IconPhone className="inline h-4 w-4 mr-1" />
                  SMS: numery telefonów znaleziono dla {tutorsWithPhones.length}{' '}
                  {tutorsWithPhones.length === 1 ? 'tutora' : 'tutorów'}.
                </p>
              </div>

              {(channel === 'sms' || channel === 'both') && tutorsMissingPhone.length > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
                  <div className="flex items-start gap-2">
                    <IconAlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                    <p className="text-sm text-amber-700">
                      Dla części tutorów nie znaleziono numeru telefonu. Uzupełnij numery telefonów
                      lub wybierz kanał Email, aby wysłać wiadomość.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Anuluj
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              loading ||
              hasNoEmails ||
              !message.trim() ||
              ((channel === 'sms' || channel === 'both') && tutorsMissingPhone.length > 0)
            }
          >
            {loading ? 'Wysyłanie...' : 'Wyślij wiadomość'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

