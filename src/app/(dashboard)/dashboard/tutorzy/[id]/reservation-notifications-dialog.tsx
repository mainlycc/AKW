'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SLOT_DURATION_MINUTES, DAY_NAMES } from '@/lib/types/availability.types'
import { calculateAdminReservationAmount } from '@/lib/utils/admin-reservation-pricing'
import {
  sendAdminReservationNotifications,
  type ReservationNotificationContext,
} from './notification-actions'
import { toast } from 'sonner'

const RECURRING_LESSON_OPTIONS = [1, 2, 4, 8] as const

interface ReservationNotificationsDialogProps {
  open: boolean
  onClose: () => void
  context: ReservationNotificationContext | null
}

export function ReservationNotificationsDialog({
  open,
  onClose,
  context,
}: ReservationNotificationsDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [notifyParent, setNotifyParent] = useState(true)
  const [parentEmail, setParentEmail] = useState(true)
  const [parentSms, setParentSms] = useState(true)
  const [notifyTutor, setNotifyTutor] = useState(true)
  const [tutorEmail, setTutorEmail] = useState(true)
  const [tutorSms, setTutorSms] = useState(true)
  const [lessonCount, setLessonCount] = useState<number>(4)

  const hourlyRate = context?.hourlyRate ?? null
  const effectiveLessonCount = context?.isRecurring ? lessonCount : 1
  const hoursPerLesson = SLOT_DURATION_MINUTES / 60

  const pricePreview = useMemo(() => {
    if (hourlyRate === null || hourlyRate <= 0 || !context) return null
    return calculateAdminReservationAmount(hourlyRate, lessonCount, context.isRecurring)
  }, [hourlyRate, lessonCount, context])

  useEffect(() => {
    if (!open) return
    setNotifyParent(true)
    setParentEmail(true)
    setParentSms(true)
    setNotifyTutor(true)
    setTutorEmail(true)
    setTutorSms(true)
    setLessonCount(4)
  }, [open, context?.bookedSlotId])

  if (!context) return null

  const hasParentEmail = !!context.parentEmail
  const hasParentPhone = !!context.parentPhone
  const hasTutorEmail = !!context.tutorEmail
  const hasTutorPhone = !!context.tutorPhone
  const needsPayment = notifyParent && (parentEmail || parentSms) && hasParentEmail

  const dateLabel = !context.isRecurring && context.nextOccurrenceDate
    ? format(parseISO(context.nextOccurrenceDate), 'd MMMM yyyy', { locale: pl })
    : `co ${DAY_NAMES[context.weekday]}`

  const timeLabel = `${context.startTime.substring(0, 5)}–${context.endTime.substring(0, 5)}`

  const handleSend = () => {
    if (needsPayment && (hourlyRate === null || hourlyRate <= 0)) {
      toast.error('Brak stawki — wróć do rezerwacji i ustaw stawkę godzinową')
      return
    }

    startTransition(async () => {
      try {
        const result = await sendAdminReservationNotifications({
          context,
          notifyParent,
          parentEmail: notifyParent && parentEmail,
          parentSms: notifyParent && parentSms,
          notifyTutor,
          tutorEmail: notifyTutor && tutorEmail,
          tutorSms: notifyTutor && tutorSms,
          lessonCount: effectiveLessonCount,
          hourlyRate: hourlyRate ?? 0,
        })

        const failed = result.results.filter((r) => !r.success)
        if (failed.length === 0) {
          toast.success('Powiadomienia wysłane')
        } else if (result.results.some((r) => r.success)) {
          toast.warning(
            `Część powiadomień nie została wysłana: ${failed.map((f) => f.error).filter(Boolean).join(', ')}`
          )
        } else {
          toast.error(
            failed[0]?.error || 'Nie udało się wysłać powiadomień'
          )
        }
        onClose()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Nie udało się wysłać powiadomień')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="w-[95vw] sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Powiadomienia o rezerwacji</DialogTitle>
          <DialogDescription>
            Rezerwacja została zapisana. Wybierz, komu wysłać powiadomienia.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
          <p>
            <strong>{context.studentName}</strong> — {context.subjectName} ({context.levelName})
          </p>
          <p>
            Termin: <strong>{dateLabel}</strong>, godz. <strong>{timeLabel}</strong>
          </p>
          {hourlyRate !== null && hourlyRate > 0 && (
            <p>
              Stawka: <strong>{hourlyRate.toFixed(0)} zł/h</strong>
            </p>
          )}
        </div>

        <div className="space-y-5 py-2">
          {/* Rodzic */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="notify-parent"
                checked={notifyParent}
                onCheckedChange={(v) => setNotifyParent(v === true)}
              />
              <Label htmlFor="notify-parent" className="font-semibold cursor-pointer">
                Powiadomienia do rodzica
              </Label>
            </div>

            {notifyParent && (
              <div className="ml-7 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="parent-email"
                    checked={parentEmail}
                    disabled={!hasParentEmail}
                    onCheckedChange={(v) => setParentEmail(v === true)}
                  />
                  <Label
                    htmlFor="parent-email"
                    className={hasParentEmail ? 'cursor-pointer' : 'text-muted-foreground'}
                  >
                    Email {context.parentEmail ? `(${context.parentEmail})` : ''}
                  </Label>
                </div>
                {!hasParentEmail && (
                  <p className="text-xs text-muted-foreground ml-7">Brak adresu email rodzica</p>
                )}

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="parent-sms"
                    checked={parentSms}
                    disabled={!hasParentPhone}
                    onCheckedChange={(v) => setParentSms(v === true)}
                  />
                  <Label
                    htmlFor="parent-sms"
                    className={hasParentPhone ? 'cursor-pointer' : 'text-muted-foreground'}
                  >
                    SMS {context.parentPhone ? `(${context.parentPhone})` : ''}
                  </Label>
                </div>
                {!hasParentPhone && (
                  <p className="text-xs text-muted-foreground ml-7">Brak numeru telefonu rodzica</p>
                )}

                {context.isRecurring ? (
                  <div className="space-y-1.5">
                    <Label>Liczba lekcji do opłacenia</Label>
                    <Select
                      value={String(lessonCount)}
                      onValueChange={(v) => setLessonCount(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRING_LESSON_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} {n === 1 ? 'lekcja' : n < 5 ? 'lekcje' : 'lekcji'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Płatność za 1 lekcję (jednorazowa)</p>
                )}

                {needsPayment && hourlyRate !== null && hourlyRate > 0 && pricePreview !== null && (
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      Kwota płatności PayU:{' '}
                      <strong>{pricePreview.toFixed(2).replace('.', ',')} zł</strong>
                    </p>
                    {context.isRecurring ? (
                      <p className="text-xs text-muted-foreground">
                        {effectiveLessonCount}{' '}
                        {effectiveLessonCount === 1
                          ? 'lekcja'
                          : effectiveLessonCount < 5
                            ? 'lekcje'
                            : 'lekcji'}{' '}
                        × {hoursPerLesson} h × {hourlyRate.toFixed(0)} zł/h
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {hoursPerLesson} h × {hourlyRate.toFixed(0)} zł/h
                      </p>
                    )}
                  </div>
                )}

                {needsPayment && (hourlyRate === null || hourlyRate <= 0) && (
                  <p className="text-sm text-destructive">
                    Brak stawki — wróć do rezerwacji i ustaw stawkę godzinową, aby wysłać link PayU.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Tutor */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="notify-tutor"
                checked={notifyTutor}
                onCheckedChange={(v) => setNotifyTutor(v === true)}
              />
              <Label htmlFor="notify-tutor" className="font-semibold cursor-pointer">
                Powiadomienia do tutora
              </Label>
            </div>

            {notifyTutor && (
              <div className="ml-7 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="tutor-email"
                    checked={tutorEmail}
                    disabled={!hasTutorEmail}
                    onCheckedChange={(v) => setTutorEmail(v === true)}
                  />
                  <Label
                    htmlFor="tutor-email"
                    className={hasTutorEmail ? 'cursor-pointer' : 'text-muted-foreground'}
                  >
                    Email {context.tutorEmail ? `(${context.tutorEmail})` : ''}
                  </Label>
                </div>
                {!hasTutorEmail && (
                  <p className="text-xs text-muted-foreground ml-7">Brak adresu email tutora</p>
                )}

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="tutor-sms"
                    checked={tutorSms}
                    disabled={!hasTutorPhone}
                    onCheckedChange={(v) => setTutorSms(v === true)}
                  />
                  <Label
                    htmlFor="tutor-sms"
                    className={hasTutorPhone ? 'cursor-pointer' : 'text-muted-foreground'}
                  >
                    SMS {context.tutorPhone ? `(${context.tutorPhone})` : ''}
                  </Label>
                </div>
                {!hasTutorPhone && (
                  <p className="text-xs text-muted-foreground ml-7">Brak numeru telefonu tutora</p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Pomiń
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              isPending ||
              (!notifyParent && !notifyTutor) ||
              (notifyParent && !parentEmail && !parentSms) ||
              (notifyTutor && !tutorEmail && !tutorSms)
            }
          >
            {isPending ? 'Wysyłanie...' : 'Wyślij powiadomienia'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
