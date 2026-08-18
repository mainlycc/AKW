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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createInvitation } from '@/lib/actions/invitations'
import type { NotificationChannel } from '@/lib/types/notifications'

interface InvitationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InvitationDialog({ open, onOpenChange }: InvitationDialogProps) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [channel, setChannel] = useState<NotificationChannel>('email')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if ((channel === 'sms' || channel === 'both') && !phone.trim()) {
      toast.error('Aby wysłać SMS lub SMS + email, podaj numer telefonu tutora.')
      return
    }

    setIsLoading(true)

    const result = await createInvitation(email, channel, phone || undefined)

    if (result.success && result.invitation) {
      const channelLabel =
        channel === 'email' ? 'Email z zaproszeniem został wysłany' :
        channel === 'sms' ? 'SMS z zaproszeniem został wysłany' :
        'Email i SMS z zaproszeniem zostały wysłane'

      toast.success(`${channelLabel} do ${email}${phone ? ` / ${phone}` : ''}`)
      setEmail('')
      setPhone('')
      setChannel('email')
      onOpenChange(false)
      router.refresh()
    } else {
      toast.error(result.error || 'Nie udało się wysłać zaproszenia')
    }

    setIsLoading(false)
  }

  const handleClose = () => {
    setEmail('')
    setPhone('')
    setChannel('email')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wyślij zaproszenie</DialogTitle>
          <DialogDescription>
            Wpisz adres email tutora. Wyślemy zaproszenie z linkiem do rejestracji ważnym przez 7 dni.
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

            <div className="space-y-2">
              <Label htmlFor="channel">Kanał powiadomienia</Label>
              <Select
                value={channel}
                onValueChange={(value) => setChannel(value as NotificationChannel)}
                disabled={isLoading}
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
              <Label htmlFor="phone">
                Numer telefonu tutora (dla SMS)
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+48 600 000 000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Wymagany, jeśli wybierzesz kanał SMS lub Email + SMS.
              </p>
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
              {isLoading
                ? 'Wysyłanie...'
                : channel === 'email'
                  ? 'Wyślij email'
                  : channel === 'sms'
                    ? 'Wyślij SMS'
                    : 'Wyślij email i SMS'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
