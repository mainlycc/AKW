'use client'

import { useState } from 'react'
import { sendGroupMessageToAllMyStudents } from './actions'
import { toast } from 'sonner'
import { ComposeSendDialog } from '@/components/messaging/compose-send-dialog'
import type { NotificationChannel } from '@/lib/types/notifications'

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
  const [channel, setChannel] = useState<NotificationChannel>('email')

  const warnings: string[] = []
  if (studentsCount === 0) {
    warnings.push('Nie masz przypisanych aktywnych uczniów. Nie można wysłać wiadomości.')
  }

  return (
    <ComposeSendDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setChannel('email')
        onOpenChange(next)
      }}
      title="Wyślij wiadomość do wszystkich uczniów"
      description={`Wyślij wiadomość do głównych rodziców wszystkich swoich uczniów (${studentsCount})`}
      defaultMessage=""
      defaultChannel={channel}
      messagePlaceholder="Wpisz treść wiadomości do rodziców swoich uczniów..."
      stats={{
        totalRecipients: studentsCount,
      }}
      warnings={warnings}
      confirmLabel="Wyślij wiadomość"
      onSend={async ({ message, channel }) => {
        if (studentsCount === 0) {
          throw new Error('Brak uczniów do wysłania wiadomości')
        }

        setChannel(channel)
        const result = await sendGroupMessageToAllMyStudents(tutorId, message, channel)

        if (result.success) {
          const sentCount = result.sentCount ?? 0
          toast.success(
            `Wysłano ${sentCount} ${sentCount === 1 ? 'wiadomość' : sentCount < 5 ? 'wiadomości' : 'wiadomości'}`
          )
          if (result.error) toast.warning(result.error)
        } else {
          toast.error(result.error || 'Nie udało się wysłać wiadomości')
          throw new Error(result.error || 'Nie udało się wysłać wiadomości')
        }
      }}
    />
  )
}

