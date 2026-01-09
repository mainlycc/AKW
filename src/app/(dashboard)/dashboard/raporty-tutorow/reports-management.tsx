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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ReportDetailDialog } from "./report-detail-dialog"
import { autoApproveSubmittedReports, sendReportReminderToTutor, sendReportRemindersToAllMissing } from "./actions"
import { IconDownload, IconSearch, IconMail } from "@tabler/icons-react"
import { toast } from "sonner"

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

const monthOptions = [
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

// Funkcja formatująca godziny bez końcowych zer
const formatHours = (hours: number): string => {
  return parseFloat(hours.toFixed(2)).toString()
}

export function ReportsManagement({ reports, tutors = [], adminId }: ReportsManagementProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [searchMissing, setSearchMissing] = useState('')
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  
  // Stan dla wyboru okresu do przypomnień
  const currentDate = new Date()
  const [reminderMonth, setReminderMonth] = useState(currentDate.getMonth() + 1)
  const [reminderYear, setReminderYear] = useState(currentDate.getFullYear())
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const [sendingAllReminders, setSendingAllReminders] = useState(false)
  const [sendingSelectedReminders, setSendingSelectedReminders] = useState(false)
  const [selectedTutorIds, setSelectedTutorIds] = useState<Set<string>>(new Set())
  
  // Generuj listę lat (bieżący rok i 2 lata wstecz)
  const years = Array.from({ length: 3 }, (_, i) => currentDate.getFullYear() - i)

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

  // Znajdź tutorów bez złożonego raportu za wybrany okres
  const tutorsWithoutReports = useMemo(() => {
    // Utwórz zbiór ID tutorów, którzy mają złożony raport (submitted, approved, paid) za wybrany okres
    const tutorsWithReports = new Set(
      reports
        .filter(r => 
          r.month === reminderMonth && 
          r.year === reminderYear && 
          ['submitted', 'approved', 'paid'].includes(r.status)
        )
        .map(r => r.profiles.id)
    )

    // Zwróć tutorów, którzy nie mają złożonego raportu
    return tutors.filter(tutor => !tutorsWithReports.has(tutor.id))
  }, [reports, tutors, reminderMonth, reminderYear])

  // Filtrowanie tutorów bez raportu po wyszukiwaniu
  const filteredTutorsWithoutReports = useMemo(() => {
    if (!searchMissing.trim()) return tutorsWithoutReports
    
    const searchLower = searchMissing.toLowerCase().trim()
    return tutorsWithoutReports.filter(tutor => {
      const fullNameLower = tutor.full_name.toLowerCase()
      
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
  }, [tutorsWithoutReports, searchMissing])

  // Czyszczenie zaznaczeń tutorów, którzy nie są już widoczni po zmianie wyszukiwania
  useEffect(() => {
    const visibleTutorIds = new Set(filteredTutorsWithoutReports.map(t => t.id))
    setSelectedTutorIds(prev => {
      const newSelected = new Set<string>()
      prev.forEach(id => {
        if (visibleTutorIds.has(id)) {
          newSelected.add(id)
        }
      })
      return newSelected
    })
  }, [searchMissing])

  // Czyszczenie zaznaczeń przy zmianie okresu
  useEffect(() => {
    setSelectedTutorIds(new Set())
  }, [reminderMonth, reminderYear])

  // Funkcje do zarządzania zaznaczeniami
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTutorIds(new Set(filteredTutorsWithoutReports.map(t => t.id)))
    } else {
      setSelectedTutorIds(new Set())
    }
  }

  const toggleSelectTutor = (tutorId: string) => {
    const newSelected = new Set(selectedTutorIds)
    if (newSelected.has(tutorId)) {
      newSelected.delete(tutorId)
    } else {
      newSelected.add(tutorId)
    }
    setSelectedTutorIds(newSelected)
  }

  const isAllSelected = filteredTutorsWithoutReports.length > 0 && selectedTutorIds.size === filteredTutorsWithoutReports.length
  const isSomeSelected = selectedTutorIds.size > 0 && selectedTutorIds.size < filteredTutorsWithoutReports.length

  const handleSendReminder = async (tutorId: string, tutorName: string) => {
    setSendingReminder(tutorId)
    try {
      await sendReportReminderToTutor(tutorId, reminderMonth, reminderYear)
      toast.success(`Wysłano przypomnienie do ${tutorName}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wysłać przypomnienia')
    } finally {
      setSendingReminder(null)
    }
  }

  const handleSendAllReminders = async () => {
    if (tutorsWithoutReports.length === 0) {
      toast.info('Wszyscy tutorzy złożyli już raport za wybrany okres.')
      return
    }

    setSendingAllReminders(true)
    try {
      const result = await sendReportRemindersToAllMissing(reminderMonth, reminderYear)
      if (result.success) {
        toast.success(result.message || `Wysłano ${result.sent} przypomnień`)
      } else {
        toast.warning(result.message || `Wysłano ${result.sent} przypomnień${result.errors.length > 0 ? `, ${result.errors.length} błędów` : ''}`)
      }
      if (result.errors.length > 0) {
        console.error('Errors sending reminders:', result.errors)
      }
      setSelectedTutorIds(new Set())
      setSearchMissing('')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wysłać przypomnień')
    } finally {
      setSendingAllReminders(false)
    }
  }

  const handleSendSelectedReminders = async () => {
    if (selectedTutorIds.size === 0) {
      toast.info('Wybierz przynajmniej jednego tutora.')
      return
    }

    setSendingSelectedReminders(true)
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    try {
      for (const tutorId of selectedTutorIds) {
        const tutor = filteredTutorsWithoutReports.find(t => t.id === tutorId)
        if (!tutor) continue

        try {
          await sendReportReminderToTutor(tutorId, reminderMonth, reminderYear)
          successCount++
        } catch (error) {
          errorCount++
          const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd'
          errors.push(`${tutor.full_name}: ${errorMessage}`)
        }
      }

      if (errorCount === 0) {
        toast.success(`Wysłano ${successCount} przypomnień`)
      } else {
        toast.warning(`Wysłano ${successCount} przypomnień, ${errorCount} błędów`)
        if (errors.length > 0) {
          console.error('Errors sending reminders:', errors)
        }
      }
      
      setSelectedTutorIds(new Set())
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wysłać przypomnień')
    } finally {
      setSendingSelectedReminders(false)
    }
  }

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

      {/* Wybór okresu - wspólny dla obu zakładek */}
      <div className="flex items-end gap-4 flex-wrap border rounded-md p-4 bg-muted/50">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Okres:</Label>
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="reminder-month">Miesiąc</Label>
            <Select
              value={reminderMonth.toString()}
              onValueChange={(v) => setReminderMonth(parseInt(v))}
            >
              <SelectTrigger id="reminder-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(m => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reminder-year">Rok</Label>
            <Select
              value={reminderYear.toString()}
              onValueChange={(v) => setReminderYear(parseInt(v))}
            >
              <SelectTrigger id="reminder-year">
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
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="submitted" className="space-y-4">
        <TabsList>
          <TabsTrigger value="submitted">
            Złożone raporty
          </TabsTrigger>
          <TabsTrigger value="missing">
            Nie złożone
          </TabsTrigger>
        </TabsList>

        {/* Tab: Złożone raporty */}
        <TabsContent value="submitted" className="space-y-4">
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
        </TabsContent>

        {/* Tab: Nie złożone */}
        <TabsContent value="missing" className="space-y-4">
          {/* Wyszukiwarka i przyciski */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj po nazwisku tutora..."
                value={searchMissing}
                onChange={(e) => setSearchMissing(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              {selectedTutorIds.size > 0 && (
                <Button
                  onClick={handleSendSelectedReminders}
                  disabled={sendingSelectedReminders}
                  variant="default"
                >
                  <IconMail className="mr-2 h-4 w-4" />
                  {sendingSelectedReminders ? 'Wysyłanie...' : `Wyślij do wybranych (${selectedTutorIds.size})`}
                </Button>
              )}
              <Button
                onClick={handleSendAllReminders}
                disabled={tutorsWithoutReports.length === 0 || sendingAllReminders}
                variant="default"
              >
                <IconMail className="mr-2 h-4 w-4" />
                {sendingAllReminders ? 'Wysyłanie...' : `Wyślij do wszystkich (${tutorsWithoutReports.length})`}
              </Button>
            </div>
          </div>

          {/* Table */}
          {tutorsWithoutReports.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground border rounded-md">
              <p>Wszyscy tutorzy złożyli już raport za {months[reminderMonth - 1]} {reminderYear}</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table className="w-full">
                <colgroup>
                  <col className="w-[50px]" />
                  <col className="w-[25%]" />
                  <col className="w-[20%]" />
                  <col className="w-[auto]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">
                      <Checkbox
                        checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Zaznacz wszystkie"
                      />
                    </TableHead>
                    <TableHead className="px-4">Tutor</TableHead>
                    <TableHead className="px-4">Okres</TableHead>
                    <TableHead className="px-4 text-right">Akcja</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTutorsWithoutReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Brak wyników wyszukiwania
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTutorsWithoutReports.map((tutor) => (
                      <TableRow key={tutor.id}>
                        <TableCell className="px-4">
                          <Checkbox
                            checked={selectedTutorIds.has(tutor.id)}
                            onCheckedChange={() => toggleSelectTutor(tutor.id)}
                            aria-label={`Wybierz ${tutor.full_name}`}
                          />
                        </TableCell>
                        <TableCell className="px-4 font-medium">{tutor.full_name}</TableCell>
                        <TableCell className="px-4">
                          {months[reminderMonth - 1]} {reminderYear}
                        </TableCell>
                        <TableCell className="px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSendReminder(tutor.id, tutor.full_name)
                            }}
                            disabled={sendingReminder === tutor.id}
                          >
                            <IconMail className="mr-2 h-3 w-3" />
                            {sendingReminder === tutor.id ? 'Wysyłanie...' : 'Wyślij przypomnienie'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ReportDetailDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        report={selectedReport}
      />
    </div>
  )
}

