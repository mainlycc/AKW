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
import { IconAlertCircle, IconMail } from '@tabler/icons-react'

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

  const handleSend = async () => {
    if (!message.trim()) {
      setError('Treść wiadomości nie może być pusta')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const tutorIds = selectedTutors.map(t => t.id)
      const result = await sendGroupMessageToTutors(tutorIds, message)

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
  const tutorsWithEmails = selectedTutors.filter(tutor => 
    tutor.email && tutor.email.trim()
  )

  const hasNoEmails = tutorsWithEmails.length === 0 && selectedTutors.length > 0

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setMessage('')
      setError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wyślij wiadomość grupową</DialogTitle>
          <DialogDescription>
            Wyślij wiadomość do {selectedTutors.length} {selectedTutors.length === 1 ? 'zaznaczonego tutora' : 'zaznaczonych tutorów'}
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
                  Wiadomość zostanie wysłana do {tutorsWithEmails.length} {tutorsWithEmails.length === 1 ? 'tutora' : 'tutorów'} z adresami email.
                </p>
              </div>
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
            disabled={loading || hasNoEmails || !message.trim()}
          >
            {loading ? 'Wysyłanie...' : 'Wyślij wiadomość'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

