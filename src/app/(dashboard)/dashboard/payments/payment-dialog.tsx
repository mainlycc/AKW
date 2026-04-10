'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createPaymentAction, updatePaymentAction, deletePaymentAction } from './actions'
import { toast } from 'sonner'
import type { PaymentWithParent } from '@/lib/actions/payments'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { getOrCreateBillingPeriod } from '@/lib/actions/payments'

interface PaymentDialogProps {
  open: boolean
  onClose: () => void
  payment: PaymentWithParent | null
  students?: Array<{
    id: string
    first_name: string
    last_name: string
    parent?: {
      id: string
      first_name: string
      last_name: string
      email: string
      phone: string | null
    }
  }>
  onSuccess: () => void
}

export function PaymentDialog({
  open,
  onClose,
  payment,
  students = [],
  onSuccess,
}: PaymentDialogProps) {
  const currentDate = new Date()
  const [studentId, setStudentId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash' | 'online'>('transfer')
  const [paymentDate, setPaymentDate] = useState('')
  const [month, setMonth] = useState<number>(currentDate.getMonth() + 1)
  const [year, setYear] = useState<number>(currentDate.getFullYear())
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const monthOptions = [
    { value: 1, label: 'Styczeń' },
    { value: 2, label: 'Luty' },
    { value: 3, label: 'Marzec' },
    { value: 4, label: 'Kwiecień' },
    { value: 5, label: 'Maj' },
    { value: 6, label: 'Czerwiec' },
    { value: 7, label: 'Lipiec' },
    { value: 8, label: 'Sierpień' },
    { value: 9, label: 'Wrzesień' },
    { value: 10, label: 'Październik' },
    { value: 11, label: 'Listopad' },
    { value: 12, label: 'Grudzień' },
  ] as const

  useEffect(() => {
    if (payment && open) {
      setAmount(payment.amount.toString())
      setPaymentMethod(payment.payment_method)
      setPaymentDate(payment.payment_date)
      setNotes(payment.notes || '')
    } else if (!payment && open) {
      const today = new Date().toISOString().split('T')[0]
      setStudentId('')
      setAmount('')
      setPaymentMethod('transfer')
      setPaymentDate(today)
      setMonth(currentDate.getMonth() + 1)
      setYear(currentDate.getFullYear())
      setNotes('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    try {
      if (payment) {
        await updatePaymentAction(payment.id, {
          amount: parseFloat(amount),
          payment_method: paymentMethod,
          payment_date: paymentDate,
          notes: notes || undefined,
        })
        toast.success('Płatność zaktualizowana')
      } else {
        if (!studentId) {
          toast.error('Wybierz ucznia')
          return
        }
        if (!amount) {
          toast.error('Podaj kwotę')
          return
        }

        const billingPeriodId = await getOrCreateBillingPeriod(month, year)

        await createPaymentAction({
          student_id: studentId,
          billing_period_id: billingPeriodId,
          amount: parseFloat(amount),
          payment_method: paymentMethod,
          payment_date: paymentDate,
          notes: notes || undefined,
        })
        toast.success('Płatność dodana')
      }
      onSuccess()
      onClose()
    } catch {
      toast.error(payment ? 'Nie udało się zaktualizować płatności' : 'Nie udało się dodać płatności')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!payment) return

    setLoading(true)
    try {
      await deletePaymentAction(payment.id)
      toast.success('Płatność usunięta')
      onSuccess()
      onClose()
    } catch {
      toast.error('Nie udało się usunąć płatności')
    } finally {
      setLoading(false)
      setDeleteDialogOpen(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{payment ? 'Edytuj płatność' : 'Dodaj płatność'}</DialogTitle>
            <DialogDescription>
              {payment ? 'Zmień szczegóły płatności' : 'Zarejestruj nową płatność dla wybranego ucznia'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Uczeń</Label>
                {payment ? (
                  <Input
                    value={`${payment.students.first_name} ${payment.students.last_name}`}
                    disabled
                  />
                ) : (
                  <Select value={studentId} onValueChange={setStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz ucznia" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.first_name} {s.last_name}
                          {s.parent ? ` (${s.parent.first_name} ${s.parent.last_name})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Kwota (zł)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Metoda płatności</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) =>
                    setPaymentMethod(v as 'transfer' | 'cash' | 'online')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Przelew</SelectItem>
                    <SelectItem value="cash">Gotówka</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data płatności</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>
              {!payment && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Miesiąc</Label>
                    <Select
                      value={String(month)}
                      onValueChange={(v) => setMonth(parseInt(v, 10))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {monthOptions.map((m) => (
                          <SelectItem key={m.value} value={String(m.value)}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rok</Label>
                    <Input
                      type="number"
                      min={2000}
                      max={2100}
                      value={year}
                      onChange={(e) => setYear(parseInt(e.target.value || String(currentDate.getFullYear()), 10))}
                      required
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Notatka</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              {payment && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={loading}
                >
                  Usuń
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Anuluj
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Zapisywanie...' : payment ? 'Zapisz' : 'Dodaj'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Usuwanie płatności"
        description="Czy na pewno chcesz usunąć tę płatność?"
        onConfirm={handleDelete}
      />
    </>
  )
}

