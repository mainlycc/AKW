'use client'

import { useMemo, useState } from "react"
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
import { sendDeclarationReminderToTutor } from "./actions"
import { ComposeSendDialog } from "@/components/messaging/compose-send-dialog"
import { LABELS, nextMonthPlanReminderMessage } from "@/lib/labels/reports-declarations"

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
  const [composeChannel, setComposeChannel] = useState<NotificationChannel>('email')
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeDefaultMessage, setComposeDefaultMessage] = useState('')
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

  const filterTutorsBySearch = (list: { id: string; full_name: string }[], query: string) => {
    if (!query.trim()) return list
    const searchLower = query.toLowerCase().trim()
    return list.filter(t => {
      const fullNameLower = t.full_name.toLowerCase()
      if (fullNameLower.includes(searchLower)) return true
      const nameWords = fullNameLower.split(/\s+/)
      const searchWords = searchLower.split(/\s+/)
      return searchWords.every(word => nameWords.some(nameWord => nameWord.includes(word)))
    })
  }

  const filteredTutorsWithoutDeclarations = useMemo(() => {
    return filterTutorsBySearch(tutorsWithoutDeclarationsForPeriod, searchMissing)
  }, [searchMissing, tutorsWithoutDeclarationsForPeriod])

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

  const getDefaultReminderMessage = (month: number, year: number) => {
    const monthLabel = months[month - 1] || `${month}`
    return nextMonthPlanReminderMessage(monthLabel, year)
  }

  const openComposeForSelected = () => {
    if (monthFilter === 'all') {
      toast.info('Wybierz konkretny miesiąc, aby wysłać przypomnienia.')
      return
    }
    setComposeDefaultMessage(getDefaultReminderMessage(Number(monthFilter), yearFilter))
    setComposeOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">{LABELS.tutorPlans}</p>
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
          <Select
            value={monthFilter}
            onValueChange={(v) => {
              setMonthFilter(v)
              setSelectedTutorIds(new Set())
              setSearchMissing('')
            }}
          >
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
            onValueChange={(v) => {
              setYearFilter(parseInt(v))
              setSelectedTutorIds(new Set())
              setSearchMissing('')
            }}
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
                  {LABELS.noNextMonthPlanToDisplay}
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
              {LABELS.selectMonthForMissingNextMonthPlans}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="relative flex-1 max-w-md">
                  <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Szukaj po nazwisku tutora..."
                    value={searchMissing}
                    onChange={(e) => {
                      const nextQuery = e.target.value
                      setSearchMissing(nextQuery)

                      // usuń zaznaczenia tutorów niewidocznych po zmianie wyszukiwania
                      const nextVisibleIds = new Set(
                        filterTutorsBySearch(tutorsWithoutDeclarationsForPeriod, nextQuery).map((t) => t.id)
                      )
                      setSelectedTutorIds((prev) => {
                        const next = new Set<string>()
                        prev.forEach((id) => {
                          if (nextVisibleIds.has(id)) next.add(id)
                        })
                        return next
                      })
                    }}
                    className="pl-8"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={openComposeForSelected}
                    disabled={sendingSelectedReminders || selectedTutorIds.size === 0}
                  >
                    {sendingSelectedReminders ? 'Wysyłanie...' : `Wyślij (${selectedTutorIds.size})`}
                  </Button>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTutorsWithoutDeclarations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
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

      <ComposeSendDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        title={LABELS.reminderNextMonthPlanDialog}
        description={
          monthFilter === 'all'
            ? 'Wybierz konkretny miesiąc, aby wysłać przypomnienia.'
            : `Okres: ${months[Number(monthFilter) - 1]} ${yearFilter}`
        }
        defaultMessage={composeDefaultMessage}
        defaultChannel={composeChannel}
        messagePlaceholder="Wpisz treść przypomnienia..."
        confirmLabel="Wyślij przypomnienie"
        onSend={async ({ message, channel }) => {
          setComposeChannel(channel)

          if (monthFilter === 'all') {
            toast.info('Wybierz konkretny miesiąc, aby wysłać przypomnienia.')
            return
          }

          const month = Number(monthFilter)
          const year = yearFilter
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
              const tutor = filteredTutorsWithoutDeclarations.find((t) => t.id === tutorId)
              if (!tutor) continue
              const result = await sendDeclarationReminderToTutor(tutorId, month, year, channel, message)
              if (result.success) {
                successCount++
                if (result.error) {
                  errorCount++
                  errors.push(`${tutor.full_name}: ${result.error}`)
                }
              } else {
                errorCount++
                errors.push(`${tutor.full_name}: ${result.error || 'Nie udało się wysłać przypomnienia'}`)
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
          } finally {
            setSendingSelectedReminders(false)
          }
        }}
      />
    </div>
  )
}

