# Dokumentacja Powiadomień w Systemie

## Przegląd

System powiadomień w aplikacji Akademia Wiedzy informuje użytkowników o ważnych zdarzeniach w systemie. Powiadomienia są wyświetlane w dzwonku powiadomień w headerze aplikacji oraz na dedykowanej stronie `/dashboard/powiadomienia`.

---

## Powiadomienia dla ADMINÓW

### 1. Nowa rezerwacja publiczna (`public_booking_created`)

**Kiedy się pojawia:**
- Gdy uczeń (gość) dokonuje rezerwacji terminu przez publiczną stronę rezerwacji

**Dla kogo:**
- Wszyscy administratorzy w systemie

**Treść powiadomienia:**
- **Tytuł:** "Nowa rezerwacja publiczna"
- **Wiadomość:** Zawiera imię i nazwisko ucznia, datę i godzinę rezerwacji, imię i nazwisko tutora oraz przedmiot i poziom
- **Przykład:** "Jan Kowalski zarezerwował(a) termin 15 listopada 2025 10:00-11:00 u tutora Anna Nowak (Matematyka - Poziom podstawowy)"

**Link:** `/dashboard/rezerwacje-publiczne`

**Gdzie jest tworzone:**
- `aw/src/lib/actions/public-booking.ts` - funkcja `bookPublicSlot()`

---

### 2. Nowy raport do zatwierdzenia (`report_submitted`)

**Kiedy się pojawia:**
- Gdy tutor wysyła raport miesięczny do zatwierdzenia (zmienia status z 'draft' na 'submitted')

**Dla kogo:**
- Wszyscy administratorzy w systemie

**Treść powiadomienia:**
- **Tytuł:** "Nowy raport do zatwierdzenia"
- **Wiadomość:** Zawiera miesiąc i rok raportu oraz liczbę godzin
- **Przykład:** "Tutor wysłał raport za Listopad 2025 (45.5 godzin)"

**Link:** `/dashboard/raporty-tutorow`

**Gdzie jest tworzone:**
- `aw/src/app/(dashboard)/dashboard/moje-raporty/actions.ts` - funkcja `createOrUpdateReport()` gdy status = 'submitted'

---

## Powiadomienia dla TUTORÓW

### 1. Rezerwacja potwierdzona (`public_booking_confirmed`)

**Kiedy się pojawia:**
- Gdy administrator potwierdza rezerwację publiczną (zmienia status rezerwacji na 'confirmed')

**Dla kogo:**
- Tutor, do którego przypisana jest rezerwacja

**Treść powiadomienia:**
- **Tytuł:** "Rezerwacja potwierdzona"
- **Wiadomość:** Zawiera imię i nazwisko ucznia, datę i godzinę rezerwacji oraz przedmiot (jeśli dostępny)
- **Przykład:** "Rezerwacja dla Jan Kowalski na 15 listopada 2025 10:00-11:00 (Matematyka - Poziom podstawowy) została potwierdzona."

**Link:** `/dashboard/rezerwacje-publiczne`

**Gdzie jest tworzone:**
- `aw/src/app/(dashboard)/dashboard/rezerwacje-publiczne/actions.ts` - funkcja `updateBookingStatus()` gdy status = 'confirmed'

---

### 2. Rezerwacja anulowana (`public_booking_cancelled`)

**Kiedy się pojawia:**
- Gdy administrator anuluje rezerwację publiczną (zmienia status rezerwacji na 'cancelled')

**Dla kogo:**
- Tutor, do którego przypisana była rezerwacja

**Treść powiadomienia:**
- **Tytuł:** "Rezerwacja anulowana"
- **Wiadomość:** Zawiera imię i nazwisko ucznia, datę i godzinę rezerwacji oraz przedmiot (jeśli dostępny)
- **Przykład:** "Rezerwacja dla Jan Kowalski na 15 listopada 2025 10:00-11:00 (Matematyka - Poziom podstawowy) została anulowana."

**Link:** `/dashboard/rezerwacje-publiczne`

**Gdzie jest tworzone:**
- `aw/src/app/(dashboard)/dashboard/rezerwacje-publiczne/actions.ts` - funkcja `updateBookingStatus()` gdy status = 'cancelled'

---

### 3. Nowe przypisanie ucznia (`assignment_created`)

**Kiedy się pojawia:**
- Gdy administrator przypisuje nowego ucznia do tutora

**Dla kogo:**
- Tutor, do którego przypisany został uczeń

**Treść powiadomienia:**
- **Tytuł:** "Nowe przypisanie ucznia"
- **Wiadomość:** Zawiera imię i nazwisko ucznia oraz przedmiot i poziom
- **Przykład:** "Przypisano Ci ucznia Jan Kowalski do przedmiotu Matematyka (Poziom podstawowy)"

**Link:** `/dashboard/przypisania`

