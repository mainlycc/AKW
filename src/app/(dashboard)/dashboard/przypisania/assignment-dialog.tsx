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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createAssignment } from "./actions"

interface Student {
  id: string
  first_name: string
  last_name: string
}

interface Tutor {
  id: string
  full_name: string
}

interface Subject {
  id: string
  name: string
  subject_levels: {
    id: string
    level_name: string
    level_order: number
    price_per_hour: number
  }[]
}

interface AssignmentDialogProps {
  open: boolean
  onClose: () => void
  students: Student[]
  tutors: Tutor[]
  subjects: Subject[]
  adminId: string
}

export function AssignmentDialog({
  open,
  onClose,
  students,
  tutors,
  subjects,
  adminId,
}: AssignmentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    student_id: '',
    tutor_id: '',
    subject_id: '',
    subject_level_id: '',
  })

  const selectedSubject = subjects.find((s) => s.id === formData.subject_id)
  const availableLevels = selectedSubject?.subject_levels || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.student_id || !formData.tutor_id || !formData.subject_id || !formData.subject_level_id) {
      alert('Wszystkie pola są wymagane')
      return
    }

    setLoading(true)

    try {
      await createAssignment({
        ...formData,
        assigned_by: adminId,
      })
      onClose()
      setFormData({
        student_id: '',
        tutor_id: '',
        subject_id: '',
        subject_level_id: '',
      })
    } catch (error) {
      console.error('Error creating assignment:', error)
      alert('Błąd podczas tworzenia przypisania')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nowe przypisanie</DialogTitle>
          <DialogDescription>
            Przypisz ucznia do tutora i wybierz przedmiot z poziomem
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="student_id">Uczeń</Label>
            <Select
              value={formData.student_id}
              onValueChange={(value) => setFormData({ ...formData, student_id: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz ucznia" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.first_name} {student.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tutor_id">Tutor</Label>
            <Select
              value={formData.tutor_id}
              onValueChange={(value) => setFormData({ ...formData, tutor_id: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz tutora" />
              </SelectTrigger>
              <SelectContent>
                {tutors.map((tutor) => (
                  <SelectItem key={tutor.id} value={tutor.id}>
                    {tutor.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject_id">Przedmiot</Label>
            <Select
              value={formData.subject_id}
              onValueChange={(value) => setFormData({ ...formData, subject_id: value, subject_level_id: '' })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz przedmiot" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject_level_id">Poziom</Label>
            <Select
              value={formData.subject_level_id}
              onValueChange={(value) => setFormData({ ...formData, subject_level_id: value })}
              disabled={loading || !formData.subject_id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz poziom" />
              </SelectTrigger>
              <SelectContent>
                {availableLevels
                  .sort((a, b) => a.level_order - b.level_order)
                  .map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.level_name} - {level.price_per_hour} zł/h
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Tworzenie...' : 'Utwórz przypisanie'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

