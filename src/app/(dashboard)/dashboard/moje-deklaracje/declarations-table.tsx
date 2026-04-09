'use client'

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { ReusableTable } from "@/components/reusable-table"
import { deleteDeclaration, type DeclarationStatus } from "./actions"
import { formatHours } from "@/lib/utils"

interface MonthlyDeclaration {
  id: string
  month: number
  year: number
  status: DeclarationStatus
  submitted_at: string | null
  approved_at: string | null
  created_at: string
  monthly_declaration_entries?: {
    id: string
    student_id: string
    session_date: string
    start_time: string
    duration_minutes: number
    assignment_id: string
  }[]
}

interface Student {
  id: string
  first_name: string
  last_name: string
}

interface DeclarationsTableProps {
  declarations: MonthlyDeclaration[]
  tutorId: string
  students: Student[]
}

const statusLabels: Record<DeclarationStatus, string> = {
  draft: 'Roboczy',
  submitted: 'Złożony',
  approved: 'Zatwierdzony',
}

const statusVariants: Record<DeclarationStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: 'outline',
  submitted: 'secondary',
  approved: 'default',
}

const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']

export function DeclarationsTable({ declarations, tutorId, students }: DeclarationsTableProps) {
  const router = useRouter()

  // Calculate total hours for a declaration
  const calculateTotalHours = (entries: MonthlyDeclaration['monthly_declaration_entries']) => {
    if (!entries) return 0
    return entries.reduce((sum, e) => sum + (e.duration_minutes / 60), 0)
  }

  const columns = useMemo<ColumnDef<MonthlyDeclaration>[]>(() => [
    {
      accessorKey: 'period',
      header: 'Okres',
      cell: ({ row }) => {
        const declaration = row.original
        return (
          <span className="font-medium">
            {months[declaration.month - 1]} {declaration.year}
          </span>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const declaration = row.original
        return (
          <Badge variant={statusVariants[declaration.status]}>
            {statusLabels[declaration.status]}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'lessonCount',
      header: 'Liczba lekcji',
      cell: ({ row }) => {
        const declaration = row.original
        const lessonCount = declaration.monthly_declaration_entries?.length || 0
        return lessonCount
      },
      meta: {
        cellClassName: 'text-right',
        headerClassName: 'text-right',
      },
    },
    {
      accessorKey: 'totalHours',
      header: 'Suma godzin',
      cell: ({ row }) => {
        const declaration = row.original
        const totalHours = calculateTotalHours(declaration.monthly_declaration_entries)
        return `${formatHours(totalHours)} h`
      },
      meta: {
        cellClassName: 'text-right',
        headerClassName: 'text-right',
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Data utworzenia',
      cell: ({ row }) => {
        const declaration = row.original
        return new Date(declaration.created_at).toLocaleDateString('pl-PL')
      },
    },
  ], [])

  const handleAdd = () => {
    router.push('/dashboard/moje-deklaracje/nowa')
  }

  const handleDeleteSelected = async (selectedRows: MonthlyDeclaration[]) => {
    // Usuwamy tylko deklaracje w statusie draft
    const draftDeclarations = selectedRows.filter(d => d.status === 'draft')
    if (draftDeclarations.length === 0) {
      return
    }
    
    // Usuwamy pojedynczo (można by zoptymalizować do batch delete)
    for (const declaration of draftDeclarations) {
      await deleteDeclaration(declaration.id)
    }
    router.refresh()
  }

  const handleRowClick = (declaration: MonthlyDeclaration) => {
    router.push(`/dashboard/moje-deklaracje/${declaration.id}`)
  }

  return (
    <ReusableTable
      columns={columns}
      data={declarations}
      searchable={true}
      searchPlaceholder="Szukaj po okresie..."
      customGlobalFilterFn={(row, filterValue) => {
        const searchLower = filterValue.toLowerCase()
        const period = `${months[row.month - 1]} ${row.year}`.toLowerCase()
        const status = statusLabels[row.status].toLowerCase()
        return period.includes(searchLower) || status.includes(searchLower)
      }}
      onAdd={handleAdd}
      addButtonLabel="Utwórz deklarację"
      enableRowSelection={true}
      enablePagination={true}
      pageSize={10}
      emptyMessage="Brak deklaracji. Utwórz pierwszą deklarację."
      deleteButtonLabel="Usuń zaznaczone"
      enableDeleteDialog={true}
      onConfirmDelete={handleDeleteSelected}
      deleteDialogTitle="Usuń zaznaczone deklaracje?"
      deleteDialogDescription="Czy na pewno chcesz usunąć zaznaczone deklaracje? Ta operacja nie może być cofnięta. Uwaga: można usuwać tylko deklaracje w statusie 'Roboczy'."
      onRowClick={handleRowClick}
    />
  )
}
