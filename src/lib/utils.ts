import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatuje godziny, usuwając niepotrzebne zera dziesiętne
 * @param hours - Liczba godzin
 * @returns Sformatowany string (np. "21" zamiast "21.00", "21.5" zamiast "21.50")
 */
export function formatHours(hours: number): string {
  // Jeśli liczba jest całkowita, zwróć bez miejsc dziesiętnych
  if (Number.isInteger(hours)) {
    return hours.toString()
  }
  
  // W przeciwnym razie zwróć z maksymalnie 2 miejscami dziesiętnymi, ale usuń końcowe zera
  return parseFloat(hours.toFixed(2)).toString()
}

/**
 * Paleta kolorów dla przedmiotów
 */
export const SUBJECT_COLOR_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#a855f7', // violet
  '#22c55e', // emerald
  '#eab308', // yellow
  '#64748b', // slate
]

/**
 * Generuje kolor dla przedmiotu na podstawie jego nazwy
 * @param subjectName - Nazwa przedmiotu
 * @returns Kolor w formacie hex
 */
export function generateSubjectColor(subjectName: string): string {
  let hash = 0
  for (let i = 0; i < subjectName.length; i++) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % SUBJECT_COLOR_PALETTE.length
  return SUBJECT_COLOR_PALETTE[index]
}

/**
 * Zwraca kolor przedmiotu lub generuje go na podstawie nazwy
 * @param subject - Przedmiot z opcjonalnym kolorem
 * @returns Kolor w formacie hex
 */
export function getSubjectColor(subject: { name: string; color?: string | null }): string {
  return subject.color || generateSubjectColor(subject.name)
}
