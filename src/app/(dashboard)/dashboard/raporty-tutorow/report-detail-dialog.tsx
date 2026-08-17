'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatHours } from "@/lib/utils"
import { LABELS } from "@/lib/labels/reports-declarations"
import { updateReportPeriod } from "./actions"
import { toast } from "sonner"
import { IconPencil } from "@tabler/icons-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ReportEntry {
  id: string
  hours: number
  students: {
    first_name: string
    last_name: string
  }
}

interface MonthlyReport {
  id: string
  month: number
  year: number
  status: string
  total_hours: number
  total_amount: number | null
  profiles: {
    full_name: string
    hourly_rate: number | null
  }
  monthly_report_entries: ReportEntry[]
}

interface ReportDetailDialogProps {
  open: boolean
  onClose: () => void
  report: MonthlyReport | null
}

const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']

const monthOptions = months.map((label, i) => ({ value: i + 1, label }))

export function ReportDetailDialog({ open, onClose, report }: ReportDetailDialogProps) {
  const router = useRouter()
  const [month, setMonth] = useState(report?.month ?? 1)
  const [year, setYear] = useState(report?.year ?? new Date().getFullYear())
  const [editingPeriod, setEditingPeriod] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (report) {
      setMonth(report.month)
      setYear(report.year)
      setEditingPeriod(false)
    }
  }, [report])

  if (!report) return null

  const currentYear = new Date().getFullYear()
  const years = Array.from(
    new Set([report.year, ...Array.from({ length: 5 }, (_, i) => currentYear - i)])
  ).sort((a, b) => b - a)
  const periodChanged = month !== report.month || year !== report.year

  const handleCancelEdit = () => {
    setMonth(report.month)
    setYear(report.year)
    setEditingPeriod(false)
  }

  const handleSavePeriod = async () => {
    setSaving(true)
    try {
      const result = await updateReportPeriod(report.id, month, year)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`Okres zmieniony na ${months[month - 1]} ${year}`)
      setEditingPeriod(false)
      router.refresh()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zmienić okresu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{LABELS.completedLessonsDetails}</DialogTitle>
          <DialogDescription>
            {report.profiles.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Okres</p>
              {editingPeriod ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="report-period-month" className="text-xs">Miesiąc</Label>
                      <Select
                        value={month.toString()}
                        onValueChange={(v) => setMonth(parseInt(v, 10))}
                      >
                        <SelectTrigger id="report-period-month">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map((m) => (
                            <SelectItem key={m.value} value={m.value.toString()}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="report-period-year" className="text-xs">Rok</Label>
                      <Select
                        value={year.toString()}
                        onValueChange={(v) => setYear(parseInt(v, 10))}
                      >
                        <SelectTrigger id="report-period-year">
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
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSavePeriod}
                      disabled={saving || !periodChanged}
                      size="sm"
                    >
                      {saving ? 'Zapisywanie...' : 'Zapisz'}
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      variant="outline"
                      size="sm"
                    >
                      Anuluj
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">
                    {months[report.month - 1]} {report.year}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground"
                    onClick={() => setEditingPeriod(true)}
                  >
                    <IconPencil className="h-4 w-4 mr-1" />
                    Edytuj
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Stawka godzinowa</p>
              <p className="text-lg font-semibold">
                {report.profiles.hourly_rate ? `${report.profiles.hourly_rate.toFixed(0)} zł/h` : 'Nie ustawiona'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Suma godzin</p>
              <p className="text-lg font-semibold">{formatHours(report.total_hours)} h</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Kwota do wypłaty</p>
              <p className="text-lg font-semibold">
                {report.total_amount ? `${report.total_amount.toFixed(2)} zł` : 'Nie obliczona'}
              </p>
            </div>
          </div>

          {/* Entries */}
          <div className="space-y-2">
            <h3 className="font-semibold">Szczegóły godzin</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Uczeń</TableHead>
                    <TableHead className="text-right">Liczba godzin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.monthly_report_entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {entry.students.first_name} {entry.students.last_name}
                      </TableCell>
                      <TableCell className="text-right">{formatHours(entry.hours)} h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
