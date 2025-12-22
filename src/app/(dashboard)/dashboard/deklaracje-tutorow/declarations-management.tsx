'use client'

import { useState, useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DeclarationDetailDialog } from "./declaration-detail-dialog"
import { IconSearch } from "@tabler/icons-react"
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
  created_at: string
  profiles: {
    id: string
    full_name: string
  }
  monthly_declaration_entries: DeclarationEntry[]
}

interface DeclarationsManagementProps {
  declarations: MonthlyDeclaration[]
  tutors?: { id: string; full_name: string }[]
  adminId: string
}

const statusLabels: Record<string, string> = {
  draft: 'Roboczy',
  submitted: 'Złożony',
  approved: 'Zatwierdzony',
}

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: 'outline',
  submitted: 'secondary',
  approved: 'default',
}

const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']

export function DeclarationsManagement({ declarations, adminId }: DeclarationsManagementProps) {
  const [search, setSearch] = useState('')
  const [selectedDeclaration, setSelectedDeclaration] = useState<MonthlyDeclaration | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const filteredDeclarations = useMemo(() => {
    if (!search.trim()) return declarations
    
    const searchLower = search.toLowerCase().trim()
    return declarations.filter(declaration => {
      const fullNameLower = declaration.profiles.full_name.toLowerCase()
      
      if (fullNameLower.includes(searchLower)) {
        return true
      }
      
      const nameWords = fullNameLower.split(/\s+/)
      const searchWords = searchLower.split(/\s+/)
      
      return searchWords.every(word => 
        nameWords.some(nameWord => nameWord.includes(word))
      )
    })
  }, [declarations, search])

  const handleRowClick = (declaration: MonthlyDeclaration) => {
    setSelectedDeclaration(declaration)
    setDialogOpen(true)
  }

  const calculateTotalHours = (entries: DeclarationEntry[]) => {
    return entries.reduce((sum, e) => sum + (e.duration_minutes / 60), 0)
  }

  const totalStats = useMemo(() => {
    return {
      totalHours: filteredDeclarations.reduce((sum, d) => sum + calculateTotalHours(d.monthly_declaration_entries), 0),
      totalLessons: filteredDeclarations.reduce((sum, d) => sum + d.monthly_declaration_entries.length, 0),
      submittedCount: filteredDeclarations.filter(d => d.status === 'submitted').length,
    }
  }, [filteredDeclarations])

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Oczekujące</p>
          <p className="text-2xl font-bold">{totalStats.submittedCount}</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Suma godzin</p>
          <p className="text-2xl font-bold">{formatHours(totalStats.totalHours)} h</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Liczba lekcji</p>
          <p className="text-2xl font-bold">{totalStats.totalLessons}</p>
        </div>
      </div>

      {/* Wyszukiwarka */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwisku tutora..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tutor</TableHead>
              <TableHead>Okres</TableHead>
              <TableHead className="text-right">Liczba lekcji</TableHead>
              <TableHead className="text-right">Suma godzin</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDeclarations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Brak deklaracji do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              filteredDeclarations.map((declaration) => {
                const totalHours = calculateTotalHours(declaration.monthly_declaration_entries)
                const lessonCount = declaration.monthly_declaration_entries.length
                
                return (
                  <TableRow 
                    key={declaration.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(declaration)}
                  >
                    <TableCell className="font-medium">{declaration.profiles.full_name}</TableCell>
                    <TableCell>{months[declaration.month - 1]} {declaration.year}</TableCell>
                    <TableCell className="text-right">{lessonCount}</TableCell>
                    <TableCell className="text-right">{formatHours(totalHours)} h</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[declaration.status]}>
                        {statusLabels[declaration.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <DeclarationDetailDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        declaration={selectedDeclaration}
        adminId={adminId}
      />
    </div>
  )
}

