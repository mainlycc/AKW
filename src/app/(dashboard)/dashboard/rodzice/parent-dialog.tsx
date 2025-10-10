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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createParentAction, updateParentAction, deleteParentAction } from "./actions"
import type { ParentType } from "@/lib/actions/parents"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface Parent {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  parent_type: ParentType
}

interface ParentDialogProps {
  open: boolean
  onClose: () => void
  parent: Parent | null
}

const parentTypeLabels: Record<ParentType, string> = {
  mother: 'Mama',
  father: 'Tata',
  legal_guardian: 'Opiekun prawny',
  other: 'Inny',
}

export function ParentDialog({ open, onClose, parent }: ParentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    parent_type: 'mother' as ParentType,
  })
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  useEffect(() => {
    if (parent) {
      setFormData({
        first_name: parent.first_name,
        last_name: parent.last_name,
        email: parent.email,
        phone: parent.phone || '',
        parent_type: parent.parent_type,
      })
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        parent_type: 'mother',
      })
    }
  }, [parent, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (parent) {
        await updateParentAction(parent.id, formData)
      } else {
        await createParentAction(formData)
      }
      onClose()
    } catch (error) {
      console.error('Error saving parent:', error)
      alert('Błąd podczas zapisywania rodzica')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!parent) return
    setConfirmDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!parent) return
    setDeleting(true)
    try {
      await deleteParentAction(parent.id)
      onClose()
    } catch (error) {
      console.error('Error deleting parent:', error)
      alert('Błąd podczas usuwania rodzica')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {parent ? 'Edytuj rodzica' : 'Dodaj nowego rodzica'}
          </DialogTitle>
          <DialogDescription>
            {parent ? 'Zaktualizuj dane rodzica' : 'Wprowadź dane nowego rodzica'}
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
                disabled={loading || deleting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Nazwisko</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
                disabled={loading || deleting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent_type">Typ rodzica</Label>
            <Select
              value={formData.parent_type}
              onValueChange={(value) => setFormData({ ...formData, parent_type: value as ParentType })}
              disabled={loading || deleting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(parentTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={loading || deleting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={loading || deleting}
              placeholder="+48 123 456 789"
            />
          </div>

          <div className="flex justify-between gap-2">
            {parent && (
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleDelete} 
                disabled={loading || deleting}
              >
                {deleting ? 'Usuwanie...' : 'Usuń'}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading || deleting}>
                Anuluj
              </Button>
              <Button type="submit" disabled={loading || deleting}>
                {loading ? 'Zapisywanie...' : parent ? 'Zapisz zmiany' : 'Dodaj rodzica'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title="Usuwanie rodzica"
        description={`Czy na pewno chcesz usunąć ${formData.first_name} ${formData.last_name}?`}
        onConfirm={confirmDelete}
        confirmText="Usuń"
        cancelText="Anuluj"
      />
    </Dialog>
  )
}

