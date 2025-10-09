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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Student } from "@/lib/types/database.types"
import { createStudent, updateStudent } from "./actions"

interface StudentDialogProps {
  open: boolean
  onClose: () => void
  student: Student | null
}

export function StudentDialog({ open, onClose, student }: StudentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    parent_email: '',
    parent_phone: '',
    notes: '',
  })

  useEffect(() => {
    if (student) {
      setFormData({
        first_name: student.first_name,
        last_name: student.last_name,
        parent_email: student.parent_email,
        parent_phone: student.parent_phone || '',
        notes: student.notes || '',
      })
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        parent_email: '',
        parent_phone: '',
        notes: '',
      })
    }
  }, [student, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (student) {
        await updateStudent(student.id, formData)
      } else {
        await createStudent(formData)
      }
      onClose()
    } catch (error) {
      console.error('Error saving student:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {student ? 'Edytuj ucznia' : 'Dodaj nowego ucznia'}
          </DialogTitle>
          <DialogDescription>
            {student ? 'Zaktualizuj dane ucznia' : 'Wprowadź dane nowego ucznia'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Imię</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Nazwisko</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
                disabled={loading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parent_email">Email rodzica</Label>
            <Input
              id="parent_email"
              type="email"
              value={formData.parent_email}
              onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parent_phone">Telefon rodzica</Label>
            <Input
              id="parent_phone"
              type="tel"
              value={formData.parent_phone}
              onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notatki</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={loading}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Zapisywanie...' : student ? 'Zapisz zmiany' : 'Dodaj ucznia'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

