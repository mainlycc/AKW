'use client'

import { useEffect, useMemo, useState } from "react"
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
import { createSession, getSuggestedSessionTimes } from "./actions"
import type { SuggestedTimeSlot } from "@/lib/types/availability.types"

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
  const [suggestions, setSuggestions] = useState<SuggestedTimeSlot[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const [selectedSuggestionKey, setSelectedSuggestionKey] = useState<string>('')

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === formData.assignment_id),
    [assignments, formData.assignment_id]
  )

  const canFetchSuggestions = formData.duration_minutes === 60 && !!selectedAssignment

  useEffect(() => {
    if (!open) {
      return
    }

    if (!canFetchSuggestions || !selectedAssignment?.profiles.id || !selectedAssignment.students.id) {
      setSuggestions([])
      setSelectedSuggestionKey('')
      return
    }

    let isCancelled = false

    const fetchSuggestions = async () => {
      setSuggestionsLoading(true)
      setSuggestionsError(null)

      try {
        const data = await getSuggestedSessionTimes({
          tutorId: selectedAssignment.profiles.id,
          studentId: selectedAssignment.students.id,
          durationMinutes: formData.duration_minutes,
        })

        if (!isCancelled) {
          setSuggestions(data)
          if (data.length === 0) {
            setSelectedSuggestionKey('')
          } else if (data.length > 0 && data[0]) {
            const currentKey = `${formData.session_date}-${formData.session_time}`
            const exists = data.some(
              (item) => `${item.date}-${item.startTime}` === currentKey
            )
            if (!exists) {
              setSelectedSuggestionKey('')
            } else {
              setSelectedSuggestionKey(currentKey)
            }
          }
        }
      } catch (error) {
        console.error('Nie udało się pobrać sugerowanych terminów:', error)
        if (!isCancelled) {
          setSuggestionsError('Nie udało się pobrać sugerowanych terminów.')
          setSuggestions([])
          setSelectedSuggestionKey('')
        }
      } finally {
        if (!isCancelled) {
          setSuggestionsLoading(false)
        }
      }
    }

    fetchSuggestions()

    return () => {
      isCancelled = true
    }
  }, [
    open,
    canFetchSuggestions,
    formData.duration_minutes,
    formData.session_date,
    formData.session_time,
    selectedAssignment,
  ])

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
      setSuggestions([])
      setSelectedSuggestionKey('')
    } catch (error) {
      console.error('Error creating session:', error)
      alert('Błąd podczas tworzenia sesji')
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionPick = (suggestion: SuggestedTimeSlot) => {
    setFormData((prev) => ({
      ...prev,
      session_date: suggestion.date,
      session_time: suggestion.startTime,
    }))
    setSelectedSuggestionKey(`${suggestion.date}-${suggestion.startTime}`)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose()
      if (!loading) {
        setSuggestions([])
        setSelectedSuggestionKey('')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
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
                    {assignment.students.first_name} {assignment.students.last_name} ·{" "}
                    {assignment.profiles.full_name} · {assignment.subjects.name} (
                    {assignment.subject_levels.level_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canFetchSuggestions && (
            <div className="space-y-2">
              <Label>Sugerowane terminy</Label>
              <div className="space-y-2">
                {suggestionsLoading && (
                  <p className="text-sm text-muted-foreground">Ładuję propozycje...</p>
                )}
                {suggestionsError && (
                  <p className="text-sm text-destructive">{suggestionsError}</p>
                )}
                {!suggestionsLoading && !suggestionsError && suggestions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Brak wolnych slotów w najbliższych tygodniach.
                  </p>
                )}
                {!suggestionsLoading && suggestions.length > 0 && (
                  <div className="grid gap-2">
                    {suggestions.map((suggestion) => {
                      const suggestionKey = `${suggestion.date}-${suggestion.startTime}`
                      const isSelected = selectedSuggestionKey === suggestionKey
                      return (
                        <Button
                          key={suggestionKey}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => handleSuggestionPick(suggestion)}
                          className="justify-start text-left"
                          disabled={loading}
                        >
                          {suggestion.label}
                        </Button>
                      )
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Sugestie bazują na kalendarzu dostępności tutora i pomijają już zarezerwowane sloty.
                </p>
              </div>
            </div>
          )}

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
              min="60"
              step="60"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: Number.parseInt(e.target.value, 10) || 60 })}
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Sugestie terminów są dostępne dla sesji trwających 60 minut.
            </p>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
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

