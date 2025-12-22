'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { approveDeclaration } from "./actions"
import { toast } from "sonner"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatHours } from "@/lib/utils"

interface DeclarationEntry {
  id: string
  session_date: string
  start_time: string
  duration_minutes: number
  students: {
    first_name: string
    last_name: string
  }
}

interface MonthlyDeclaration {
  id: string
  month: number
  year: number
  status: string
  submitted_at: string | null
  approved_at: string | null
  profiles: {
    id: string
    full_name: string
  }
  monthly_declaration_entries: DeclarationEntry[]
}

interface DeclarationDetailDialogProps {
  open: boolean
  onClose: () => void
  declaration: MonthlyDeclaration | null
  adminId: string
}

const statusLabels: Record<string, string> = {
  draft: 'Roboczy',
  submitted: 'Złożony',
  approved: 'Zatwierdzony',
}

const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']

export function DeclarationDetailDialog({ 
  open, 
  onClose, 
  declaration, 
  adminId 
}: DeclarationDetailDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (!declaration) return null

  const handleApprove = async () => {
    setLoading(true)
    try {
      await approveDeclaration(declaration.id, adminId)
      toast.success('Deklaracja zatwierdzona')
      router.refresh()
      onClose()
    } catch (error) {
      console.error('Error approving declaration:', error)
      toast.error('Błąd podczas zatwierdzania deklaracji')
    } finally {
      setLoading(false)
    }
  }

  const totalHours = declaration.monthly_declaration_entries.reduce(
    (sum, e) => sum + (e.duration_minutes / 60), 
    0
  )

  // Group entries by student
  const entriesByStudent = declaration.monthly_declaration_entries.reduce((acc, entry) => {
    const studentName = `${entry.students.first_name} ${entry.students.last_name}`
    if (!acc[studentName]) {
      acc[studentName] = []
    }
    acc[studentName].push(entry)
    return acc
  }, {} as Record<string, DeclarationEntry[]>)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Szczegóły deklaracji</DialogTitle>
          <DialogDescription>
            {declaration.profiles.full_name} - {months[declaration.month - 1]} {declaration.year}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge>{statusLabels[declaration.status]}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Liczba lekcji</p>
              <p className="text-lg font-semibold">{declaration.monthly_declaration_entries.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Suma godzin</p>
              <p className="text-lg font-semibold">{formatHours(totalHours)} h</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Data złożenia</p>
              <p className="text-lg font-semibold">
                {declaration.submitted_at 
                  ? new Date(declaration.submitted_at).toLocaleDateString('pl-PL')
                  : '-'}
              </p>
            </div>
          </div>

          {/* Entries grouped by student */}
          <div className="space-y-4">
            <h3 className="font-semibold">Zaplanowane lekcje</h3>
            {Object.entries(entriesByStudent).map(([studentName, entries]) => {
              const studentHours = entries.reduce((sum, e) => sum + (e.duration_minutes / 60), 0)
              
              return (
                <div key={studentName} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">{studentName}</h4>
                    <Badge variant="outline">{formatHours(studentHours)} h</Badge>
                  </div>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Godzina</TableHead>
                          <TableHead className="text-right">Czas trwania</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              {new Date(entry.session_date).toLocaleDateString('pl-PL')}
                            </TableCell>
                            <TableCell>{entry.start_time.slice(0, 5)}</TableCell>
                            <TableCell className="text-right">
                              {entry.duration_minutes} min
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Approve button */}
          {declaration.status === 'submitted' && (
            <div className="flex justify-end">
              <Button onClick={handleApprove} disabled={loading}>
                {loading ? 'Zatwierdzanie...' : 'Zatwierdź deklarację'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

