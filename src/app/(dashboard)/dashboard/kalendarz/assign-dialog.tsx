'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createBookedSlotAction } from './actions'
import type { DayOfWeek } from '@/lib/types/availability.types'

interface AssignmentOption {
  id: string
  students: { id: string; first_name: string; last_name: string }
  subjects: { id: string; name: string }
  subject_levels: { id: string; level_name: string }
}

interface AssignDialogProps {
  open: boolean
  onClose: () => void
  tutorId: string
  createdBy: string
  weekday: DayOfWeek
  startTime: string
  endTime: string
  assignments: AssignmentOption[]
  onAssigned?: () => void
}

export function AssignDialog({ open, onClose, tutorId, createdBy, weekday, startTime, endTime, assignments, onAssigned }: AssignDialogProps) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  const handleConfirm = () => {
    if (!selectedAssignmentId) return
    startTransition(async () => {
      try {
        await createBookedSlotAction(createdBy, {
          student_assignment_id: selectedAssignmentId,
          weekday: weekday as 1|2|3|4|5|6|7,
          start_time: startTime,
          end_time: endTime,
        })
        onAssigned && onAssigned()
        onClose()
      } catch (e) {
        console.error(e)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Przypisz ucznia do slotu</DialogTitle>
          <DialogDescription>
            {`Dzień: ${weekday}, ${startTime}–${endTime}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Uczeń · Przedmiot · Poziom</Label>
          <Select value={selectedAssignmentId} onValueChange={setSelectedAssignmentId}>
            <SelectTrigger>
              <SelectValue placeholder="Wybierz przypisanie" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {assignments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {`${a.students.first_name} ${a.students.last_name} · ${a.subjects.name} · ${a.subject_levels.level_name}`}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Anuluj</Button>
          <Button onClick={handleConfirm} disabled={!selectedAssignmentId || isPending}>
            {isPending ? 'Zapisywanie...' : 'Przypisz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


