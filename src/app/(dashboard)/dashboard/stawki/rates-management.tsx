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
    default_student_rate_level_1: 50.0,
    default_student_rate_level_2: 50.0,
    default_student_rate_level_3: 50.0,
    default_tutor_rate: null,
  })
  const [hasChanges, setHasChanges] = useState(false)
  const [updateAllStudents, setUpdateAllStudents] = useState(false)
  const [updateAllTutors, setUpdateAllTutors] = useState(false)

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
        rates.default_student_rate_level_1 !== initialRates.default_student_rate_level_1 ||
        rates.default_student_rate_level_2 !== initialRates.default_student_rate_level_2 ||
        rates.default_student_rate_level_3 !== initialRates.default_student_rate_level_3 ||
        rates.default_tutor_rate !== initialRates.default_tutor_rate
      setHasChanges(changed)
    }
  }, [rates, initialRates])

  const handleStudentRateLevelChange = (
    level: 1 | 2 | 3,
    value: string
  ) => {
    const numValue = value === '' ? null : parseFloat(value)
    if (value === '' || (!isNaN(numValue!) && numValue! >= 0)) {
      if (level === 1) {
        setRates({
          ...rates,
          default_student_rate_level_1: numValue,
        })
      } else if (level === 2) {
        setRates({
          ...rates,
          default_student_rate_level_2: numValue,
        })
      } else {
        setRates({
          ...rates,
          default_student_rate_level_3: numValue,
        })
      }
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
        rates.default_student_rate_level_1,
        rates.default_student_rate_level_2,
        rates.default_student_rate_level_3,
        rates.default_tutor_rate,
        updateAllStudents,
        updateAllTutors
      )

      if (result.success) {
        setInitialRates(rates)
        setHasChanges(false)
        setUpdateAllStudents(false)
        setUpdateAllTutors(false)
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
                  Nadpisz także indywidualne stawki uczniów (zresetuj override i ustaw stawkę wg poziomu)
                </span>
              </label>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {updateAllStudents
                  ? 'Uwaga: Wszyscy uczniowie otrzymają nowe stawki wg poziomu, nawet jeśli mieli ustawioną indywidualną stawkę. Indywidualne nadpisania zostaną wyłączone.'
                  : 'Domyślnie aktualizowani są tylko uczniowie bez indywidualnej stawki (override wyłączony).'}
              </p>
              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <Checkbox
                  checked={updateAllTutors}
                  onCheckedChange={(checked) => setUpdateAllTutors(checked === true)}
                />
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  Nadpisz stawki wszystkich tutorów (ustaw każdemu tę samą stawkę)
                </span>
              </label>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {updateAllTutors
                  ? 'Uwaga: Wszyscy tutorzy dostaną nową stawkę, także ci z ustawioną wcześniej indywidualną stawką.'
                  : 'Domyślnie aktualizowani są tylko tutorzy, którzy mieli pustą stawkę (NULL).'}
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
                <CardTitle>Domyślne stawki dla uczniów (wg poziomu)</CardTitle>
              </div>
              <CardDescription>
                Stawki godzinowe używane przy tworzeniu nowych uczniów
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student_rate_level_1">Poziom 1 – Szkoła podstawowa (PLN/h)</Label>
                <Input
                  id="student_rate_level_1"
                  type="number"
                  step="0.01"
                  min="0"
                  value={rates.default_student_rate_level_1 ?? ''}
                  onChange={(e) => handleStudentRateLevelChange(1, e.target.value)}
                  placeholder="50.00"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="student_rate_level_2">Poziom 2 – Szkoła średnia podstawa (PLN/h)</Label>
                <Input
                  id="student_rate_level_2"
                  type="number"
                  step="0.01"
                  min="0"
                  value={rates.default_student_rate_level_2 ?? ''}
                  onChange={(e) => handleStudentRateLevelChange(2, e.target.value)}
                  placeholder="50.00"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="student_rate_level_3">Poziom 3 – Szkoła średnia rozszerzenie (PLN/h)</Label>
                <Input
                  id="student_rate_level_3"
                  type="number"
                  step="0.01"
                  min="0"
                  value={rates.default_student_rate_level_3 ?? ''}
                  onChange={(e) => handleStudentRateLevelChange(3, e.target.value)}
                  placeholder="50.00"
                  disabled={loading}
                  required
                />
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
