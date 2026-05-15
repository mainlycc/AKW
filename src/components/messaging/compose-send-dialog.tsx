'use client'

import { useEffect, useMemo, useState } from 'react'
import type { NotificationChannel } from '@/lib/types/notifications'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { IconAlertCircle, IconMail, IconPhone } from '@tabler/icons-react'

export type ComposeSendChannel = NotificationChannel

export interface ComposeSendStats {
  totalRecipients: number
  emailAvailable?: number
  smsAvailable?: number
  emailUnavailable?: number
  smsUnavailable?: number
}

export interface ComposeSendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void

  title: string
  description?: string

  defaultMessage: string
  defaultChannel?: ComposeSendChannel
  messagePlaceholder?: string

  stats?: ComposeSendStats
  warnings?: string[]

  confirmLabel?: string
  cancelLabel?: string

  onSend: (params: { message: string; channel: ComposeSendChannel }) => Promise<void>
}

export function ComposeSendDialog({
  open,
  onOpenChange,
  title,
  description,
  defaultMessage,
  defaultChannel = 'email',
  messagePlaceholder,
  stats,
  warnings,
  confirmLabel = 'Wyślij',
  cancelLabel = 'Anuluj',
  onSend,
}: ComposeSendDialogProps) {
  const [message, setMessage] = useState(defaultMessage)
  const [channelEmail, setChannelEmail] = useState<boolean>(
    defaultChannel === 'email' || defaultChannel === 'both'
  )
  const [channelSms, setChannelSms] = useState<boolean>(
    defaultChannel === 'sms' || defaultChannel === 'both'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const channel: ComposeSendChannel | null = useMemo(() => {
    if (channelEmail && channelSms) return 'both'
    if (channelEmail) return 'email'
    if (channelSms) return 'sms'
    return null
  }, [channelEmail, channelSms])

  useEffect(() => {
    if (!open) return
    setMessage(defaultMessage)
    setChannelEmail(defaultChannel === 'email' || defaultChannel === 'both')
    setChannelSms(defaultChannel === 'sms' || defaultChannel === 'both')
    setError(null)
    setLoading(false)
  }, [open, defaultMessage, defaultChannel])

  const showEmailStats = typeof stats?.emailAvailable === 'number' || typeof stats?.emailUnavailable === 'number'
  const showSmsStats = typeof stats?.smsAvailable === 'number' || typeof stats?.smsUnavailable === 'number'

  const derivedWarnings = useMemo(() => {
    const result: string[] = [...(warnings || [])]

    if (stats && (channel === 'sms' || channel === 'both')) {
      if (typeof stats.smsUnavailable === 'number' && stats.smsUnavailable > 0) {
        const available = stats.smsAvailable ?? Math.max(0, stats.totalRecipients - stats.smsUnavailable)
        result.push(`SMS wyśle się do ${available}/${stats.totalRecipients} odbiorców (pozostali nie mają numeru telefonu).`)
      }
    }

    if (stats && (channel === 'email' || channel === 'both')) {
      if (typeof stats.emailUnavailable === 'number' && stats.emailUnavailable > 0) {
        const available = stats.emailAvailable ?? Math.max(0, stats.totalRecipients - stats.emailUnavailable)
        result.push(`Email wyśle się do ${available}/${stats.totalRecipients} odbiorców (pozostali nie mają adresu email).`)
      }
    }

    return Array.from(new Set(result))
  }, [warnings, stats, channel])

  const handleSend = async () => {
    if (!message.trim()) {
      setError('Treść wiadomości nie może być pusta')
      return
    }

    if (!channel) {
      setError('Wybierz przynajmniej jeden kanał wiadomości (Email i/lub SMS).')
      return
    }

    setError(null)
    setLoading(true)
    try {
      await onSend({ message: message.trim(), channel })
      onOpenChange(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Nieoczekiwany błąd'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setError(null)
      setLoading(false)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Kanał wiadomości</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
              <label className="flex items-center gap-2 text-sm select-none">
                <Checkbox
                  checked={channelEmail}
                  onCheckedChange={(v) => {
                    setChannelEmail(!!v)
                    setError(null)
                  }}
                  disabled={loading}
                />
                <span className="flex items-center gap-1.5">
                  <IconMail className="h-4 w-4 text-muted-foreground" />
                  Email
                </span>
              </label>

              <label className="flex items-center gap-2 text-sm select-none">
                <Checkbox
                  checked={channelSms}
                  onCheckedChange={(v) => {
                    setChannelSms(!!v)
                    setError(null)
                  }}
                  disabled={loading}
                />
                <span className="flex items-center gap-1.5">
                  <IconPhone className="h-4 w-4 text-muted-foreground" />
                  SMS
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="compose-message">Treść wiadomości</Label>
            <Textarea
              id="compose-message"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                setError(null)
              }}
              placeholder={messagePlaceholder || 'Wpisz treść wiadomości...'}
              rows={10}
              disabled={loading}
              className="resize-none"
            />
            {error ? (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <div className="flex items-start gap-2">
                  <IconAlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            ) : null}
          </div>

          {stats && (showEmailStats || showSmsStats) ? (
            <div className="rounded-md bg-muted p-3 space-y-1">
              {showEmailStats ? (
                <p className="text-sm text-muted-foreground">
                  <IconMail className="inline h-4 w-4 mr-1" />
                  Email: {stats.emailAvailable ?? '-'} / {stats.totalRecipients}
                </p>
              ) : null}
              {showSmsStats ? (
                <p className="text-sm text-muted-foreground">
                  <IconPhone className="inline h-4 w-4 mr-1" />
                  SMS: {stats.smsAvailable ?? '-'} / {stats.totalRecipients}
                </p>
              ) : null}
            </div>
          ) : null}

          {derivedWarnings.length > 0 ? (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
              <div className="flex items-start gap-2">
                <IconAlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                <div className="space-y-1">
                  {derivedWarnings.map((w) => (
                    <p key={w} className="text-sm text-amber-700">
                      {w}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button onClick={handleSend} disabled={loading || !message.trim() || !channel}>
            {loading ? 'Wysyłanie...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

