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
  })

  useEffect(() => {
    if (level) {
      setFormData({
        level_name: level.level_name,
        level_order: level.level_order,
      })
    } else {
      setFormData({
        level_name: '',
        level_order: 1,
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
        await updateSubjectLevel(level.id, { ...formData, price_per_hour: 0 })
      } else {
        await createSubjectLevel(subjectId, { ...formData, price_per_hour: 0 })
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
          <DialogTitle>Edytuj nazwę poziomu</DialogTitle>
          <DialogDescription>
            Zmień nazwę poziomu. Kolejność poziomów jest ustalona i nie można jej zmieniać.
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
            <Label htmlFor="level_order">Kolejność (nie można zmieniać)</Label>
            <Input
              id="level_order"
              type="number"
              value={formData.level_order}
              disabled
              className="bg-muted cursor-not-allowed"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

