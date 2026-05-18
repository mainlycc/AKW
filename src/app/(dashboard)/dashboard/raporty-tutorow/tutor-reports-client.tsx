'use client'

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ReusableTable } from "@/components/reusable-table"
import { ReportDetailDialog } from "./report-detail-dialog"
import { deleteReports } from "./actions"
import { IconDownload } from "@tabler/icons-react"
import { formatHours } from "@/lib/utils"
import { LABELS } from "@/lib/labels/reports-declarations"

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

interface TutorReportsClientProps {
  reports: MonthlyReport[]
  tutors: Tutor[]
}

const statusLabels: Record<string, string> = {
  draft: 'Roboczy',
  submitted: 'Złożony',
  approved: 'Zatwierdzony',
  paid: 'Opłacony',
}

const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']

export function TutorReportsClient({ reports, tutors }: TutorReportsClientProps) {
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Normalize raportów: status submitted traktujemy jako approved, kwota wyliczana gdy brak
  const normalizedReports = useMemo(() => {
    return reports.map(report => {
      const hourlyRate = report.profiles.hourly_rate || 0
      return {
        ...report,
        status: report.status === 'submitted' ? 'approved' : report.status,
        total_amount: report.total_amount ?? report.total_hours * hourlyRate,
      }
    })
  }, [reports])

  const handleRowClick = (report: MonthlyReport) => {
    setSelectedReport(report)
    setDialogOpen(true)
  }

  const handleDeleteSelected = async (selectedRows: MonthlyReport[]) => {
    const reportIds = selectedRows.map(row => row.id)
    await deleteReports(reportIds)
  }

  const columns: ColumnDef<MonthlyReport>[] = useMemo(() => [
    {
      id: 'tutor',
      header: 'Tutor',
      accessorFn: (row) => row.profiles.full_name,
      cell: ({ row }) => (
        <span className="font-medium">{row.original.profiles.full_name}</span>
      ),
    },
    {
      id: 'period',
      header: 'Okres',
      accessorFn: (row) => `${months[row.month - 1]} ${row.year}`,
      cell: ({ row }) => {
        const report = row.original
        return `${months[report.month - 1]} ${report.year}`
      },
    },
    {
      id: 'total_hours',
      header: () => <div className="text-right">Godziny</div>,
      accessorFn: (row) => row.total_hours,
      cell: ({ row }) => (
        <div className="text-right">{formatHours(row.original.total_hours)} h</div>
      ),
    },
    {
      id: 'hourly_rate',
      header: () => <div className="text-right">Stawka</div>,
      accessorFn: (row) => row.profiles.hourly_rate,
      cell: ({ row }) => {
        const rate = row.original.profiles.hourly_rate
        return (
          <div className="text-right">
            {rate ? `${rate.toFixed(0)} zł` : '-'}
          </div>
        )
      },
    },
    {
      id: 'total_amount',
      header: () => <div className="text-right">Kwota</div>,
      accessorFn: (row) => row.total_amount,
      cell: ({ row }) => {
        const amount = row.original.total_amount
        return (
          <div className="text-right">
            {amount ? `${amount.toFixed(2)} zł` : '-'}
          </div>
        )
      },
    },
  ], [])

  const handleExportCSV = () => {
    const headers = ['Tutor', 'Miesiąc', 'Rok', 'Godziny', 'Stawka (zł/h)', 'Kwota (zł)', 'Status']
    const rows = normalizedReports.map(r => [
      r.profiles.full_name,
      r.month,
      r.year,
      r.total_hours.toFixed(2),
      (r.profiles.hourly_rate || 0).toFixed(0),
      (r.total_amount || 0).toFixed(2),
      statusLabels[r.status] || r.status,
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `raporty-tutorow-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const totalStats = useMemo(() => {
    return {
      totalHours: normalizedReports.reduce((sum, r) => sum + r.total_hours, 0),
      totalAmount: normalizedReports.reduce((sum, r) => sum + (r.total_amount || 0), 0),
    }
  }, [normalizedReports])

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">{LABELS.completedLessonsCount}</p>
          <p className="text-2xl font-bold">{normalizedReports.length}</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Suma godzin</p>
          <p className="text-2xl font-bold">{formatHours(totalStats.totalHours)} h</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Suma wypłat</p>
          <p className="text-2xl font-bold">{totalStats.totalAmount.toFixed(2)} zł</p>
        </div>
      </div>

      <ReusableTable
        columns={columns}
        data={normalizedReports}
        searchable={true}
        searchPlaceholder="Szukaj po nazwisku tutora..."
        customGlobalFilterFn={(row, filterValue) => {
          if (!filterValue.trim()) return true
          
          const searchLower = filterValue.toLowerCase().trim()
          const fullNameLower = row.profiles.full_name.toLowerCase()
          
          // Wyszukiwanie po pełnym imieniu i nazwisku
          if (fullNameLower.includes(searchLower)) {
            return true
          }
          
          // Wyszukiwanie po osobnych słowach (imię lub nazwisko)
          const nameWords = fullNameLower.split(/\s+/)
          const searchWords = searchLower.split(/\s+/)
          
          // Sprawdź czy wszystkie słowa z wyszukiwania znajdują się w imieniu/nazwisku
          return searchWords.every(word => 
            nameWords.some(nameWord => nameWord.includes(word))
          )
        }}
        onRowClick={handleRowClick}
        enableRowSelection={true}
        enablePagination={true}
        pageSize={50}
        emptyMessage={LABELS.noCompletedLessonsToDisplay}
        enableDeleteDialog={true}
        onConfirmDelete={handleDeleteSelected}
        deleteDialogTitle={LABELS.deleteCompletedLessonsTitle}
        deleteDialogDescription={LABELS.deleteCompletedLessonsDescription}
        customToolbarButtons={() => (
          <Button variant="outline" onClick={handleExportCSV} size="sm">
            <IconDownload className="mr-2 h-4 w-4" />
            CSV
          </Button>
        )}
      />

      <ReportDetailDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        report={selectedReport}
      />
    </div>
  )
}

