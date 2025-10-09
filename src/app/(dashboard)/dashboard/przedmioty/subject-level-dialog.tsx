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
import { SubjectLevel } from "@/lib/types/database.types"
import { createSubjectLevel, updateSubjectLevel } from "./actions"

interface SubjectLevelDialogProps {
  open: boolean
  onClose: () => void
  level: SubjectLevel | null
  subjectId: string | null
}

export function SubjectLevelDialog({ open, onClose, level, subjectId }: SubjectLevelDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    level_name: '',
    level_order: 1,
    price_per_hour: 0,
  })

  useEffect(() => {
    if (level) {
      setFormData({
        level_name: level.level_name,
        level_order: level.level_order,
        price_per_hour: level.price_per_hour,
      })
    } else {
      setFormData({
        level_name: '',
        level_order: 1,
        price_per_hour: 0,
      })
    }
  }, [level, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!subjectId) {
      console.error('Subject ID is required')
      return
    }

    setLoading(true)

    try {
      if (level) {
        await updateSubjectLevel(level.id, formData)
      } else {
        await createSubjectLevel(subjectId, formData)
      }
      onClose()
    } catch (error) {
      console.error('Error saving subject level:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {level ? 'Edytuj poziom trudności' : 'Dodaj poziom trudności'}
          </DialogTitle>
          <DialogDescription>
            {level ? 'Zaktualizuj dane poziomu' : 'Wprowadź dane nowego poziomu'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="level_name">Nazwa poziomu</Label>
            <Input
              id="level_name"
              value={formData.level_name}
              onChange={(e) => setFormData({ ...formData, level_name: e.target.value })}
              placeholder="np. Podstawowy, Rozszerzony, Maturalny"
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="level_order">Kolejność</Label>
            <Input
              id="level_order"
              type="number"
              min="1"
              value={formData.level_order}
              onChange={(e) => setFormData({ ...formData, level_order: parseInt(e.target.value) })}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price_per_hour">Cena za godzinę (zł)</Label>
            <Input
              id="price_per_hour"
              type="number"
              min="0"
              step="0.01"
              value={formData.price_per_hour}
              onChange={(e) => setFormData({ ...formData, price_per_hour: parseFloat(e.target.value) })}
              required
              disabled={loading}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Zapisywanie...' : level ? 'Zapisz zmiany' : 'Dodaj poziom'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

