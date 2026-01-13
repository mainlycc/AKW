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
import { sendGroupMessageToAllMyStudents } from './actions'
import { toast } from 'sonner'
import { IconAlertCircle, IconMail } from '@tabler/icons-react'

interface TutorGroupMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tutorId: string
  studentsCount: number
}

export function TutorGroupMessageDialog({
  open,
  onOpenChange,
  tutorId,
  studentsCount,
}: TutorGroupMessageDialogProps) {
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
      const result = await sendGroupMessageToAllMyStudents(tutorId, message)

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
          <DialogTitle>Wyślij wiadomość do wszystkich uczniów</DialogTitle>
          <DialogDescription>
            Wyślij wiadomość do głównych rodziców wszystkich swoich uczniów ({studentsCount} {studentsCount === 1 ? 'uczeń' : studentsCount < 5 ? 'uczniów' : 'uczniów'})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {studentsCount === 0 ? (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
              <div className="flex items-start gap-2">
                <IconAlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Brak uczniów
                  </p>
                  <p className="text-sm text-destructive/80 mt-1">
                    Nie masz przypisanych aktywnych uczniów. Nie można wysłać wiadomości.
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
                  placeholder="Wpisz treść wiadomości do rodziców swoich uczniów..."
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
                  Wiadomość zostanie wysłana do głównych rodziców wszystkich Twoich uczniów ({studentsCount} {studentsCount === 1 ? 'uczeń' : studentsCount < 5 ? 'uczniów' : 'uczniów'}).
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
            disabled={loading || studentsCount === 0 || !message.trim()}
          >
            {loading ? 'Wysyłanie...' : 'Wyślij wiadomość'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

