'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { IconDownload } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

import {
  exportTutorSettlementsToCSV,
  getTutorSettlements,
  type TutorSettlementRow,
} from './actions'
import { markManyAsPaid } from '@/app/(dashboard)/dashboard/raporty-tutorow/actions'

const months = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
]

const statusLabels: Record<'approved' | 'paid', string> = {
  approved: 'Do wypłaty',
  paid: 'Wypłacone',
}

const statusVariant: Record<'approved' | 'paid', 'default' | 'secondary' | 'outline' | 'destructive'> = {
  approved: 'default',
  paid: 'secondary',
}

function formatHours(hours: number) {
  return parseFloat(hours.toFixed(2)).toString()
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function TutorSettlementsTable() {
  const router = useRouter()

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)
  const [search, setSearch] = useState('')

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<TutorSettlementRow[]>([])
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set())

  const years = [currentYear, currentYear - 1, currentYear - 2]

  const refresh = async (next?: {
    month?: number
    year?: number
  }) => {
    const nextMonth = next?.month ?? month
    const nextYear = next?.year ?? year

    setLoading(true)
    try {
      const data = await getTutorSettlements({
        month: nextMonth,
        year: nextYear,
        status: 'approved',
      })
      setRows(data)
      setSelectedReportIds(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nie udało się pobrać danych')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.tutor_name.toLowerCase().includes(q))
  }, [rows, search])

  const selectableReportIds = useMemo(() => {
    return filtered.filter((r) => r.status === 'approved').map((r) => r.report_id)
  }, [filtered])

  const allSelectableSelected = useMemo(() => {
    return (
      selectableReportIds.length > 0 &&
      selectableReportIds.every((id) => selectedReportIds.has(id))
    )
  }, [selectableReportIds, selectedReportIds])

  const handleExport = async () => {
    try {
      const csv = await exportTutorSettlementsToCSV(filtered)
      downloadCsv(csv, `rozliczenia-tutorow_${month}-${year}_approved.csv`)
      toast.success('Eksport zakończony pomyślnie')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nie udało się wyeksportować danych')
    }
  }

  const toggleSelectAll = () => {
    if (selectableReportIds.length === 0) return

    const next = new Set(selectedReportIds)
    if (allSelectableSelected) {
      selectableReportIds.forEach((id) => next.delete(id))
    } else {
      selectableReportIds.forEach((id) => next.add(id))
    }
    setSelectedReportIds(next)
  }

  const toggleSelectOne = (reportId: string) => {
    const next = new Set(selectedReportIds)
    if (next.has(reportId)) next.delete(reportId)
    else next.add(reportId)
    setSelectedReportIds(next)
  }

  const handleMarkSelectedAsPaid = async () => {
    const ids = Array.from(selectedReportIds)
    if (ids.length === 0) return

    try {
      await markManyAsPaid(ids)
      toast.success(
        `Oznaczono ${ids.length} ${ids.length === 1 ? 'raport' : 'raportów'} jako wypłacone`
      )
      setSelectedReportIds(new Set())
      await refresh()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nie udało się oznaczyć jako wypłacone')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 flex-wrap border rounded-md p-4 bg-muted/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 max-w-5xl">
          <div className="space-y-2">
            <label className="text-sm font-medium">Miesiąc</label>
            <Select
              value={month.toString()}
              onValueChange={async (v) => {
                const nextMonth = parseInt(v)
                setMonth(nextMonth)
                await refresh({ month: nextMonth })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((label, idx) => (
                  <SelectItem key={idx + 1} value={(idx + 1).toString()}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Rok</label>
            <Select
              value={year.toString()}
              onValueChange={async (v) => {
                const nextYear = parseInt(v)
                setYear(nextYear)
                await refresh({ year: nextYear })
              }}
            >
              <SelectTrigger>
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
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Szukaj</label>
            <Input
              placeholder="Tutor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleMarkSelectedAsPaid}
            disabled={selectedReportIds.size === 0 || loading}
          >
            Oznacz jako wypłacone
            {selectedReportIds.size > 0 ? ` (${selectedReportIds.size})` : ''}
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
            <IconDownload className="mr-2 h-4 w-4" />
            Eksport CSV
          </Button>
          <Button
            onClick={() => refresh()}
            disabled={loading}
          >
            {loading ? 'Pobieranie…' : 'Odśwież'}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox checked={allSelectableSelected} onCheckedChange={toggleSelectAll} />
              </TableHead>
              <TableHead>Tutor</TableHead>
              <TableHead>Okres</TableHead>
              <TableHead className="text-right">Godziny</TableHead>
              <TableHead className="text-right">Stawka</TableHead>
              <TableHead className="text-right">Kwota</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Ładowanie...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Brak danych
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.report_id}>
                  <TableCell className="w-12">
                    <Checkbox
                      checked={selectedReportIds.has(r.report_id)}
                      onCheckedChange={() => toggleSelectOne(r.report_id)}
                      disabled={r.status !== 'approved'}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="link" className="h-auto p-0 font-medium" asChild>
                      <Link href={`/dashboard/tutorzy/${r.tutor_id}`}>{r.tutor_name}</Link>
                    </Button>
                  </TableCell>
                  <TableCell>
                    {months[r.month - 1]} {r.year}
                  </TableCell>
                  <TableCell className="text-right">{formatHours(r.total_hours)} h</TableCell>
                  <TableCell className="text-right">{r.hourly_rate.toFixed(0)} zł/h</TableCell>
                  <TableCell className="text-right font-medium">{r.total_amount.toFixed(2)} zł</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[r.status]}>{statusLabels[r.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

