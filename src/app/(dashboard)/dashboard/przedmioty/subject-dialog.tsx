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
import { Subject } from "@/lib/types/database.types"
import { createSubject, updateSubject } from "./actions"
import { SUBJECT_COLOR_PALETTE, generateSubjectColor } from "@/lib/utils"

interface SubjectDialogProps {
  open: boolean
  onClose: () => void
  subject: Subject | null
}

export function SubjectDialog({ open, onClose, subject }: SubjectDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '',
  })

  useEffect(() => {
    if (subject) {
      setFormData({
        name: subject.name,
        description: subject.description || '',
        color: subject.color || generateSubjectColor(subject.name),
      })
    } else {
      setFormData({
        name: '',
        description: '',
        color: '',
      })
    }
  }, [subject, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const colorToSave = formData.color || generateSubjectColor(formData.name)
      if (subject) {
        await updateSubject(subject.id, {
          name: formData.name,
          description: formData.description,
          color: colorToSave,
        })
      } else {
        await createSubject({
          name: formData.name,
          description: formData.description,
          color: colorToSave,
        })
      }
      onClose()
    } catch (error) {
      console.error('Error saving subject:', error)
    } finally {
      setLoading(false)
    }
  }

  // Aktualizuj kolor automatycznie gdy zmienia się nazwa (tylko dla nowych przedmiotów)
  useEffect(() => {
    if (!subject && formData.name && !formData.color) {
      setFormData(prev => ({
        ...prev,
        color: generateSubjectColor(formData.name),
      }))
    }
  }, [formData.name, subject])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {subject ? 'Edytuj przedmiot' : 'Dodaj nowy przedmiot'}
          </DialogTitle>
          <DialogDescription>
            {subject ? 'Zaktualizuj dane przedmiotu' : 'Wprowadź dane nowego przedmiotu'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa przedmiotu</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="np. Matematyka"
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Opis (opcjonalnie)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Krótki opis przedmiotu"
              disabled={loading}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Kolor przedmiotu</Label>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-10 h-10 rounded-md border-2 transition-all ${
                    formData.color === color
                      ? 'border-foreground scale-110 ring-2 ring-ring'
                      : 'border-border hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  disabled={loading}
                  aria-label={`Wybierz kolor ${color}`}
                />
              ))}
            </div>
            {formData.name && (
              <p className="text-xs text-muted-foreground">
                Kolor zostanie automatycznie przypisany na podstawie nazwy, jeśli nie wybierzesz innego.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Zapisywanie...' : subject ? 'Zapisz zmiany' : 'Dodaj przedmiot'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

