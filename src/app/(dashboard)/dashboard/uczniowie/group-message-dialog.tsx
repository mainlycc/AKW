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
import { sendGroupMessage } from './actions'
import { toast } from 'sonner'
import { IconAlertCircle, IconMail } from '@tabler/icons-react'

interface StudentExtended {
  id: string
  first_name: string
  last_name: string
  student_parents?: Array<{
    id: string
    is_primary: boolean
    parents: {
      id: string
      first_name: string
      last_name: string
      email: string
      phone: string | null
      parent_type: string
    }
  }>
}

interface GroupMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedStudents: StudentExtended[]
}

export function GroupMessageDialog({
  open,
  onOpenChange,
  selectedStudents,
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
      const studentIds = selectedStudents.map(s => s.id)
      const result = await sendGroupMessage(studentIds, message)

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

  // Sprawdź czy uczniowie mają rodziców z emailami (najpierw główny, jeśli nie ma - jakikolwiek z emailem)
  const studentsWithParents = selectedStudents.filter(student => {
    const parents = student.student_parents || []
    
    // Najpierw szukaj głównego rodzica z emailem
    const primaryParent = parents.find(sp => sp.is_primary && sp.parents && sp.parents.email && sp.parents.email.trim())
    
    // Jeśli jest główny z emailem, użyj go
    if (primaryParent) return true
    
    // Jeśli nie ma głównego z emailem, sprawdź czy jest jakikolwiek rodzic z emailem
    const anyParentWithEmail = parents.find(sp => sp.parents && sp.parents.email && sp.parents.email.trim())
    return !!anyParentWithEmail
  })

  const hasNoEmails = studentsWithParents.length === 0 && selectedStudents.length > 0

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setMessage('')
      setError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Wyślij wiadomość grupową</DialogTitle>
          <DialogDescription>
            Wyślij wiadomość do głównych rodziców {selectedStudents.length} {selectedStudents.length === 1 ? 'zaznaczonego ucznia' : 'zaznaczonych uczniów'}
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
                    Nie znaleziono rodziców z adresami email dla zaznaczonych uczniów. 
                    Upewnij się, że uczniowie mają przypisanych głównych rodziców z wypełnionymi adresami email.
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
                  placeholder="Wpisz treść wiadomości do rodziców..."
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
                  Wiadomość zostanie wysłana do głównych rodziców {studentsWithParents.length} {studentsWithParents.length === 1 ? 'ucznia' : 'uczniów'} z adresami email.
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

