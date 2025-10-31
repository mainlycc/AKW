'use client'

import { useState } from "react"
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
import { ReportDialog } from "./report-dialog"
import { deleteReport, type ReportStatus } from "./actions"
import { IconPlus, IconTrash, IconPencil } from "@tabler/icons-react"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface MonthlyReport {
  id: string
  month: number
  year: number
  status: ReportStatus
  total_hours: number
  total_amount: number | null
  submitted_at: string | null
  created_at: string
  monthly_report_entries?: { id: string; student_id: string; hours: number }[]
}

interface Student {
  id: string
  first_name: string
  last_name: string
}

interface ReportsTableProps {
  reports: MonthlyReport[]
  tutorId: string
  students: Student[]
}

const statusLabels: Record<ReportStatus, string> = {
  draft: 'Roboczy',
  submitted: 'Złożony',
  approved: 'Zatwierdzony',
  paid: 'Opłacony',
}

const statusVariants: Record<ReportStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: 'outline',
  submitted: 'secondary',
  approved: 'default',
  paid: 'default',
}

const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']

export function ReportsTable({ reports, tutorId, students }: ReportsTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [reportToDelete, setReportToDelete] = useState<string | null>(null)
  const [initialReport, setInitialReport] = useState<{
    month: number
    year: number
    entries: { student_id: string; hours: number }[]
  } | null>(null)

  const handleDelete = async (id: string) => {
    setReportToDelete(id)
    setConfirmDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (reportToDelete) {
      await deleteReport(reportToDelete)
      setReportToDelete(null)
    }
  }

  const handleEdit = (report: MonthlyReport) => {
    setInitialReport({
      month: report.month,
      year: report.year,
      entries: (report.monthly_report_entries || []).map(e => ({ student_id: e.student_id, hours: e.hours })),
    })
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <IconPlus className="mr-2 h-4 w-4" />
          Utwórz raport
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Okres</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Suma godzin</TableHead>
              <TableHead className="text-right">Kwota</TableHead>
              <TableHead>Data utworzenia</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Brak raportów. Utwórz pierwszy raport.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">
                    {months[report.month - 1]} {report.year}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[report.status]}>
                      {statusLabels[report.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{report.total_hours.toFixed(2)} h</TableCell>
                  <TableCell className="text-right">
                    {report.total_amount ? `${report.total_amount.toFixed(2)} zł` : '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(report.created_at).toLocaleDateString('pl-PL')}
                  </TableCell>
                  <TableCell className="text-right">
                    {report.status === 'draft' && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(report)}
                          title="Edytuj wersję roboczą"
                        >
                          <IconPencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(report.id)}
                          title="Usuń raport"
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ReportDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setInitialReport(null)
        }}
        tutorId={tutorId}
        students={students}
        initialReport={initialReport || undefined}
      />

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title="Usuwanie raportu"
        description="Czy na pewno chcesz usunąć ten raport?"
        onConfirm={confirmDelete}
        confirmText="Usuń"
        cancelText="Anuluj"
      />
    </div>
  )
}

