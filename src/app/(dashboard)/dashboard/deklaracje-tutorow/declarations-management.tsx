'use client'

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { DeclarationDetailDialog } from "./declaration-detail-dialog"
import { IconSearch } from "@tabler/icons-react"
import { formatHours } from "@/lib/utils"
import { toast } from "sonner"
import type { NotificationChannel } from "@/lib/types/notifications"
import { sendDeclarationReminderToTutor, sendDeclarationRemindersToAllMissing } from "./actions"

interface DeclarationEntry {
  id: string
  session_date: string
  start_time: string
  duration_minutes: number
  students: {
    first_name: string
    last_name: string
  }
}

interface MonthlyDeclaration {
  id: string
  month: number
  year: number
  status: string
  submitted_at: string | null
  approved_at: string | null
  created_at: string
  profiles: {
    id: string
    full_name: string
  }
  monthly_declaration_entries: DeclarationEntry[]
}

interface DeclarationsManagementProps {
  declarations: MonthlyDeclaration[]
  tutors?: { id: string; full_name: string }[]
  adminId: string
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

export function DeclarationsManagement({ declarations, tutors = [], adminId }: DeclarationsManagementProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [searchMissing, setSearchMissing] = useState('')
  const [selectedDeclaration, setSelectedDeclaration] = useState<MonthlyDeclaration | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const currentDate = new Date()
  const [yearFilter, setYearFilter] = useState<number>(currentDate.getFullYear())
  const [channel, setChannel] = useState<NotificationChannel>('email')
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const [sendingAllReminders, setSendingAllReminders] = useState(false)
  const [sendingSelectedReminders, setSendingSelectedReminders] = useState(false)
  const [selectedTutorIds, setSelectedTutorIds] = useState<Set<string>>(new Set())
  const years = Array.from({ length: 3 }, (_, i) => currentDate.getFullYear() - i)

  const submittedDeclarations = useMemo(() => {
    const filteredByYear = declarations.filter(d => d.year === yearFilter)
    const filteredByMonth =
      monthFilter === 'all'
        ? filteredByYear
        : filteredByYear.filter(d => d.month === Number(monthFilter))
    // "Złożone" rozumiemy jako nie-robocze (submitted/approved)
    return filteredByMonth.filter(d => d.status !== 'draft')
  }, [declarations, monthFilter, yearFilter])

  const filteredSubmittedDeclarations = useMemo(() => {
    if (!search.trim()) return submittedDeclarations
    
    const searchLower = search.toLowerCase().trim()
    return submittedDeclarations.filter(declaration => {
      const fullNameLower = declaration.profiles.full_name.toLowerCase()
      
      if (fullNameLower.includes(searchLower)) {
        return true
      }
      
      const nameWords = fullNameLower.split(/\s+/)
      const searchWords = searchLower.split(/\s+/)
      
      return searchWords.every(word => 
        nameWords.some(nameWord => nameWord.includes(word))
      )
    })
  }, [search, submittedDeclarations])

  const handleRowClick = (declaration: MonthlyDeclaration) => {
    setSelectedDeclaration(declaration)
    setDialogOpen(true)
  }

  const calculateTotalHours = (entries: DeclarationEntry[]) => {
    return entries.reduce((sum, e) => sum + (e.duration_minutes / 60), 0)
  }

  const totalStats = useMemo(() => {
    return {
      totalHours: filteredSubmittedDeclarations.reduce((sum, d) => sum + calculateTotalHours(d.monthly_declaration_entries), 0),
      totalLessons: filteredSubmittedDeclarations.reduce((sum, d) => sum + d.monthly_declaration_entries.length, 0),
      declarationsCount: filteredSubmittedDeclarations.length,
    }
  }, [filteredSubmittedDeclarations])

  const tutorsWithoutDeclarationsForPeriod = useMemo(() => {
    if (monthFilter === 'all') return []
    const month = Number(monthFilter)
    const tutorsWithDeclaration = new Set(
      declarations
        .filter(d => d.year === yearFilter && d.month === month && d.status !== 'draft')
        .map(d => d.profiles.id)
    )
    return tutors.filter(t => !tutorsWithDeclaration.has(t.id))
  }, [declarations, monthFilter, tutors, yearFilter])

  const filteredTutorsWithoutDeclarations = useMemo(() => {
    if (!searchMissing.trim()) return tutorsWithoutDeclarationsForPeriod
    const searchLower = searchMissing.toLowerCase().trim()
    return tutorsWithoutDeclarationsForPeriod.filter(t => {
      const fullNameLower = t.full_name.toLowerCase()
      if (fullNameLower.includes(searchLower)) return true
      const nameWords = fullNameLower.split(/\s+/)
      const searchWords = searchLower.split(/\s+/)
      return searchWords.every(word => nameWords.some(nameWord => nameWord.includes(word)))
    })
  }, [searchMissing, tutorsWithoutDeclarationsForPeriod])

  useEffect(() => {
    const visibleTutorIds = new Set(filteredTutorsWithoutDeclarations.map(t => t.id))
    setSelectedTutorIds(prev => {
      const next = new Set<string>()
      prev.forEach(id => {
        if (visibleTutorIds.has(id)) next.add(id)
      })
      return next
    })
  }, [searchMissing, filteredTutorsWithoutDeclarations])

  useEffect(() => {
    setSelectedTutorIds(new Set())
  }, [monthFilter, yearFilter])

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTutorIds(new Set(filteredTutorsWithoutDeclarations.map(t => t.id)))
    } else {
      setSelectedTutorIds(new Set())
    }
  }

  const toggleSelectTutor = (tutorId: string) => {
    setSelectedTutorIds(prev => {
      const next = new Set(prev)
      if (next.has(tutorId)) next.delete(tutorId)
      else next.add(tutorId)
      return next
    })
  }

  const isAllSelected =
    filteredTutorsWithoutDeclarations.length > 0 &&
    selectedTutorIds.size === filteredTutorsWithoutDeclarations.length
  const isSomeSelected =
    selectedTutorIds.size > 0 &&
    selectedTutorIds.size < filteredTutorsWithoutDeclarations.length

  const handleSendReminder = async (tutorId: string, tutorName: string) => {
    if (monthFilter === 'all') {
      toast.info('Wybierz konkretny miesiąc, aby wysłać przypomnienia.')
      return
    }
    setSendingReminder(tutorId)
    try {
      const result = await sendDeclarationReminderToTutor(
        tutorId,
        Number(monthFilter),
        yearFilter,
        channel
      )
      if (!result.success) {
        toast.error(result.error || 'Nie udało się wysłać przypomnienia')
      } else {
        toast.success(`Wysłano przypomnienie do ${tutorName}`)
      }
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wysłać przypomnienia')
    } finally {
      setSendingReminder(null)
    }
  }

  const handleSendAllReminders = async () => {
    if (monthFilter === 'all') {
      toast.info('Wybierz konkretny miesiąc, aby wysłać przypomnienia.')
      return
    }
    if (tutorsWithoutDeclarationsForPeriod.length === 0) {
      toast.info('Wszyscy tutorzy złożyli już deklarację za wybrany okres.')
      return
    }
    setSendingAllReminders(true)
    try {
      const result = await sendDeclarationRemindersToAllMissing(Number(monthFilter), yearFilter, channel)
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
    if (monthFilter === 'all') {
      toast.info('Wybierz konkretny miesiąc, aby wysłać przypomnienia.')
      return
    }
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
        const tutor = filteredTutorsWithoutDeclarations.find(t => t.id === tutorId)
        if (!tutor) continue
        try {
          const result = await sendDeclarationReminderToTutor(
            tutorId,
            Number(monthFilter),
            yearFilter,
            channel
          )
          if (!result.success) {
            errorCount++
            errors.push(`${tutor.full_name}: ${result.error || 'Nie udało się wysłać powiadomienia'}`)
          } else {
            successCount++
          }
        } catch (error) {
          errorCount++
          const msg = error instanceof Error ? error.message : 'Nieznany błąd'
          errors.push(`${tutor.full_name}: ${msg}`)
        }
      }

      if (errorCount === 0) {
        toast.success(`Wysłano ${successCount} przypomnień`)
      } else {
        toast.warning(`Wysłano ${successCount} przypomnień, ${errorCount} błędów`)
        if (errors.length > 0) console.error('Errors sending reminders:', errors)
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
          <p className="text-sm text-muted-foreground">Deklaracje</p>
          <p className="text-2xl font-bold">{totalStats.declarationsCount}</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Suma godzin</p>
          <p className="text-2xl font-bold">{formatHours(totalStats.totalHours)} h</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Liczba lekcji</p>
          <p className="text-2xl font-bold">{totalStats.totalLessons}</p>
        </div>
      </div>

      {/* Okres + kanał */}
      <div className="flex items-end gap-4 flex-wrap border rounded-md p-4 bg-muted/50">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Okres:</Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="month-filter">Miesiąc</Label>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger id="month-filter" className="w-[220px]">
              <SelectValue placeholder="Wszystkie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="year-filter">Rok</Label>
          <Select
            value={yearFilter.toString()}
            onValueChange={(v) => setYearFilter(parseInt(v))}
          >
            <SelectTrigger id="year-filter" className="w-[140px]">
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
        <div className="space-y-2">
          <Label htmlFor="channel">Kanał przypomnień</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v as NotificationChannel)}>
            <SelectTrigger id="channel" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="both">Email + SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="submitted" className="space-y-4">
        <TabsList>
          <TabsTrigger value="submitted">Złożone</TabsTrigger>
          <TabsTrigger value="missing">Niezłożone</TabsTrigger>
        </TabsList>

        <TabsContent value="submitted" className="space-y-4">
          {/* Wyszukiwarka */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="relative flex-1 max-w-md">
          <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwisku tutora..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tutor</TableHead>
              <TableHead>Okres</TableHead>
              <TableHead className="text-right">Liczba lekcji</TableHead>
              <TableHead className="text-right">Suma godzin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubmittedDeclarations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Brak deklaracji do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              filteredSubmittedDeclarations.map((declaration) => {
                const totalHours = calculateTotalHours(declaration.monthly_declaration_entries)
                const lessonCount = declaration.monthly_declaration_entries.length
                
                return (
                  <TableRow 
                    key={declaration.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(declaration)}
                  >
                    <TableCell className="font-medium">{declaration.profiles.full_name}</TableCell>
                    <TableCell>{months[declaration.month - 1]} {declaration.year}</TableCell>
                    <TableCell className="text-right">{lessonCount}</TableCell>
                    <TableCell className="text-right">{formatHours(totalHours)} h</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
        </TabsContent>

        <TabsContent value="missing" className="space-y-4">
          {monthFilter === 'all' ? (
            <div className="p-4 rounded-md border text-sm text-muted-foreground">
              Aby zobaczyć listę niezłożonych deklaracji i wysyłać przypomnienia, wybierz konkretny miesiąc (nie „Wszystkie”).
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
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
                  {selectedTutorIds.size > 0 ? (
                    <Button
                      onClick={handleSendSelectedReminders}
                      disabled={sendingSelectedReminders}
                    >
                      {sendingSelectedReminders
                        ? 'Wysyłanie...'
                        : selectedTutorIds.size === tutorsWithoutDeclarationsForPeriod.length
                          ? `Wyślij do wszystkich (${tutorsWithoutDeclarationsForPeriod.length})`
                          : `Wyślij do zaznaczonych (${selectedTutorIds.size})`}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSendAllReminders}
                      disabled={sendingAllReminders || tutorsWithoutDeclarationsForPeriod.length === 0}
                    >
                      {sendingAllReminders
                        ? 'Wysyłanie...'
                        : `Wyślij do wszystkich (${tutorsWithoutDeclarationsForPeriod.length})`}
                    </Button>
                  )}
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[44px]">
                        <Checkbox
                          checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                          onCheckedChange={(v) => toggleSelectAll(!!v)}
                        />
                      </TableHead>
                      <TableHead>Tutor</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTutorsWithoutDeclarations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Brak tutorów do wyświetlenia
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTutorsWithoutDeclarations.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedTutorIds.has(t.id)}
                              onCheckedChange={() => toggleSelectTutor(t.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{t.full_name}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendReminder(t.id, t.full_name)}
                              disabled={sendingReminder === t.id}
                            >
                              {sendingReminder === t.id ? 'Wysyłanie...' : 'Wyślij przypomnienie'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <DeclarationDetailDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        declaration={selectedDeclaration}
        adminId={adminId}
      />
    </div>
  )
}

