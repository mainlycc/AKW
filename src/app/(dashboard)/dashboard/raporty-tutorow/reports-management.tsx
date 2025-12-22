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
import { Input } from "@/components/ui/input"
import { ReportDetailDialog } from "./report-detail-dialog"
import { autoApproveSubmittedReports } from "./actions"
import { IconDownload, IconSearch } from "@tabler/icons-react"

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
  tutors?: Tutor[]
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

// Funkcja formatująca godziny bez końcowych zer
const formatHours = (hours: number): string => {
  return parseFloat(hours.toFixed(2)).toString()
}

export function ReportsManagement({ reports, adminId }: ReportsManagementProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

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
    if (!search.trim()) return reports
    
    const searchLower = search.toLowerCase().trim()
    return reports.filter(report => {
      const fullNameLower = report.profiles.full_name.toLowerCase()
      
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
    })
  }, [reports, search])

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
          <p className="text-2xl font-bold">{formatHours(totalStats.totalHours)} h</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Suma wypłat</p>
          <p className="text-2xl font-bold">{totalStats.totalAmount.toFixed(2)} zł</p>
        </div>
      </div>

      {/* Wyszukiwarka i przyciski */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwisku tutora..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
          <IconDownload className="mr-2 h-4 w-4" />
          CSV
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table className="w-full">
          <colgroup>
            <col className="w-[16.66%]" />
            <col className="w-[16.66%]" />
            <col className="w-[16.66%]" />
            <col className="w-[16.66%]" />
            <col className="w-[16.66%]" />
            <col className="w-[16.66%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Tutor</TableHead>
              <TableHead className="px-4">Okres</TableHead>
              <TableHead className="px-4 text-right">Godziny</TableHead>
              <TableHead className="px-4 text-right">Stawka</TableHead>
              <TableHead className="px-4 text-right">Kwota</TableHead>
              <TableHead className="px-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                  <TableCell className="px-4 font-medium">{report.profiles.full_name}</TableCell>
                  <TableCell className="px-4">{months[report.month - 1]} {report.year}</TableCell>
                  <TableCell className="px-4 text-right">{formatHours(report.total_hours)} h</TableCell>
                  <TableCell className="px-4 text-right">
                    {report.profiles.hourly_rate ? `${report.profiles.hourly_rate.toFixed(2)} zł` : '-'}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    {report.total_amount ? `${report.total_amount.toFixed(2)} zł` : '-'}
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge variant={statusVariants[report.status]}>
                      {statusLabels[report.status]}
                    </Badge>
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
    </div>
  )
}

