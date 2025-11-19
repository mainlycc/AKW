<!-- 051e1df1-e4de-4470-a223-82b557a5ebfa adc39ad5-d0dc-47dd-b774-caaca9ae67b6 -->
# Plan: Kalendarz dostępności tutorów

## Wymagania

- Tygodniowy kalendarz z 30-minutowymi slotami
- Dni tygodnia: 8:00-21:00, Weekend: 9:00-14:00
- Domyślnie 8:00-14:00 w tygodniu niedostępne
- Szablon powtarzalny (nie kalendarz na konkretne daty)
- Admin może przeglądać historyczne zmiany
- Integracja: sugerowanie wolnych terminów przy sesji

## 1. Migracja bazy danych

**Plik:** `supabase/migrations/010_tutor_availability.sql`

### Tabela `tutor_availability_templates`

Przechowuje szablon tygodniowy tutora:

```sql
CREATE TABLE tutor_availability_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tutor_id, version)
);
```

### Tabela `tutor_availability_slots`

Przechowuje poszczególne sloty (30 min):

```sql
CREATE TABLE tutor_availability_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES tutor_availability_templates(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 1=Pn, 7=Nd
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  UNIQUE(template_id, day_of_week, start_time)
);
```

### Indeksy i RLS

- Indeksy dla szybkiego wyszukiwania
- RLS: tutorzy widzą swoje, admin widzi wszystkie
- Trigger dla updated_at

## 2. Funkcje pomocnicze (actions)

**Plik:** `src/lib/actions/availability.ts` (nowy)

### Funkcje:

- `getTutorAvailability(tutorId)` - pobiera aktywny szablon
- `getAvailabilityHistory(tutorId)` - historia wersji
- `createAvailabilityTemplate(tutorId, slots)` - nowy szablon
- `updateAvailabilityTemplate(tutorId, slots)` - aktualizacja
- `getAllTutorsAvailability()` - dla admina
- `getSuggestedTimeSlots(tutorId, studentId, duration)` - sugerowane terminy

### Struktura danych:

```typescript
type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7
type TimeSlot = {
  day: DayOfWeek
  startTime: string // "14:00"
  endTime: string // "14:30"
  isAvailable: boolean
}
```

## 3. Komponent kalendarza dla tutora

**Folder:** `src/app/(dashboard)/dashboard/kalendarz/` (nowy)

### Struktura:

```
kalendarz/
  - page.tsx (server component)
  - availability-calendar.tsx (główny komponent)
  - time-slot-grid.tsx (siatka godzin)
  - day-column.tsx (kolumna dla dnia)
  - actions.ts (server actions)
```

### Funkcjonalność:

- Wyświetlanie tygodnia (Pn-Nd)
- 30-minutowe sloty jako klikalne przyciski
- Kolory: zielony=dostępny, szary=niedostępny, niebieski=zaznaczony
- Zaznaczanie przez kliknięcie lub przeciąganie
- Przycisk "Zapisz szablon"
- Info o aktualnej wersji szablonu
- Historia zmian (rozwijane)

### UI Layout:

```
[Poniedziałek] [Wtorek] [Środa] [Czwartek] [Piątek] [Sobota] [Niedziela]
08:00  [ ]       [ ]      [ ]       [ ]       [ ]      [x]       [x]
08:30  [ ]       [ ]      [ ]       [ ]       [ ]      [x]       [x]
...
14:00  [✓]       [✓]      [✓]       [✓]       [✓]      [✓]       [✓]
14:30  [✓]       [✓]      [✓]       [✓]       [✓]      [✓]       [✓]
...
```

- [ ] = niedostępny (szary)

[✓] = dostępny (zielony)

- [x] = poza godzinami pracy

## 4. Widok admina

**Folder:** `src/app/(dashboard)/dashboard/dostepnosc-tutorow/` (nowy)

### Komponenty:

- `page.tsx` - lista tutorów
- `tutor-availability-view.tsx` - widok jednego tutora
- `availability-comparison.tsx` - porównanie tutorów

### Funkcjonalność:

- Lista wszystkich tutorów z statusem (wypełnił/nie wypełnił)
- Kliknięcie w tutora → widok jego kalendarza (read-only)
- Filtrowanie: wszyscy/aktywni/bez grafiku
- Historia wersji dla każdego tutora
- Export do CSV/PDF

## 5. Integracja z sesjami

**Plik:** `src/app/(dashboard)/dashboard/sesje/session-dialog.tsx`

### Zmiany:

- Dodać pole "Sugerowane terminy" na podstawie dostępności
- Funkcja `getSuggestedTimeSlots` sprawdza:

        1. Dostępność tutora (z szablonu)
        2. Istniejące sesje tutora (konflikty)
        3. Zwraca 5-10 najbliższych wolnych terminów

### UI:

```
Wybierz termin sesji:
○ Wpisz własny termin: [data] [godzina]
○ Wybierz z sugerowanych:
  • Poniedziałek 14:00-15:30
  • Poniedziałek 16:00-17:30
  • Wtorek 19:00-20:30
  ...
```

## 6. Domyślne sloty

**Funkcja pomocnicza:** `getDefaultAvailabilityTemplate()`

Zwraca szablon z domyślnymi wartościami:

- Pn-Pt: 14:00-21:00 dostępne, reszta niedostępne
- Sb-Nd: 9:00-14:00 dostępne, reszta niedostępne

## 7. Walidacja

- Słoty muszą być w dozwolonym zakresie godzin
- Brak nakładających się slotów
- Słoty zawsze 30-minutowe
- Minimum 1 dostępny slot w szablonie

## 8. Nawigacja

Dodać do sidebara:

- Dla tutora: "Kalendarz" (kalendarz icon)
- Dla admina: "Dostępność tutorów" (calendar-multiple icon)

## Pliki do utworzenia/zmiany

### Nowe pliki:

- `supabase/migrations/010_tutor_availability.sql`
- `src/lib/actions/availability.ts`
- `src/app/(dashboard)/dashboard/kalendarz/page.tsx`
- `src/app/(dashboard)/dashboard/kalendarz/availability-calendar.tsx`
- `src/app/(dashboard)/dashboard/kalendarz/time-slot-grid.tsx`
- `src/app/(dashboard)/dashboard/kalendarz/day-column.tsx`
- `src/app/(dashboard)/dashboard/kalendarz/actions.ts`
- `src/app/(dashboard)/dashboard/dostepnosc-tutorow/page.tsx`
- `src/app/(dashboard)/dashboard/dostepnosc-tutorow/tutor-availability-view.tsx`
- `src/lib/types/availability.types.ts`

### Pliki do modyfikacji:

- `src/components/app-sidebar.tsx` (dodać linki)
- `src/app/(dashboard)/dashboard/sesje/session-dialog.tsx` (sugerowane terminy)

## Technologie/Biblioteki

- shadcn/ui dla komponentów bazowych
- Tailwind dla stylowania
- React state dla interakcji z kalendarzem
- Server actions dla zapisywania

### To-dos

- [ ] Utworzyć migrację SQL dla tabel dostępności tutorów
- [ ] Stworzyć server actions dla zarządzania dostępnością
- [ ] Zdefiniować typy TypeScript dla dostępności
- [ ] Stworzyć interfejs kalendarza dla tutora
- [ ] Zaimplementować siatkę 30-minutowych slotów
- [ ] Dodać funkcjonalność zapisywania szablonu
- [ ] Stworzyć widok dostępności dla admina
- [ ] Dodać historię zmian szablonów
- [ ] Dodać linki do kalendarza w sidebarze
- [ ] Zintegrować z systemem sesji - sugerowane terminy