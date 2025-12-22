'use client'

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DeclarationEntry } from "../actions"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

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

interface AddLessonDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (entry: DeclarationEntry) => void
  assignments: Assignment[]
  month: number
  year: number
}

export function AddLessonDialog({
  open,
  onClose,
  onAdd,
  assignments,
  month,
  year,
}: AddLessonDialogProps) {
  const [assignmentId, setAssignmentId] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const durationMinutes = 60 // Zawsze 1 godzina

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setAssignmentId('')
      setSessionDate('')
      setStartTime('')
    }
  }, [open])

  // Get available dates for the selected month
  const getAvailableDates = () => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const dates: string[] = []
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day)
      dates.push(format(date, 'yyyy-MM-dd'))
    }
    return dates
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!assignmentId || !sessionDate || !startTime) {
      return
    }

    const selectedAssignment = assignments.find(a => a.id === assignmentId)
    if (!selectedAssignment) {
      return
    }

    // End time is always 1 hour after start time
    const [hours] = startTime.split(':').map(Number)
    const endHour = (hours + 1) % 24
    const endTime = `${endHour.toString().padStart(2, '0')}:00`

    const entry: DeclarationEntry = {
      student_id: selectedAssignment.student_id,
      session_date: sessionDate,
      start_time: startTime,
      duration_minutes: durationMinutes,
      assignment_id: assignmentId,
    }

    onAdd(entry)
    onClose()
  }

  const availableDates = getAvailableDates()

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dodaj lekcję</DialogTitle>
          <DialogDescription>
            Dodaj nową lekcję do deklaracji
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Uczeń</Label>
            <Select value={assignmentId} onValueChange={setAssignmentId} required>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz ucznia" />
              </SelectTrigger>
              <SelectContent>
                {assignments.map((assignment) => (
                  <SelectItem key={assignment.id} value={assignment.id}>
                    {assignment.student.first_name} {assignment.student.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Select value={sessionDate} onValueChange={setSessionDate} required>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz datę" />
              </SelectTrigger>
              <SelectContent>
                {availableDates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {format(new Date(date), 'dd.MM.yyyy (EEEE)', { locale: pl })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Godzina rozpoczęcia</Label>
            <Select value={startTime} onValueChange={setStartTime} required>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz godzinę" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = i.toString().padStart(2, '0')
                  return (
                    <SelectItem key={hour} value={`${hour}:00`}>
                      {hour}:00
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Czas trwania: 1 godzina
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" disabled={!assignmentId || !sessionDate || !startTime}>
              Dodaj lekcję
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

