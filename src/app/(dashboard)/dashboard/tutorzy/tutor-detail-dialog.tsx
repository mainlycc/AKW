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
import { updateTutorDetails } from "./actions"
import { Badge } from "@/components/ui/badge"
import { formatHours } from "@/lib/utils"
import { SubjectBadge } from "@/components/subject-badge"

interface TutorWithStats {
  id: string
  full_name: string
  email: string
  phone: string | null
  bio: string | null
  hourly_rate: number | null
  activeAssignments?: number
  totalHours?: number
  totalSessions?: number
}

interface TutorSubjectLevel {
  id: string
  subject_id: string
  subject_level_id: string
  subjects: { id: string; name: string; color?: string | null } | null
  subject_levels: { id: string; level_name: string; price_per_hour: number } | null
}

interface TutorDetailDialogProps {
  open: boolean
  onClose: () => void
  tutor: TutorWithStats | null
  tutorSubjects: TutorSubjectLevel[]
}

export function TutorDetailDialog({ open, onClose, tutor, tutorSubjects }: TutorDetailDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    bio: '',
    hourly_rate: '',
  })

  useEffect(() => {
    if (tutor) {
      setFormData({
        full_name: tutor.full_name,
        phone: tutor.phone || '',
        bio: tutor.bio || '',
        hourly_rate: tutor.hourly_rate?.toString() || '',
      })
    }
  }, [tutor, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tutor) return
    
    setLoading(true)

    try {
      await updateTutorDetails(tutor.id, {
        full_name: formData.full_name,
        phone: formData.phone,
        bio: formData.bio,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
      })
      onClose()
    } catch (error) {
      console.error('Error updating tutor:', error)
      alert('Błąd podczas aktualizacji danych tutora')
    } finally {
      setLoading(false)
    }
  }

  if (!tutor) return null

  const stats = {
    activeAssignments: tutor.activeAssignments ?? 0,
    totalHours: tutor.totalHours ?? 0,
    totalSessions: tutor.totalSessions ?? 0,
  }

  // Group subjects by subject name
  const subjectGroups = tutorSubjects.reduce((acc, ts) => {
    const subjectName = ts.subjects?.name || 'Nieznany'
    if (!acc[subjectName]) {
      acc[subjectName] = []
    }
    if (ts.subject_levels) {
      acc[subjectName].push(ts.subject_levels.level_name)
    }
    return acc
  }, {} as Record<string, string[]>)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Szczegóły tutora</DialogTitle>
          <DialogDescription>
            Zarządzaj danymi tutora i stawką godzinową
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Statystyki */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Aktywne przypisania</p>
              <p className="text-2xl font-bold">{stats.activeAssignments}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Liczba sesji</p>
              <p className="text-2xl font-bold">{stats.totalSessions}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Suma godzin</p>
              <p className="text-2xl font-bold">{formatHours(stats.totalHours)}h</p>
            </div>
          </div>

          {/* Przedmioty i poziomy */}
          <div className="space-y-2">
            <Label>Przedmioty</Label>
            {Object.keys(subjectGroups).length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak wybranych przedmiotów</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(subjectGroups).map(([subjectName, levels]) => {
                  const subjectData = tutorSubjects.find(ts => ts.subjects?.name === subjectName)?.subjects
                  return (
                    <div key={subjectName} className="flex flex-wrap items-center gap-2">
                      {subjectData ? (
                        <SubjectBadge subject={subjectData} className="text-xs" />
                      ) : (
                        <span className="text-sm font-medium">{subjectName}:</span>
                      )}
                      {levels.map((level, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">{level}</Badge>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Formularz edycji */}
          <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Imię i nazwisko</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={tutor.email}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={loading}
                placeholder="+48 123 456 789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Stawka godzinowa (zł)</Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                disabled={loading}
                placeholder="np. 50.00"
              />
              <p className="text-xs text-muted-foreground">Używane do kalkulacji wypłat w raportach miesięcznych</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                disabled={loading}
                rows={4}
                placeholder="Informacje o tutorze..."
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

