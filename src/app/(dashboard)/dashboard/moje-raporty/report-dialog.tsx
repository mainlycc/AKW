'use client'

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createOrUpdateReport } from "./actions"

interface Student {
  id: string
  first_name: string
  last_name: string
}

interface ReportDialogProps {
  open: boolean
  onClose: () => void
  tutorId: string
  students: Student[]
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

export function ReportDialog({ open, onClose, tutorId, students, initialReport }: ReportDialogProps & { initialReport?: { month: number; year: number; entries: { student_id: string; hours: number }[] } }) {
  const currentDate = new Date()
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(currentDate.getMonth() + 1)
  const [year, setYear] = useState(currentDate.getFullYear())
  const [hours, setHours] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      if (initialReport) {
        setMonth(initialReport.month)
        setYear(initialReport.year)
        const mapped: Record<string, string> = {}
        initialReport.entries.forEach(e => {
          mapped[e.student_id] = e.hours.toString()
        })
        setHours(mapped)
      } else {
        const date = new Date()
        setMonth(date.getMonth() + 1)
        setYear(date.getFullYear())
        setHours({})
      }
    }
  }, [open, initialReport])

  const handleHoursChange = (studentId: string, value: string) => {
    setHours(prev => ({ ...prev, [studentId]: value }))
  }

  const getTotalHours = () => {
    return Object.values(hours).reduce((sum, h) => sum + (parseFloat(h) || 0), 0)
  }

  const handleSaveDraft = async () => {
    await handleSubmit('draft')
  }

  const handleSubmitReport = async () => {
    await handleSubmit('submitted')
  }

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    setLoading(true)

    try {
      const entries = Object.entries(hours)
        .filter(([, h]) => parseFloat(h) > 0)
        .map(([studentId, h]) => ({
          student_id: studentId,
          hours: parseFloat(h),
        }))

      if (entries.length === 0) {
        alert('Dodaj co najmniej jednego ucznia z godzinami')
        setLoading(false)
        return
      }

      await createOrUpdateReport(tutorId, month, year, entries, status)
      onClose()
    } catch (error) {
      console.error('Error saving report:', error)
      alert('Błąd podczas zapisywania raportu')
    } finally {
      setLoading(false)
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialReport ? 'Edytuj raport miesięczny' : 'Utwórz raport miesięczny'}</DialogTitle>
          <DialogDescription>
            Wprowadź liczbę godzin przeprowadzonych z każdym uczniem
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Wybór miesiąca i roku */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Miesiąc</Label>
              <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {initialReport && <p className="text-xs text-muted-foreground">Miesiąc nie może być zmieniony podczas edycji.</p>}
            </div>
            <div className="space-y-2">
              <Label>Rok</Label>
              <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {initialReport && <p className="text-xs text-muted-foreground">Rok nie może być zmieniony podczas edycji.</p>}
            </div>
          </div>

          {/* Lista uczniów */}
          <div className="space-y-2">
            <Label>Godziny z uczniami</Label>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak przypisanych uczniów</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto border rounded p-3">
                {students.map(student => (
                  <div key={student.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm">
                      {student.first_name} {student.last_name}
                    </span>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="0"
                      value={hours[student.id] || ''}
                      onChange={(e) => handleHoursChange(student.id, e.target.value)}
                      disabled={loading}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground w-8">h</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Podsumowanie */}
          <div className="flex items-center justify-between p-3 bg-muted rounded">
            <span className="font-semibold">Suma godzin:</span>
            <span className="text-xl font-bold">{getTotalHours().toFixed(2)} h</span>
          </div>

          {/* Przyciski */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Anuluj
            </Button>
            <Button type="button" variant="secondary" onClick={handleSaveDraft} disabled={loading}>
              {loading ? 'Zapisywanie...' : 'Zapisz roboczą'}
            </Button>
            <Button type="button" onClick={handleSubmitReport} disabled={loading}>
              {loading ? 'Wysyłanie...' : 'Złóż raport'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

