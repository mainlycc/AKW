'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IconCurrency, IconInfoCircle, IconCheck } from '@tabler/icons-react'
import { Checkbox } from '@/components/ui/checkbox'
import { getDefaultRates, updateDefaultRates, type DefaultRates } from './actions'
import { toast } from 'sonner'

export function RatesManagement() {
  const [loading, setLoading] = useState(false)
  const [initialRates, setInitialRates] = useState<DefaultRates | null>(null)
  const [rates, setRates] = useState<DefaultRates>({
    default_student_rate: 50.00,
    default_tutor_rate: null,
  })
  const [hasChanges, setHasChanges] = useState(false)
  const [updateAllStudents, setUpdateAllStudents] = useState(false)

  useEffect(() => {
    async function loadRates() {
      try {
        const defaultRates = await getDefaultRates()
        setInitialRates(defaultRates)
        setRates(defaultRates)
      } catch (error) {
        console.error('Error loading rates:', error)
        toast.error('Nie udało się załadować stawek')
      }
    }
    loadRates()
  }, [])

  useEffect(() => {
    if (initialRates) {
      const changed =
        rates.default_student_rate !== initialRates.default_student_rate ||
        rates.default_tutor_rate !== initialRates.default_tutor_rate
      setHasChanges(changed)
    }
  }, [rates, initialRates])

  const handleStudentRateChange = (value: string) => {
    const numValue = value === '' ? null : parseFloat(value)
    if (value === '' || (!isNaN(numValue!) && numValue! >= 0)) {
      setRates({
        ...rates,
        default_student_rate: numValue,
      })
    }
  }

  const handleTutorRateChange = (value: string) => {
    const numValue = value === '' ? null : parseFloat(value)
    if (value === '' || (!isNaN(numValue!) && numValue! >= 0)) {
      setRates({
        ...rates,
        default_tutor_rate: numValue,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasChanges) return

    setLoading(true)

    try {
      const result = await updateDefaultRates(
        rates.default_student_rate,
        rates.default_tutor_rate,
        updateAllStudents
      )

      if (result.success) {
        setInitialRates(rates)
        setHasChanges(false)
        setUpdateAllStudents(false)
        toast.success(
          `Stawki zostały zaktualizowane.${
            result.updatedCount && result.updatedCount > 0
              ? ` Zaktualizowano ${result.updatedCount} użytkowników.`
              : ''
          }`
        )
        // Odśwież stronę po krótkim opóźnieniu, aby pokazać zaktualizowane dane
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        toast.error(result.error || 'Nie udało się zaktualizować stawek')
      }
    } catch (error) {
      console.error('Error updating rates:', error)
      toast.error('Nieoczekiwany błąd podczas aktualizacji stawek')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
        <IconInfoCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-900 dark:text-blue-100">
          Domyślne stawki są używane przy tworzeniu nowych studentów i tutorów.
          Zmiana domyślnej stawki automatycznie zaktualizuje istniejących
          użytkowników, którzy nie mają ustawionej indywidualnej stawki.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {hasChanges && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950 mb-4">
            <IconInfoCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">
                Opcje aktualizacji istniejących użytkowników
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={updateAllStudents}
                  onCheckedChange={(checked) => setUpdateAllStudents(checked === true)}
                />
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  Zaktualizuj wszystkich studentów do nowej domyślnej stawki (włącznie z tymi, którzy już mają ustawioną stawkę)
                </span>
              </label>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {updateAllStudents
                  ? 'Uwaga: Wszyscy studenci otrzymają nową domyślną stawkę, nawet jeśli mają już ustawioną indywidualną stawkę.'
                  : 'Domyślnie aktualizowani są tylko studenci bez ustawionej stawki (NULL).'}
              </p>
            </div>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Stawka dla studentów */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconCurrency className="h-5 w-5 text-primary" />
                <CardTitle>Domyślna stawka dla studentów</CardTitle>
              </div>
              <CardDescription>
                Stawka godzinowa używana przy tworzeniu nowych studentów
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student_rate">Stawka (PLN/h)</Label>
                <Input
                  id="student_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={rates.default_student_rate ?? ''}
                  onChange={(e) => handleStudentRateChange(e.target.value)}
                  placeholder="50.00"
                  disabled={loading}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Aktualna wartość:{' '}
                  <span className="font-medium">
                    {rates.default_student_rate ? `${rates.default_student_rate.toFixed(0)}` : 'Nie ustawiono'} PLN
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stawka dla tutorów */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconCurrency className="h-5 w-5 text-primary" />
                <CardTitle>Domyślna stawka dla tutorów</CardTitle>
              </div>
              <CardDescription>
                Stawka godzinowa używana przy tworzeniu nowych tutorów (opcjonalnie)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tutor_rate">Stawka (PLN/h)</Label>
                <Input
                  id="tutor_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={rates.default_tutor_rate ?? ''}
                  onChange={(e) => handleTutorRateChange(e.target.value)}
                  placeholder="Nie ustawiono"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Aktualna wartość:{' '}
                  <span className="font-medium">
                    {rates.default_tutor_rate
                      ? `${rates.default_tutor_rate.toFixed(0)} PLN`
                      : 'Nie ustawiono'}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            type="submit"
            disabled={loading || !hasChanges}
            className="min-w-[120px]"
          >
            {loading ? (
              'Zapisywanie...'
            ) : (
              <>
                <IconCheck className="mr-2 h-4 w-4" />
                Zapisz zmiany
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