**Gdzie jest tworzone:**
- `aw/src/app/(dashboard)/dashboard/przypisania/actions.ts` - funkcja `createAssignment()`

---

### 4. Zmiana statusu przypisania (`assignment_status_changed`)

**Kiedy się pojawia:**
- Gdy administrator zmienia status przypisania ucznia (na 'active', 'completed' lub 'cancelled')

**Dla kogo:**
- Tutor, do którego przypisany jest uczeń

**Treść powiadomienia:**
- **Tytuł:** Zależy od statusu:
  - "Przypisanie zakończone" (gdy status = 'completed')
  - "Przypisanie anulowane" (gdy status = 'cancelled')
  - "Przypisanie aktywowane" (gdy status = 'active')
- **Wiadomość:** Zawiera imię i nazwisko ucznia oraz przedmiot (jeśli dostępny)
- **Przykład:** "Przypisanie dla Jan Kowalski - Matematyka - Poziom podstawowy zostało zakończone."

**Link:** `/dashboard/przypisania`

**Gdzie jest tworzone:**
- `aw/src/app/(dashboard)/dashboard/przypisania/actions.ts` - funkcja `updateAssignmentStatus()`

---

### 5. Raport zatwierdzony (`report_approved`)

**Kiedy się pojawia:**
- Gdy administrator zatwierdza raport miesięczny tutora (zmienia status z 'submitted' na 'approved')

**Dla kogo:**
- Tutor, który wysłał raport

**Treść powiadomienia:**
- **Tytuł:** "Raport zatwierdzony"
- **Wiadomość:** Zawiera miesiąc i rok raportu oraz kwotę do wypłaty
- **Przykład:** "Twój raport za Listopad 2025 został zatwierdzony. Kwota do wypłaty: 1820.00 zł"

**Link:** `/dashboard/moje-raporty`

**Gdzie jest tworzone:**
- `aw/src/app/(dashboard)/dashboard/raporty-tutorow/actions.ts` - funkcja `approveReport()`

---

### 6. Raport opłacony (`report_paid`)

**Kiedy się pojawia:**
- Gdy administrator oznacza raport jako opłacony (zmienia status na 'paid')

**Dla kogo:**
- Tutor, którego raport został opłacony

**Treść powiadomienia:**
- **Tytuł:** "Raport opłacony"
- **Wiadomość:** Zawiera miesiąc i rok raportu oraz wypłaconą kwotę
- **Przykład:** "Raport za Listopad 2025 został oznaczony jako opłacony. Wypłacona kwota: 1820.00 zł"

**Link:** `/dashboard/moje-raporty`

**Gdzie jest tworzone:**
- `aw/src/app/(dashboard)/dashboard/raporty-tutorow/actions.ts` - funkcja `markAsPaid()`

---

### 7. Utworzona sesja (`session_created`)

**Kiedy się pojawia:**
- *Obecnie zdefiniowane w systemie, ale jeszcze nie implementowane w kodzie*

**Dla kogo:**
- Tutor (planowane)

**Link:** `/dashboard/sesje`

**Status:** Do zaimplementowania w przyszłości

---

## Szczegóły techniczne

### Wyświetlanie powiadomień

- **Dzwonek powiadomień:** W headerze aplikacji, pokazuje ostatnie 10 powiadomień
- **Strona powiadomień:** `/dashboard/powiadomienia` - pełna lista wszystkich powiadomień
- **Odświeżanie:** Automatyczne co 30 sekund
- **Oznaczanie jako przeczytane:** Możliwość oznaczenia pojedynczego lub wszystkich powiadomień

### Struktura powiadomienia

Każde powiadomienie zawiera:
- `id` - unikalny identyfikator
- `user_id` - ID użytkownika, dla którego jest powiadomienie
- `type` - typ powiadomienia (enum)
- `title` - tytuł powiadomienia
- `message` - treść wiadomości
- `read_at` - data przeczytania (null jeśli nieprzeczytane)
- `metadata` - dodatkowe dane w formacie JSON (np. ID rezerwacji, raportu, przypisania)
- `created_at` - data utworzenia

### Formatowanie czasu

- **W dzwonku:** Relatywny format ("przed chwilą", "5 minut temu", "2 godziny temu") lub pełna data dla starszych
- **Na stronie powiadomień:** Pełna data i godzina (np. "15 listopada 2025, 10:30")

---

## Uwagi

1. Wszystkie powiadomienia są tworzone przez server actions używając funkcji `createNotification()` z `aw/src/lib/actions/notifications.ts`
2. Błędy podczas tworzenia powiadomień są logowane, ale nie przerywają głównego procesu (np. rezerwacji, zatwierdzania raportu)
3. Powiadomienia są widoczne tylko dla użytkownika, dla którego zostały utworzone (RLS - Row Level Security)
4. Powiadomienia są automatycznie revalidowane po utworzeniu, aby odświeżyć widok w aplikacji

