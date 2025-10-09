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
  })

  useEffect(() => {
    if (subject) {
      setFormData({
        name: subject.name,
        description: subject.description || '',
      })
    } else {
      setFormData({
        name: '',
        description: '',
      })
    }
  }, [subject, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (subject) {
        await updateSubject(subject.id, formData)
      } else {
        await createSubject(formData)
      }
      onClose()
    } catch (error) {
      console.error('Error saving subject:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
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

