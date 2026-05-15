'use client'

import { useState } from 'react'
import { sendGroupMessage } from './actions'
import { toast } from 'sonner'
import type { NotificationChannel } from '@/lib/types/notifications'
import { ComposeSendDialog } from '@/components/messaging/compose-send-dialog'

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
  const [channel, setChannel] = useState<NotificationChannel>('email')

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

  // Sprawdź czy uczniowie mają rodziców z numerami telefonów (dla SMS)
  const studentsWithPhoneParents = selectedStudents.filter(student => {
    const parents = student.student_parents || []
    return parents.some(sp => sp.parents && sp.parents.phone && sp.parents.phone.trim())
  })

  const studentsMissingPhone = selectedStudents.filter(
    (student) => !studentsWithPhoneParents.some((s) => s.id === student.id)
  )
  const warnings: string[] = []
  if (hasNoEmails) {
    warnings.push('Brak adresów email u wszystkich zaznaczonych odbiorców.')
  }

  return (
    <ComposeSendDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setChannel('email')
        onOpenChange(next)
      }}
      title="Wyślij wiadomość grupową"
      description={`Wyślij wiadomość do głównych rodziców ${selectedStudents.length} ${
        selectedStudents.length === 1 ? 'zaznaczonego ucznia' : 'zaznaczonych uczniów'
      }`}
      defaultMessage=""
      defaultChannel={channel}
      messagePlaceholder="Wpisz treść wiadomości do rodziców..."
      stats={{
        totalRecipients: selectedStudents.length,
        emailAvailable: studentsWithParents.length,
        smsAvailable: studentsWithPhoneParents.length,
        emailUnavailable: selectedStudents.length - studentsWithParents.length,
        smsUnavailable: studentsMissingPhone.length,
      }}
      warnings={warnings}
      confirmLabel="Wyślij wiadomość"
      onSend={async ({ message, channel }) => {
        setChannel(channel)
        const studentIds = selectedStudents.map((s) => s.id)
        const result = await sendGroupMessage(studentIds, message, channel)

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

