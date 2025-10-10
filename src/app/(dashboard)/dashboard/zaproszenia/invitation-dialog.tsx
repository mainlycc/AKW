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
import { IconCopy } from '@tabler/icons-react'

interface InvitationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InvitationDialog({ open, onOpenChange }: InvitationDialogProps) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const result = await createInvitation(email)

    if (result.success && result.invitation) {
      toast.success('Zaproszenie zostało utworzone')
      const url = `${window.location.origin}/register?token=${result.invitation.token}`
      setInvitationUrl(url)
      setEmail('')
      router.refresh()
    } else {
      toast.error(result.error || 'Nie udało się utworzyć zaproszenia')
    }

    setIsLoading(false)
  }

  const handleClose = () => {
    setEmail('')
    setInvitationUrl(null)
    onOpenChange(false)
  }

  const copyToClipboard = () => {
    if (invitationUrl) {
      navigator.clipboard.writeText(invitationUrl)
      toast.success('Link skopiowany do schowka')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {invitationUrl ? 'Zaproszenie utworzone' : 'Utwórz zaproszenie dla tutora'}
          </DialogTitle>
          <DialogDescription>
            {invitationUrl 
              ? 'Zaproszenie zostało pomyślnie utworzone. Skopiuj link i wyślij go do nowego tutora.'
              : 'Wpisz adres email osoby, którą chcesz zaprosić jako tutora. Otrzyma ona link do rejestracji ważny przez 7 dni.'
            }
          </DialogDescription>
        </DialogHeader>

        {invitationUrl ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Link zaproszenia</Label>
              <div className="flex gap-2">
                <Input
                  value={invitationUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                >
                  <IconCopy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Ten link wygaśnie za 7 dni
              </p>
            </div>
          </div>
        ) : (
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
                {isLoading ? 'Tworzenie...' : 'Utwórz zaproszenie'}
              </Button>
            </DialogFooter>
          </form>
        )}

        {invitationUrl && (
          <DialogFooter>
            <Button onClick={handleClose}>Zamknij</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

