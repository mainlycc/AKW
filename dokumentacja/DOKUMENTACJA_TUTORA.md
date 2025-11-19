# Dokumentacja Panelu Tutora

## Spis treści
1. [Dashboard (Strona główna)](#dashboard-strona-główna)
2. [Profil](#profil)
3. [Kalendarz](#kalendarz)
4. [Moi Uczniowie](#moi-uczniowie)
5. [Sesje](#sesje)
6. [Historia](#historia)
7. [Moje raporty](#moje-raporty)

---

## Dashboard (Strona główna)

**Ścieżka:** `/dashboard`

### Opis
Strona główna panelu tutora wyświetlająca statystyki i najbliższą lekcję.

### Funkcje

#### Statystyki
- **Aktywne przypisania** - Liczba aktywnych przypisań ucznia do tutora
- **Sesje w tym miesiącu** - Liczba sesji przeprowadzonych w bieżącym miesiącu oraz suma godzin

#### Najbliższa lekcja
- Wyświetla informacje o najbliższej zaplanowanej lekcji:
  - Data i godzina
  - Imię i nazwisko ucznia
  - Przedmiot
  - Poziom trudności
- Jeśli nie ma zaplanowanych lekcji, wyświetla odpowiedni komunikat

### Komponenty
- `DashboardPage` - Komponent główny strony
- Karty statystyczne (Card)
- Karta z najbliższą lekcją

---

## Profil

**Ścieżka:** `/dashboard/profil`

### Opis
Strona umożliwiająca tutorowi edycję danych osobowych oraz wybór przedmiotów i poziomów, których naucza.

### Funkcje

#### 1. Formularz danych osobowych (`ProfileForm`)
- **Imię i nazwisko** - Pole edytowalne, wymagane
- **Email** - Pole tylko do odczytu (nie można zmienić)
- **Numer telefonu** - Pole opcjonalne
- **O mnie** - Pole tekstowe (textarea) do opisu doświadczenia i wykształcenia
- **Zapisz zmiany** - Przycisk zapisujący dane do bazy

#### 2. Wybór przedmiotów i poziomów (`SubjectSelection`)
- Wyświetla listę wszystkich przedmiotów z systemu
- Dla każdego przedmiotu pokazuje dostępne poziomy trudności
- Tutor może zaznaczyć checkboxy przy poziomach, których naucza
- Poziomy są sortowane według kolejności (`level_order`)
- **Zapisz zmiany** - Przycisk zapisujący wybrane poziomy do tabeli `tutor_subject_levels`

### Akcje serwerowe (`actions.ts`)
- `saveProfile(tutorId, data)` - Zapisuje dane osobowe tutora (imię, telefon, bio)
- `saveSubjectLevels(tutorId, subjectLevelIds)` - Zapisuje wybrane poziomy przedmiotów dla tutora

### Komponenty
- `ProfileForm` - Formularz danych osobowych
- `SubjectSelection` - Wybór przedmiotów i poziomów

---

## Kalendarz

**Ścieżka:** `/dashboard/kalendarz`

### Opis
Strona umożliwiająca tutorowi zarządzanie grafikiem dostępności oraz przypisywanie uczniów do konkretnych slotów czasowych.

### Funkcje

#### 1. Szablon dostępności (`AvailabilityCalendar`)
- **Tryb edycji** - Tutor może kliknąć "Edytuj grafik" aby wejść w tryb edycji
- **Siatka czasowa** - Wyświetla dni tygodnia (Pn-Nd) i sloty czasowe
- **Godziny pracy:**
  - Pn-Pt: 13:00-21:00
  - Sb-Nd: 8:00-21:00
- **Domyślny szablon:**
  - Pn-Pt: 14:00-21:00
  - Sb-Nd: 9:00-14:00
- **Zaznaczanie slotów:**
  - Kliknięcie na slot przełącza jego dostępność
  - Zielone sloty = dostępny
  - Szare sloty = niedostępny
- **Statystyki:**
  - Liczba dostępnych slotów
  - Suma godzin tygodniowo
- **Akcje:**
  - "Zapisz szablon" - Zapisuje zmiany do bazy danych
  - "Przywróć domyślny" - Przywraca domyślny szablon
  - "Anuluj" - Anuluje zmiany i przywraca zapisany stan
  - "Edytuj grafik" - Włącza tryb edycji

#### 2. Przypisywanie uczniów do slotów
- W trybie podglądu (po zapisaniu szablonu):
  - Kliknięcie na dostępny slot otwiera dialog przypisania
  - Kliknięcie na zarezerwowany slot proponuje anulowanie rezerwacji
- **Dialog przypisania (`AssignDialog`):**
  - Wybór aktywnego przypisania (uczeń + przedmiot + poziom)
  - Potwierdzenie przypisania tworzy wpis w tabeli `booked_slots`

#### 3. Realtime updates
- Automatyczne odświeżanie listy rezerwacji przy zmianach w bazie danych
- Używa Supabase Realtime do nasłuchiwania zmian w tabeli `booked_slots`

### Akcje serwerowe (`actions.ts`)
- `saveAvailability(tutorId, slots)` - Zapisuje szablon dostępności
- `listTutorBookedSlots(tutorId)` - Pobiera listę zarezerwowanych slotów tutora
- `createBookedSlotAction(createdBy, input)` - Tworzy nową rezerwację slotu
- `cancelBookedSlotAction(slotId)` - Anuluje rezerwację slotu
- `getTutorActiveAssignments(tutorId)` - Pobiera aktywne przypisania tutora

### Komponenty
- `AvailabilityCalendar` - Główny komponent kalendarza
- `TimeSlotGrid` - Siatka z slotami czasowymi
- `DayColumn` - Kolumna dla jednego dnia tygodnia
- `AssignDialog` - Dialog przypisywania ucznia do slotu

---

## Moi Uczniowie

**Ścieżka:** `/dashboard/uczniowie`

### Opis
Strona wyświetlająca listę uczniów przypisanych do tutora. Tutor widzi tylko swoich uczniów (z aktywnych przypisań).

### Funkcje

#### Lista uczniów (`StudentsTable`)
- Wyświetla tabelę z uczniami:
  - Imię i nazwisko
  - Email rodzica (główny rodzic)
  - Telefon rodzica
  - Przedmioty i poziomy (z przypisań)
  - Notatki o uczniu
- **Filtrowanie i wyszukiwanie:**
  - Pole wyszukiwania po imieniu, nazwisku, emailu
- **Akcje:**
  - Podgląd szczegółów ucznia
  - Dodawanie/edycja notatek o uczniu (tylko dla tutora)

### Dane
- Pobiera uczniów z aktywnych przypisań (`student_assignments` gdzie `tutor_id = current_user` i `status = 'active'`)
- Dla każdego ucznia pobiera:
  - Dane osobowe
  - Rodziców (główny rodzic)
  - Notatki
  - Przedmioty i poziomy z przypisań

### Komponenty
- `StudentsTable` - Tabela z uczniami

---

## Sesje

**Ścieżka:** `/dashboard/sesje`

### Opis
Strona umożliwiająca tutorowi dodawanie, przeglądanie i usuwanie sesji korepetycji.

### Funkcje

#### 1. Lista sesji (`SessionsManagement`)
- Wyświetla tabelę z wszystkimi sesjami tutora:
  - Data i godzina
  - Uczeń
  - Przedmiot
  - Poziom
  - Notatki
  - Czas trwania
- **Filtrowanie:**
  - Pole wyszukiwania po imieniu/nazwisku ucznia, tutorze, przedmiocie
- **Zaznaczanie:**
  - Checkboxy do zaznaczania wielu sesji
  - "Usuń zaznaczone" - Usuwa wybrane sesje
- **Statystyki:**
  - Suma godzin wszystkich sesji (po filtrowaniu)

#### 2. Dodawanie sesji (`SessionDialog`)
- Dialog z formularzem:
  - Wybór przypisania (uczeń + przedmiot + poziom)
  - Data i godzina sesji
  - Czas trwania (w minutach)
  - Notatki (opcjonalne)
- **Sugerowane godziny:**
  - System może sugerować dostępne sloty czasowe na podstawie grafiku tutora

### Akcje serwerowe (`actions.ts`)
- `createSession(data)` - Tworzy nową sesję korepetycji
  - Pobiera dane przypisania (student_id, tutor_id)
  - Tworzy wpis w tabeli `tutoring_sessions`
- `deleteSession(id)` - Usuwa sesję
- `getSuggestedSessionTimes(params)` - Sugeruje dostępne godziny na podstawie grafiku

### Komponenty
- `SessionsManagement` - Główny komponent zarządzania sesjami
- `SessionDialog` - Dialog dodawania/edycji sesji

---

## Historia

**Ścieżka:** `/dashboard/historia`

### Opis
Strona wyświetlająca historię wszystkich sesji korepetycji przeprowadzonych przez tutora.

### Funkcje

#### 1. Statystyki (`HistoryView`)
- **Suma godzin** - Łączna liczba godzin wszystkich sesji
- **Liczba sesji** - Całkowita liczba przeprowadzonych sesji

#### 2. Filtry
- **Szukaj** - Wyszukiwanie po imieniu/nazwisku ucznia lub przedmiocie
- **Data od** - Filtrowanie od wybranej daty
- **Data do** - Filtrowanie do wybranej daty

#### 3. Tabela historii
- Wyświetla wszystkie sesje tutora:
  - Data i godzina (sformatowana po polsku)
  - Uczeń
  - Przedmiot
  - Poziom
  - Czas trwania (w minutach)
  - Notatki

### Dane
- Pobiera wszystkie sesje z tabeli `tutoring_sessions` gdzie `tutor_id = current_user`
- Sortuje od najnowszych do najstarszych
- Dla każdej sesji pobiera:
  - Dane ucznia
  - Przedmiot i poziom z przypisania

### Komponenty
- `HistoryView` - Główny komponent widoku historii

---

## Moje raporty

**Ścieżka:** `/dashboard/moje-raporty`

### Opis
Strona umożliwiająca tutorowi tworzenie i zarządzanie miesięcznymi raportami godzin.

### Funkcje

#### 1. Lista raportów (`ReportsTable`)
- Wyświetla tabelę z raportami:
  - Okres (miesiąc i rok)
  - Status (Roboczy, Złożony, Zatwierdzony, Opłacony)
  - Suma godzin
  - Kwota (jeśli zatwierdzona przez admina)
  - Data utworzenia
- **Akcje:**
  - "Utwórz raport" - Tworzy nowy raport
  - Edycja (tylko dla raportów w statusie "Roboczy")
  - Usuwanie (tylko dla raportów w statusie "Roboczy")

#### 2. Tworzenie/edycja raportu (`ReportDialog`)
- Formularz:
  - Wybór miesiąca i roku
  - Tabela z uczniami i liczbą godzin dla każdego
  - Suma godzin (obliczana automatycznie)
- **Statusy raportu:**
  - **Roboczy (draft)** - Można edytować i usuwać
  - **Złożony (submitted)** - Wysłany do admina, nie można edytować
  - **Zatwierdzony (approved)** - Zatwierdzony przez admina
  - **Opłacony (paid)** - Opłacony przez admina

### Akcje serwerowe (`actions.ts`)
- `createOrUpdateReport(tutorId, month, year, entries, status)` - Tworzy lub aktualizuje raport
  - Jeśli raport istnieje, usuwa stare wpisy i dodaje nowe
  - Jeśli nie istnieje, tworzy nowy raport z wpisami
  - Oblicza sumę godzin automatycznie
- `deleteReport(reportId)` - Usuwa raport (tylko robocze)

### Dane
- Pobiera raporty z tabeli `monthly_reports` gdzie `tutor_id = current_user`
- Dla każdego raportu pobiera wpisy (`monthly_report_entries`) z godzinami dla każdego ucznia
- Pobiera listę uczniów z aktywnych przypisań

### Komponenty
- `ReportsTable` - Tabela z raportami
- `ReportDialog` - Dialog tworzenia/edycji raportu

---

## Uwagi techniczne

### Autentykacja i autoryzacja
- Wszystkie strony sprawdzają czy użytkownik jest zalogowany i ma rolę `tutor`
- Jeśli nie, następuje przekierowanie do `/dashboard`

### Filtrowanie danych
- Wszystkie zapytania do bazy danych filtrują dane po `tutor_id = current_user.id`
- Tutor widzi tylko swoje dane (uczniów, sesje, raporty)

### Realtime
- Kalendarz używa Supabase Realtime do automatycznego odświeżania rezerwacji slotów

### Walidacja
- Formularze mają walidację po stronie klienta i serwera
- Daty i godziny są walidowane przed zapisem

### Błędy
- Wszystkie błędy są obsługiwane i wyświetlane użytkownikowi (toast notifications)
- Błędy serwerowe są logowane w konsoli

