'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { getTutorAvailability, getAvailabilityHistory } from '@/lib/actions/availability'
import { TimeSlotGrid } from '../kalendarz/time-slot-grid'
import type { TutorAvailabilityData, AvailabilityTemplate } from '@/lib/types/availability.types'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface TutorAvailabilityDialogProps {
  open: boolean
  onClose: () => void
  tutorId: string
}

export function TutorAvailabilityDialog({
  open,
  onClose,
  tutorId,
}: TutorAvailabilityDialogProps) {
  const [loading, setLoading] = useState(true)
  const [availability, setAvailability] = useState<TutorAvailabilityData | null>(null)
  const [history, setHistory] = useState<AvailabilityTemplate[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [availabilityData, historyData] = await Promise.all([
        getTutorAvailability(tutorId),
        getAvailabilityHistory(tutorId),
      ])
      setAvailability(availabilityData)
      setHistory(historyData)
      if (availabilityData) {
        setSelectedVersion(availabilityData.template.version)
      }
    } catch (error) {
      console.error('Error loading availability:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && tutorId) {
      loadData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tutorId])

  const handleVersionChange = async (version: string) => {
    const versionNum = parseInt(version)
    setSelectedVersion(versionNum)
    
    // W przyszłości można załadować konkretną wersję
    // Na razie pokazujemy tylko aktywną
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Podgląd dostępności tutora</DialogTitle>
          <DialogDescription>
            Kalendarz dostępności w trybie tylko do odczytu
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : availability ? (
          <div className="space-y-4 py-4">
            {/* Info */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    Wersja {availability.template.version}
                  </Badge>
                  <Badge variant="outline">
                    Aktywna
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Ostatnia aktualizacja: {formatDate(availability.template.updated_at)}
                </p>
              </div>

              {history.length > 1 && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="version-select" className="text-sm">
                    Historia:
                  </Label>
                  <Select
                    value={selectedVersion?.toString()}
                    onValueChange={handleVersionChange}
                  >
                    <SelectTrigger id="version-select" className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {history.map((template) => (
                        <SelectItem key={template.id} value={template.version.toString()}>
                          Wersja {template.version}
                          {template.is_active && ' (aktywna)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Statystyki */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                Dostępne sloty:{' '}
                <strong className="text-foreground">
                  {availability.slots.filter((s) => s.is_available).length}
                </strong>
              </span>
              <span>•</span>
              <span>
                Godziny tygodniowo:{' '}
                <strong className="text-foreground">
                  {(availability.slots.filter((s) => s.is_available).length * 0.5).toFixed(1)}h
                </strong>
              </span>
            </div>

            {/* Kalendarz (read-only) */}
            <TimeSlotGrid
              slots={availability.slots.map((slot) => ({
                day: slot.day_of_week,
                startTime: slot.start_time,
                endTime: slot.end_time,
                isAvailable: slot.is_available,
              }))}
              onSlotToggle={() => {}} // Read-only
            />
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Brak danych o dostępności dla tego tutora
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

