'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createOrUpdateDeclaration, generateLessonsFromBookedSlots, type DeclarationEntry } from "../actions"
import { DeclarationCalendar } from "../declaration-calendar"
import { AddLessonDialog } from "./add-lesson-dialog"
import { toast } from "sonner"
import Link from "next/link"
import { IconArrowLeft, IconPlus } from "@tabler/icons-react"

interface Student {
  id: string
  first_name: string
  last_name: string
}

interface Assignment {
  id: string
  student_id: string
  student: Student
}

interface DeclarationFormProps {
  tutorId: string
  students: Student[]
  assignments?: Assignment[]
  declarationId?: string
  initialDeclaration?: {
    month: number
    year: number
    entries: DeclarationEntry[]
  }
}

const months = [
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

export function DeclarationForm({ 
  tutorId, 
  students,
  assignments = [],
  declarationId,
  initialDeclaration 
}: DeclarationFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [addLessonDialogOpen, setAddLessonDialogOpen] = useState(false)
  const [month, setMonth] = useState(() => {
    if (initialDeclaration) {
      return initialDeclaration.month
    }
    const currentDate = new Date()
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    return nextMonth.getMonth() + 1
  })
  const [year, setYear] = useState(() => {
    if (initialDeclaration) {
      return initialDeclaration.year
    }
    const currentDate = new Date()
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    return nextMonth.getFullYear()
  })
  const [entries, setEntries] = useState<DeclarationEntry[]>(initialDeclaration?.entries || [])

  const handleGenerateFromBookedSlots = async () => {
    setGenerating(true)
    try {
      const generatedEntries = await generateLessonsFromBookedSlots(tutorId, month, year)
      if (generatedEntries.length === 0) {
        toast.info('Brak dostępnych slotów do wygenerowania lekcji')
      } else {
        setEntries(generatedEntries)
        toast.success(`Wygenerowano ${generatedEntries.length} lekcji`)
      }
    } catch (error) {
      console.error('Error generating lessons:', error)
      toast.error('Błąd podczas generowania lekcji z dostępności')
    } finally {
      setGenerating(false)
    }
  }

  const handleRemoveEntry = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddEntry = (entry: DeclarationEntry) => {
    setEntries(prev => [...prev, entry])
    toast.success('Lekcja dodana')
  }

  const handleSaveDraft = async () => {
    await handleSubmit('draft')
  }

  const handleSubmitDeclaration = async () => {
    await handleSubmit('submitted')
  }

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    setLoading(true)

    try {
      if (entries.length === 0) {
        toast.error('Dodaj co najmniej jedną lekcję')
        setLoading(false)
        return
      }

      await createOrUpdateDeclaration(tutorId, month, year, entries, status, declarationId)
      toast.success(status === 'draft' ? 'Deklaracja zapisana' : 'Deklaracja złożona')
      router.push('/dashboard/moje-deklaracje')
      router.refresh()
    } catch (error) {
      console.error('Error saving declaration:', error)
      toast.error('Błąd podczas zapisywania deklaracji')
    } finally {
      setLoading(false)
    }
  }

  const years = Array.from({ length: 3 }, (_, i) => {
    const currentDate = new Date()
    return currentDate.getFullYear() + i
  })

  // Check if month/year is in the future
  const isFutureMonth = () => {
    const selectedDate = new Date(year, month - 1, 1)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return selectedDate >= today
  }

  return (
    <div className="space-y-6">
      {/* Kompaktowy pasek wyboru miesiąca/roku z przyciskiem */}
      <div className="flex items-end gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="space-y-1.5 flex-1 max-w-[200px]">
            <Label className="text-sm">Miesiąc</Label>
            <Select 
              value={month.toString()} 
              onValueChange={(v) => setMonth(parseInt(v))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1 max-w-[150px]">
            <Label className="text-sm">Rok</Label>
            <Select 
              value={year.toString()} 
              onValueChange={(v) => setYear(parseInt(v))}
            >
              <SelectTrigger className="h-9">
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
        <div className="flex gap-2">
          {!initialDeclaration && (
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateFromBookedSlots}
              disabled={generating || !isFutureMonth()}
              className="h-9"
            >
              {generating ? 'Generowanie...' : 'Wypełnij swoim grafikiem dostępności'}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => setAddLessonDialogOpen(true)}
            className="h-9"
          >
            <IconPlus className="mr-2 h-4 w-4" />
            Dodaj lekcję
          </Button>
        </div>
      </div>

      {/* Kalendarz z lekcjami */}
      <DeclarationCalendar
        month={month}
        year={year}
        entries={entries}
        students={students}
        onRemoveEntry={handleRemoveEntry}
      />

      {/* Przyciski */}
      <div className="flex justify-end gap-2">
        <Link href="/dashboard/moje-deklaracje">
          <Button type="button" variant="outline" disabled={loading}>
            Anuluj
          </Button>
        </Link>
        <Button 
          type="button" 
          variant="secondary" 
          onClick={handleSaveDraft} 
          disabled={loading || entries.length === 0}
        >
          {loading ? 'Zapisywanie...' : 'Zapisz roboczą'}
        </Button>
        <Button 
          type="button" 
          onClick={handleSubmitDeclaration} 
          disabled={loading || entries.length === 0}
        >
          {loading ? 'Wysyłanie...' : 'Złóż deklarację'}
        </Button>
      </div>

      {/* Dialog dodawania lekcji */}
      <AddLessonDialog
        open={addLessonDialogOpen}
        onClose={() => setAddLessonDialogOpen(false)}
        onAdd={handleAddEntry}
        assignments={assignments}
        month={month}
        year={year}
      />
    </div>
  )
}

