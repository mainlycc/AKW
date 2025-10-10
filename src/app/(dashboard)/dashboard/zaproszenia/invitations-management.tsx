'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { IconPlus, IconCopy, IconX, IconCheck } from '@tabler/icons-react'
import { toast } from 'sonner'
import type { TutorInvitation } from '@/lib/types/database.types'
import { InvitationDialog } from './invitation-dialog'
import { cancelInvitation } from '@/lib/actions/invitations'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface InvitationsManagementProps {
  invitations: TutorInvitation[]
}

export function InvitationsManagement({ invitations }: InvitationsManagementProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedInvitationId, setSelectedInvitationId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const router = useRouter()

  const getInvitationUrl = (token: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/register?token=${token}`
    }
    return ''
  }

  const copyToClipboard = (token: string) => {
    const url = getInvitationUrl(token)
    navigator.clipboard.writeText(url)
    toast.success('Link skopiowany do schowka')
  }

  const handleCancelInvitation = async () => {
    if (!selectedInvitationId) return

    setIsProcessing(true)
    const result = await cancelInvitation(selectedInvitationId)
    
    if (result.success) {
      toast.success('Zaproszenie zostało anulowane')
      router.refresh()
    } else {
      toast.error(result.error || 'Nie udało się anulować zaproszenia')
    }
    
    setIsProcessing(false)
    setCancelDialogOpen(false)
    setSelectedInvitationId(null)
  }

  const openCancelDialog = (id: string) => {
    setSelectedInvitationId(id)
    setCancelDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Oczekujące</Badge>
      case 'accepted':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Zaakceptowane</Badge>
      case 'expired':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">Wygasłe</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Zaproszenia dla tutorów</h2>
            <p className="text-muted-foreground">
              Zarządzaj zaproszeniami dla nowych tutorów
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <IconPlus className="mr-2 h-4 w-4" />
            Utwórz zaproszenie
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data utworzenia</TableHead>
                <TableHead>Data wygaśnięcia</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Brak zaproszeń
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                    <TableCell>{formatDate(invitation.created_at)}</TableCell>
                    <TableCell>
                      <span className={isExpired(invitation.expires_at) && invitation.status === 'pending' ? 'text-red-600' : ''}>
                        {formatDate(invitation.expires_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {invitation.status === 'pending' && !isExpired(invitation.expires_at) && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(invitation.token)}
                            >
                              <IconCopy className="h-4 w-4 mr-1" />
                              Kopiuj link
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCancelDialog(invitation.id)}
                            >
                              <IconX className="h-4 w-4 mr-1" />
                              Anuluj
                            </Button>
                          </>
                        )}
                        {invitation.status === 'accepted' && (
                          <div className="flex items-center text-sm text-green-600">
                            <IconCheck className="h-4 w-4 mr-1" />
                            Wykorzystane
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <InvitationDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz anulować to zaproszenie?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja nie może być cofnięta. Zaproszenie zostanie oznaczone jako wygasłe
              i nie będzie można go użyć do rejestracji.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Anuluj</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelInvitation}
              disabled={isProcessing}
            >
              {isProcessing ? 'Anulowanie...' : 'Potwierdź'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

