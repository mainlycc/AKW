'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Trash2, Plus } from 'lucide-react'
import { saveSubjectLevels } from './actions'

interface SubjectWithLevels {
  id: string
  name: string
  subject_levels: {
    id: string
    level_name: string
    level_order: number
    price_per_hour: number
  }[]
}

interface TutorLevel {
  subject_id: string
  subject_level_id: string
}

interface SubjectSelectionProps {
  tutorId: string
  subjects: SubjectWithLevels[]
  tutorLevels: TutorLevel[]
}

interface SelectedSubjectLevel {
  id: string
  subjectId: string
  levelId: string
}

export function SubjectSelection({ tutorId, subjects, tutorLevels }: SubjectSelectionProps) {
  const [loading, setLoading] = useState(false)
  
  // Initialize with existing tutor levels
  const initialSelections = useMemo(() => {
    return tutorLevels.map((tl, index) => ({
      id: `existing-${index}`,
      subjectId: tl.subject_id,
      levelId: tl.subject_level_id,
    }))
  }, [tutorLevels])

  const [selections, setSelections] = useState<SelectedSubjectLevel[]>(initialSelections)

  const getLevelsForSubject = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId)
    if (!subject) return []
    return subject.subject_levels.sort((a, b) => a.level_order - b.level_order)
  }

  const handleSubjectChange = (selectionId: string, newSubjectId: string) => {
    setSelections(prev => prev.map(sel => {
      if (sel.id === selectionId) {
        // Reset level when subject changes
        const levels = getLevelsForSubject(newSubjectId)
        return {
          ...sel,
          subjectId: newSubjectId,
          levelId: levels.length > 0 ? levels[0].id : '',
        }
      }
      return sel
    }))
  }

  const handleLevelChange = (selectionId: string, newLevelId: string) => {
    setSelections(prev => prev.map(sel => {
      if (sel.id === selectionId) {
        return { ...sel, levelId: newLevelId }
      }
      return sel
    }))
  }

  const handleAddSubject = () => {
    const newId = `new-${Date.now()}`
    const firstSubject = subjects[0]
    const firstLevel = firstSubject?.subject_levels?.[0]
    
    setSelections(prev => [...prev, {
      id: newId,
      subjectId: firstSubject?.id || '',
      levelId: firstLevel?.id || '',
    }])
  }

  const handleRemoveSubject = (selectionId: string) => {
    setSelections(prev => prev.filter(sel => sel.id !== selectionId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Filter out incomplete selections
      const validLevelIds = selections
        .filter(sel => sel.subjectId && sel.levelId)
        .map(sel => sel.levelId)
      
      await saveSubjectLevels(tutorId, validLevelIds)
      alert('Przedmioty zostały zaktualizowane')
    } catch (error) {
      console.error('Error updating subjects:', error)
      alert('Błąd podczas aktualizacji przedmiotów')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Przedmioty i poziomy</CardTitle>
        <CardDescription>Wybierz przedmioty i poziomy, których nauczasz</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {selections.map((selection) => {
            const levels = getLevelsForSubject(selection.subjectId)
            
            return (
              <div key={selection.id} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Przedmiot</label>
                  <NativeSelect
                    value={selection.subjectId}
                    onChange={(e) => handleSubjectChange(selection.id, e.target.value)}
                    disabled={loading}
                    className="w-full"
                  >
                    <NativeSelectOption value="">Wybierz przedmiot</NativeSelectOption>
                    {subjects.map((subject) => (
                      <NativeSelectOption key={subject.id} value={subject.id}>
                        {subject.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Poziom</label>
                  <NativeSelect
                    value={selection.levelId}
                    onChange={(e) => handleLevelChange(selection.id, e.target.value)}
                    disabled={loading || !selection.subjectId}
                    className="w-full"
                  >
                    <NativeSelectOption value="">Wybierz poziom</NativeSelectOption>
                    {levels.map((level) => (
                      <NativeSelectOption key={level.id} value={level.id}>
                        {level.level_name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveSubject(selection.id)}
                  disabled={loading}
                  className="mb-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}

          {subjects.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              Brak dostępnych przedmiotów. Skontaktuj się z administratorem.
            </p>
          )}

          <div className="flex justify-between items-center pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddSubject}
              disabled={loading || subjects.length === 0}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Dodaj kolejny przedmiot
            </Button>
            
            <Button type="submit" disabled={loading || subjects.length === 0}>
              {loading ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

