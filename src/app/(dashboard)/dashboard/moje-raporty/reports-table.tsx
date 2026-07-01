'use client'

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { deleteReport, type ReportStatus } from "./actions"
import { ReusableTable } from "@/components/reusable-table"
import { formatHours } from "@/lib/utils"
import { LABELS } from "@/lib/labels/reports-declarations"

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
  const router = useRouter()

  const columns = useMemo<ColumnDef<MonthlyReport>[]>(() => [
    {
      accessorKey: 'period',
      header: 'Okres',
      cell: ({ row }) => {
        const report = row.original
        return (
          <span className="font-medium">
            {months[report.month - 1]} {report.year}
          </span>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const report = row.original
        return (
          <Badge variant={statusVariants[report.status]}>
            {statusLabels[report.status]}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'total_hours',
      header: 'Suma godzin',
      cell: ({ row }) => {
        const report = row.original
        return `${formatHours(report.total_hours)} h`
      },
      meta: {
        cellClassName: 'text-right',
        headerClassName: 'text-right',
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Data utworzenia',
      cell: ({ row }) => {
        const report = row.original
        return new Date(report.created_at).toLocaleDateString('pl-PL')
      },
    },
  ], [])

  const handleAdd = () => {
    router.push('/dashboard/moje-raporty/nowy')
  }

  const handleDeleteSelected = async (selectedRows: MonthlyReport[]) => {
    const draftReports = selectedRows.filter(r => r.status === 'draft')
    if (draftReports.length === 0) {
      return
    }

    for (const report of draftReports) {
      await deleteReport(report.id)
    }
    router.refresh()
  }

  const handleRowClick = (report: MonthlyReport) => {
    if (report.status === 'draft') {
      router.push(`/dashboard/moje-raporty/${report.id}`)
    }
  }

  return (
    <ReusableTable
      columns={columns}
      data={reports}
      searchable={true}
      searchPlaceholder="Szukaj po okresie..."
      customGlobalFilterFn={(row, filterValue) => {
        const searchLower = filterValue.toLowerCase()
        const period = `${months[row.month - 1]} ${row.year}`.toLowerCase()
        const status = statusLabels[row.status].toLowerCase()
        return period.includes(searchLower) || status.includes(searchLower)
      }}
      onAdd={handleAdd}
      addButtonLabel={LABELS.createCompletedLessons}
      enableRowSelection={true}
      enablePagination={true}
      pageSize={10}
      emptyMessage={LABELS.emptyCompletedLessons}
      deleteButtonLabel="Usuń zaznaczone"
      enableDeleteDialog={true}
      onConfirmDelete={handleDeleteSelected}
      deleteDialogTitle={LABELS.deleteCompletedLessonsTitle}
      deleteDialogDescription={LABELS.deleteCompletedLessonsDescription}
      onRowClick={handleRowClick}
    />
  )
}

