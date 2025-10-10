'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { IconPlus, IconEdit, IconTrash } from "@tabler/icons-react"
import { Subject, SubjectLevel } from "@/lib/types/database.types"
import { SubjectDialog } from "./subject-dialog"
import { SubjectLevelDialog } from "./subject-level-dialog"
import { deleteSubject, deleteSubjectLevel } from "./actions"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface SubjectWithLevels extends Subject {
  subject_levels: SubjectLevel[]
}

interface SubjectsManagementProps {
  subjects: SubjectWithLevels[]
}

export function SubjectsManagement({ subjects }: SubjectsManagementProps) {
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false)
  const [levelDialogOpen, setLevelDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<SubjectWithLevels | null>(null)
  const [editingLevel, setEditingLevel] = useState<SubjectLevel | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogContent, setConfirmDialogContent] = useState<{ title: string; description: string; onConfirm: () => void }>({ title: '', description: '', onConfirm: () => {} })

  const handleAddSubject = () => {
    setEditingSubject(null)
    setSubjectDialogOpen(true)
  }

  const handleEditSubject = (subject: SubjectWithLevels) => {
    setEditingSubject(subject)
    setSubjectDialogOpen(true)
  }

  const handleDeleteSubject = async (id: string) => {
    setConfirmDialogContent({
      title: 'Usuwanie przedmiotu',
      description: 'Czy na pewno chcesz usunąć ten przedmiot? Usunięte zostaną również wszystkie poziomy.',
      onConfirm: async () => {
        await deleteSubject(id)
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleAddLevel = (subjectId: string) => {
    setSelectedSubjectId(subjectId)
    setEditingLevel(null)
    setLevelDialogOpen(true)
  }

  const handleEditLevel = (level: SubjectLevel, subjectId: string) => {
    setSelectedSubjectId(subjectId)
    setEditingLevel(level)
    setLevelDialogOpen(true)
  }

  const handleDeleteLevel = async (id: string) => {
    setConfirmDialogContent({
      title: 'Usuwanie poziomu',
      description: 'Czy na pewno chcesz usunąć ten poziom?',
      onConfirm: async () => {
        await deleteSubjectLevel(id)
      }
    })
    setConfirmDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAddSubject}>
          <IconPlus className="mr-2 h-4 w-4" />
          Dodaj przedmiot
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {subjects.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex items-center justify-center py-10">
              <p className="text-muted-foreground">Brak przedmiotów. Dodaj pierwszy przedmiot.</p>
            </CardContent>
          </Card>
        ) : (
          subjects.map((subject) => (
            <Card key={subject.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle>{subject.name}</CardTitle>
                    {subject.description && (
                      <CardDescription>{subject.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditSubject(subject)}
                    >
                      <IconEdit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSubject(subject.id)}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Poziomy trudności:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddLevel(subject.id)}
                    >
                      <IconPlus className="mr-1 h-3 w-3" />
                      Dodaj
                    </Button>
                  </div>
                  {subject.subject_levels && subject.subject_levels.length > 0 ? (
                    <div className="space-y-2">
                      {subject.subject_levels
                        .sort((a, b) => a.level_order - b.level_order)
                        .map((level) => (
                          <div
                            key={level.id}
                            className="flex items-center justify-between rounded-lg border p-2"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{level.level_order}</Badge>
                              <span className="text-sm font-medium">{level.level_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {level.price_per_hour} zł/h
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleEditLevel(level, subject.id)}
                              >
                                <IconEdit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleDeleteLevel(level.id)}
                              >
                                <IconTrash className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Brak poziomów</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <SubjectDialog
        open={subjectDialogOpen}
        onClose={() => setSubjectDialogOpen(false)}
        subject={editingSubject}
      />

      <SubjectLevelDialog
        open={levelDialogOpen}
        onClose={() => setLevelDialogOpen(false)}
        level={editingLevel}
        subjectId={selectedSubjectId}
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

