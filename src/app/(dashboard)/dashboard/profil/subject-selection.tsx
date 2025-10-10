'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

interface SubjectSelectionProps {
  tutorId: string
  subjects: SubjectWithLevels[]
  selectedLevelIds: string[]
}

export function SubjectSelection({ tutorId, subjects, selectedLevelIds }: SubjectSelectionProps) {
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedLevelIds))

  const toggleLevel = (levelId: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(levelId)) {
      newSelected.delete(levelId)
    } else {
      newSelected.add(levelId)
    }
    setSelected(newSelected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await saveSubjectLevels(tutorId, Array.from(selected))
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {subjects.map((subject) => (
            <div key={subject.id} className="space-y-3">
              <h3 className="font-semibold text-lg">{subject.name}</h3>
              <div className="grid gap-3 pl-4">
                {subject.subject_levels
                  .sort((a, b) => a.level_order - b.level_order)
                  .map((level) => (
                    <div key={level.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={level.id}
                        checked={selected.has(level.id)}
                        onCheckedChange={() => toggleLevel(level.id)}
                        disabled={loading}
                      />
                      <label
                        htmlFor={level.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {level.level_name}
                      </label>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {subjects.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              Brak dostępnych przedmiotów. Skontaktuj się z administratorem.
            </p>
          )}

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={loading || subjects.length === 0}>
              {loading ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

