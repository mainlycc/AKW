'use client'

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ParentDialog } from "./parent-dialog"
import { deleteParentAction } from "./actions"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import type { ParentType } from "@/lib/actions/parents"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface Parent {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  parent_type: ParentType
  student_parents: { student_id: string }[]
}

interface ParentsTableProps {
  parents: Parent[]
}

const parentTypeLabels: Record<ParentType, string> = {
  mother: 'Mama',
  father: 'Tata',
  legal_guardian: 'Opiekun prawny',
  other: 'Inny',
}

export function ParentsTable({ parents }: ParentsTableProps) {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingParent, setEditingParent] = useState<Parent | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogContent, setConfirmDialogContent] = useState<{ title: string; description: string; onConfirm: () => void }>({ title: '', description: '', onConfirm: () => {} })

  const filteredParents = parents.filter(
    (parent) =>
      parent.first_name.toLowerCase().includes(search.toLowerCase()) ||
      parent.last_name.toLowerCase().includes(search.toLowerCase()) ||
      parent.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleRowClick = (parent: Parent) => {
    setEditingParent(parent)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingParent(null)
    setDialogOpen(true)
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    
    const count = selectedIds.size
    setConfirmDialogContent({
      title: 'Usuwanie rodziców',
      description: `Czy na pewno chcesz usunąć ${count} ${count === 1 ? 'rodzica' : 'rodziców'}?`,
      onConfirm: async () => {
        for (const id of selectedIds) {
          await deleteParentAction(id)
        }
        setSelectedIds(new Set())
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingParent(null)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredParents.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredParents.map(p => p.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Szukaj rodzica..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {selectedIds.size > 0 && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleDeleteSelected}
            >
              <IconTrash className="mr-2 h-4 w-4" />
              Usuń zaznaczone ({selectedIds.size})
            </Button>
          )}
        </div>
        <Button onClick={handleAdd}>
          <IconPlus className="mr-2 h-4 w-4" />
          Dodaj rodzica
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === filteredParents.length && filteredParents.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Imię</TableHead>
              <TableHead>Nazwisko</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead className="text-right">Liczba dzieci</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredParents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Brak rodziców do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              filteredParents.map((parent) => (
                <TableRow 
                  key={parent.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(parent)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(parent.id)}
                      onCheckedChange={() => toggleSelectOne(parent.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{parent.first_name}</TableCell>
                  <TableCell>{parent.last_name}</TableCell>
                  <TableCell>{parentTypeLabels[parent.parent_type]}</TableCell>
                  <TableCell>{parent.email}</TableCell>
                  <TableCell>{parent.phone || '-'}</TableCell>
                  <TableCell className="text-right">{parent.student_parents.length}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ParentDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        parent={editingParent}
      />

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title={confirmDialogContent.title}
        description={confirmDialogContent.description}
        onConfirm={confirmDialogContent.onConfirm}
        confirmText="Usuń"
        cancelText="Anuluj"
      />
    </div>
  )
}

