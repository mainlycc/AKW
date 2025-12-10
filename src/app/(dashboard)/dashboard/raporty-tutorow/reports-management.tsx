'use client'

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ReportDetailDialog } from "./report-detail-dialog"
import { approveReport, markAsPaid, autoApproveSubmittedReports } from "./actions"
import { IconDownload, IconCheck, IconCurrencyDollar } from "@tabler/icons-react"
import { ConfirmDialog } from "@/components/confirm-dialog"

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
  submitted_at: string | null
  profiles: {
    id: string
    full_name: string
    hourly_rate: number | null
  }
  monthly_report_entries: ReportEntry[]
}

interface Tutor {
  id: string
  full_name: string
}

interface ReportsManagementProps {
  reports: MonthlyReport[]
  tutors: Tutor[]
  adminId: string
}

const statusLabels: Record<string, string> = {
  draft: 'Roboczy',
  submitted: 'Złożony',
  approved: 'Zatwierdzony',
  paid: 'Opłacony',
}

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: 'outline',
  submitted: 'secondary',
  approved: 'default',
  paid: 'default',
}

const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']

export function ReportsManagement({ reports, tutors, adminId }: ReportsManagementProps) {
  const router = useRouter()
  const [tutorFilter, setTutorFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogContent, setConfirmDialogContent] = useState<{ title: string; description: string; onConfirm: () => void }>({ title: '', description: '', onConfirm: () => {} })

  // Automatycznie zatwierdź wszystkie złożone raporty przy załadowaniu
  useEffect(() => {
    const autoApprove = async () => {
      try {
        await autoApproveSubmittedReports()
        router.refresh()
      } catch (error) {
        console.error('Error auto-approving reports:', error)
      }
    }
    autoApprove()
  }, [router])

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      if (tutorFilter !== 'all' && report.profiles.id !== tutorFilter) return false
      if (monthFilter !== 'all' && report.month !== parseInt(monthFilter)) return false
      if (yearFilter !== 'all' && report.year !== parseInt(yearFilter)) return false
      if (statusFilter !== 'all' && report.status !== statusFilter) return false
      return true
    })
  }, [reports, tutorFilter, monthFilter, yearFilter, statusFilter])

  const handleApprove = async (reportId: string) => {
    setConfirmDialogContent({
      title: 'Zatwierdzanie raportu',
      description: 'Czy na pewno chcesz zatwierdzić ten raport?',
      onConfirm: async () => {
        await approveReport(reportId, adminId)
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleMarkAsPaid = async (reportId: string) => {
    setConfirmDialogContent({
      title: 'Oznaczanie raportu jako opłacony',
      description: 'Czy na pewno chcesz oznaczyć ten raport jako opłacony?',
      onConfirm: async () => {
        await markAsPaid(reportId)
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleRowClick = (report: MonthlyReport) => {
    setSelectedReport(report)
    setDialogOpen(true)
  }

  const handleExportCSV = () => {
    const headers = ['Tutor', 'Miesiąc', 'Rok', 'Godziny', 'Stawka (zł/h)', 'Kwota (zł)', 'Status']
    const rows = filteredReports.map(r => [
      r.profiles.full_name,
      r.month,
      r.year,
      r.total_hours.toFixed(2),
      (r.profiles.hourly_rate || 0).toFixed(2),
      (r.total_amount || 0).toFixed(2),
      statusLabels[r.status],
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `raporty-tutorow-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const uniqueYears = Array.from(new Set(reports.map(r => r.year))).sort((a, b) => b - a)

  const totalStats = useMemo(() => {
    return {
      totalHours: filteredReports.reduce((sum, r) => sum + r.total_hours, 0),
      totalAmount: filteredReports.reduce((sum, r) => sum + (r.total_amount || 0), 0),
      submittedCount: filteredReports.filter(r => r.status === 'submitted').length,
    }
  }, [filteredReports])

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Oczekujące</p>
          <p className="text-2xl font-bold">{totalStats.submittedCount}</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Suma godzin</p>
          <p className="text-2xl font-bold">{totalStats.totalHours.toFixed(2)} h</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Suma wypłat</p>
          <p className="text-2xl font-bold">{totalStats.totalAmount.toFixed(2)} zł</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="grid grid-cols-4 gap-4 flex-1">
          <Select value={tutorFilter} onValueChange={setTutorFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Wszyscy tutorzy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszyscy tutorzy</SelectItem>
              {tutors.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Wszystkie miesiące" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie miesiące</SelectItem>
              {months.map((m, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Wszystkie lata" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie lata</SelectItem>
              {uniqueYears.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Wszystkie statusy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie statusy</SelectItem>
              <SelectItem value="submitted">Złożone</SelectItem>
              <SelectItem value="approved">Zatwierdzone</SelectItem>
              <SelectItem value="paid">Opłacone</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={handleExportCSV}>
          <IconDownload className="mr-2 h-4 w-4" />
          CSV
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tutor</TableHead>
              <TableHead>Okres</TableHead>
              <TableHead className="text-right">Godziny</TableHead>
              <TableHead className="text-right">Stawka</TableHead>
              <TableHead className="text-right">Kwota</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Brak raportów do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              filteredReports.map((report) => (
                <TableRow 
                  key={report.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(report)}
                >
                  <TableCell className="font-medium">{report.profiles.full_name}</TableCell>
                  <TableCell>{months[report.month - 1]} {report.year}</TableCell>
                  <TableCell className="text-right">{report.total_hours.toFixed(2)} h</TableCell>
                  <TableCell className="text-right">
                    {report.profiles.hourly_rate ? `${report.profiles.hourly_rate.toFixed(2)} zł` : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {report.total_amount ? `${report.total_amount.toFixed(2)} zł` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[report.status]}>
                      {statusLabels[report.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      {report.status === 'submitted' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(report.id)}
                        >
                          <IconCheck className="h-4 w-4 mr-1" />
                          Zatwierdź
                        </Button>
                      )}
                      {report.status === 'approved' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsPaid(report.id)}
                        >
                          <IconCurrencyDollar className="h-4 w-4 mr-1" />
                          Opłacone
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ReportDetailDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        report={selectedReport}
      />

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title={confirmDialogContent.title}
        description={confirmDialogContent.description}
        onConfirm={confirmDialogContent.onConfirm}
        confirmText="Potwierdź"
        cancelText="Anuluj"
        variant="default"
      />
    </div>
  )
}

