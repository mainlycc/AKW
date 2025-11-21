'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { createPaymentAction } from '@/app/(dashboard)/dashboard/payments/actions'
import { getOrCreateBillingPeriod } from '@/lib/actions/payments'
import { toast } from 'sonner'

interface Student {
  id: string
  first_name: string
  last_name: string
}

interface Parent {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
}

interface StudentWithParent extends Student {
  parent?: Parent
}

interface PaymentDialogProps {
  open: boolean
  onClose: () => void
  students: StudentWithParent[]
  currentMonth: number
  currentYear: number
  initialStudentId?: string
  initialBillingPeriodId?: string
  onSuccess?: () => void
}

const months = [
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
]

export function PaymentDialog({
  open,
  onClose,
  students,
  currentMonth,
  currentYear,
  initialStudentId,
  initialBillingPeriodId,
  onSuccess,
}: PaymentDialogProps) {
  const [studentId, setStudentId] = useState(initialStudentId || '')
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash' | 'online'>('transfer')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      if (initialStudentId) {
        setStudentId(initialStudentId)
      }
      setMonth(currentMonth)
      setYear(currentYear)
      setAmount('')
      setNotes('')
      setPaymentMethod('transfer')
    }
  }, [open, initialStudentId, currentMonth, currentYear])

  const selectedStudent = students.find((s) => s.id === studentId)
  const years = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - 2 + i
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!studentId || !amount) {
      toast.error('Wypełnij wszystkie wymagane pola')
      return
    }

    setLoading(true)

    try {
      // Get or create billing period
      const billingPeriodId = await getOrCreateBillingPeriod(month, year)

      const paymentDate = new Date().toISOString().split('T')[0]

      await createPaymentAction({
        student_id: studentId,
        billing_period_id: billingPeriodId,
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        payment_date: paymentDate,
        notes: notes || undefined,
      })

      toast.success('Płatność dodana pomyślnie')
      onClose()
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Nie udało się dodać płatności'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dodaj płatność</DialogTitle>
          <DialogDescription>
            Zarejestruj nową płatność dla wybranego ucznia
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="student">Uczeń *</Label>
            <Select value={studentId} onValueChange={setStudentId} required>
              <SelectTrigger id="student">
                <SelectValue placeholder="Wybierz ucznia" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.first_name} {student.last_name}
                    {student.parent
                      ? ` (${student.parent.first_name} ${student.parent.last_name})`
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedStudent?.parent && (
              <p className="text-sm text-muted-foreground">
                Rodzic: {selectedStudent.parent.first_name}{' '}
                {selectedStudent.parent.last_name} ({selectedStudent.parent.email})
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Kwota (zł) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="month">Miesiąc *</Label>
              <Select
                value={month.toString()}
                onValueChange={(v) => setMonth(parseInt(v))}
                required
              >
                <SelectTrigger id="month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Rok *</Label>
              <Select
                value={year.toString()}
                onValueChange={(v) => setYear(parseInt(v))}
                required
              >
                <SelectTrigger id="year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Metoda płatności *</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) =>
                setPaymentMethod(v as 'transfer' | 'cash' | 'online')
              }
              required
            >
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transfer">Przelew</SelectItem>
                <SelectItem value="cash">Gotówka</SelectItem>
                <SelectItem value="online">Online (Stripe)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notatka</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Opcjonalne notatki dotyczące płatności..."
            />
          </div>

          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Zapisywanie...' : 'Dodaj płatność'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

