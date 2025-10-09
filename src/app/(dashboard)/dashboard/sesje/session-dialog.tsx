'use client'

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createSession } from "./actions"

interface Assignment {
  id: string
  students: { id: string; first_name: string; last_name: string }
  profiles: { id: string; full_name: string }
  subjects: { id: string; name: string }
  subject_levels: { id: string; level_name: string }
}

interface SessionDialogProps {
  open: boolean
  onClose: () => void
  assignments: Assignment[]
  userId: string
}

export function SessionDialog({ open, onClose, assignments, userId }: SessionDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    assignment_id: '',
    session_date: '',
    session_time: '',
    duration_minutes: 60,
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.assignment_id || !formData.session_date || !formData.session_time) {
      alert('Wszystkie wymagane pola muszą być wypełnione')
      return
    }

    setLoading(true)

    try {
      const sessionDateTime = `${formData.session_date}T${formData.session_time}:00`
      
      await createSession({
        assignment_id: formData.assignment_id,
        session_date: sessionDateTime,
        duration_minutes: formData.duration_minutes,
        notes: formData.notes,
        created_by: userId,
      })
      
      onClose()
      setFormData({
        assignment_id: '',
        session_date: '',
        session_time: '',
        duration_minutes: 60,
        notes: '',
      })
    } catch (error) {
      console.error('Error creating session:', error)
      alert('Błąd podczas tworzenia sesji')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Dodaj sesję korepetycji</DialogTitle>
          <DialogDescription>
            Wprowadź szczegóły przeprowadzonej sesji
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assignment_id">Przypisanie (Uczeń - Tutor - Przedmiot)</Label>
            <Select
              value={formData.assignment_id}
              onValueChange={(value) => setFormData({ ...formData, assignment_id: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz przypisanie" />
              </SelectTrigger>
              <SelectContent>
                {assignments.map((assignment) => (
                  <SelectItem key={assignment.id} value={assignment.id}>
                    {assignment.students.first_name} {assignment.students.last_name} -{' '}
                    {assignment.profiles.full_name} - {assignment.subjects.name} (
                    {assignment.subject_levels.level_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="session_date">Data sesji</Label>
              <Input
                id="session_date"
                type="date"
                value={formData.session_date}
                onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session_time">Godzina rozpoczęcia</Label>
              <Input
                id="session_time"
                type="time"
                value={formData.session_time}
                onChange={(e) => setFormData({ ...formData, session_time: e.target.value })}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration_minutes">Czas trwania (minuty)</Label>
            <Input
              id="duration_minutes"
              type="number"
              min="15"
              step="15"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notatki (opcjonalnie)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notatki z sesji..."
              disabled={loading}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Dodawanie...' : 'Dodaj sesję'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

