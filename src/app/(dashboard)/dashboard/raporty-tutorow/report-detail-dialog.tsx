'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { formatHours } from "@/lib/utils"
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

const statusLabels: Record<string, string> = {
  draft: 'Roboczy',
  submitted: 'Złożony',
  approved: 'Zatwierdzony',
  paid: 'Opłacony',
}

const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']

export function ReportDetailDialog({ open, onClose, report }: ReportDetailDialogProps) {
  if (!report) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Szczegóły raportu</DialogTitle>
          <DialogDescription>
            {report.profiles.full_name} - {months[report.month - 1]} {report.year}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge>{statusLabels[report.status]}</Badge>
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

