'use client'

import { useState } from 'react'
import { sendGroupMessageToTutors } from './actions'
import { toast } from 'sonner'
import type { NotificationChannel } from '@/lib/types/notifications'
import { ComposeSendDialog } from '@/components/messaging/compose-send-dialog'

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
  const [channel, setChannel] = useState<NotificationChannel>('email')

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

  const warnings: string[] = []
  if (hasNoEmails) {
    warnings.push('Brak adresów email u wszystkich zaznaczonych tutorów.')
  }

  return (
    <ComposeSendDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setChannel('email')
        onOpenChange(next)
      }}
      title="Wyślij wiadomość grupową"
      description={`Wyślij wiadomość do ${selectedTutors.length} ${
        selectedTutors.length === 1 ? 'zaznaczonego tutora' : 'zaznaczonych tutorów'
      }`}
      defaultMessage=""
      defaultChannel={channel}
      messagePlaceholder="Wpisz treść wiadomości do tutorów..."
      stats={{
        totalRecipients: selectedTutors.length,
        emailAvailable: tutorsWithEmails.length,
        smsAvailable: tutorsWithPhones.length,
        emailUnavailable: selectedTutors.length - tutorsWithEmails.length,
        smsUnavailable: tutorsMissingPhone.length,
      }}
      warnings={warnings}
      confirmLabel="Wyślij wiadomość"
      onSend={async ({ message, channel }) => {
        setChannel(channel)
        const tutorIds = selectedTutors.map((t) => t.id)
        const result = await sendGroupMessageToTutors(tutorIds, message, channel)

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

