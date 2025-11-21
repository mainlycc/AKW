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
import { updatePaymentAction, deletePaymentAction } from './actions'
import { toast } from 'sonner'
import type { PaymentWithParent } from '@/lib/actions/payments'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface PaymentDialogProps {
  open: boolean
  onClose: () => void
  payment: PaymentWithParent | null
  onSuccess: () => void
}

export function PaymentDialog({
  open,
  onClose,
  payment,
  onSuccess,
}: PaymentDialogProps) {
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash' | 'online'>('transfer')
  const [paymentDate, setPaymentDate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    if (payment && open) {
      setAmount(payment.amount.toString())
      setPaymentMethod(payment.payment_method)
      setPaymentDate(payment.payment_date)
      setNotes(payment.notes || '')
    } else if (!payment && open) {
      const today = new Date().toISOString().split('T')[0]
      setAmount('')
      setPaymentMethod('transfer')
      setPaymentDate(today)
      setNotes('')
    }
  }, [payment, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payment) return

    setLoading(true)
    try {
      await updatePaymentAction(payment.id, {
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        payment_date: paymentDate,
        notes: notes || undefined,
      })
      toast.success('Płatność zaktualizowana')
      onSuccess()
      onClose()
    } catch {
      toast.error('Nie udało się zaktualizować płatności')
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

  if (!payment) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edytuj płatność</DialogTitle>
            <DialogDescription>
              Zmień szczegóły płatności
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Uczeń</Label>
                <Input
                  value={`${payment.students.first_name} ${payment.students.last_name}`}
                  disabled
                />
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
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={loading}
              >
                Usuń
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Anuluj
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Zapisywanie...' : 'Zapisz'}
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

