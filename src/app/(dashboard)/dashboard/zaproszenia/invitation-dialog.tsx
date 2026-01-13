'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createInvitation } from '@/lib/actions/invitations'

interface InvitationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InvitationDialog({ open, onOpenChange }: InvitationDialogProps) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const result = await createInvitation(email)

    if (result.success && result.invitation) {
      toast.success(`Email z zaproszeniem został wysłany do ${email}`)
      setEmail('')
      onOpenChange(false)
      router.refresh()
    } else {
      toast.error(result.error || 'Nie udało się wysłać zaproszenia')
    }

    setIsLoading(false)
  }

  const handleClose = () => {
    setEmail('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wyślij zaproszenie email</DialogTitle>
          <DialogDescription>
            Wpisz adres email tutor. Wyślemy email z linkiem do rejestracji ważnym przez 7 dni.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adres email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tutor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Wysyłanie emaila...' : 'Wyślij email'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
