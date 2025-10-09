# Quick Start Guide - Akademia Wiedzy

## 1. Zainstaluj zależności

```bash
cd aw
pnpm install
```

## 2. Skonfiguruj Supabase

### 2.1. Utwórz projekt Supabase

1. Przejdź na [supabase.com](https://supabase.com)
2. Kliknij "New Project"
3. Wybierz organizację i uzupełnij dane projektu

### 2.2. Ustaw zmienne środowiskowe

Skopiuj `.env.local.example` do `.env.local`:

```bash
cp .env.local.example .env.local
```

Uzupełnij dane z Supabase (Settings → API):

```env
NEXT_PUBLIC_SUPABASE_URL=https://twoj-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=twoj-klucz-anonimowy
```

## 3. Uruchom migracje bazy danych

### 3.1. Migracja główna (wymagana)

1. Otwórz Supabase Dashboard → SQL Editor
2. Skopiuj zawartość pliku `supabase/migrations/001_initial_schema.sql`
3. Uruchom query

### 3.2. Dane przykładowe (opcjonalne)

1. Skopiuj zawartość pliku `supabase/migrations/002_sample_data.sql`
2. Uruchom query w SQL Editor

## 4. Utwórz użytkowników

### 4.1. Administrator

1. Supabase Dashboard → Authentication → Users
2. Kliknij "Add user" → "Create new user"
3. Wprowadź:
   - **Email**: `admin@akademiawiedzy.pl`
   - **Password**: `Admin123!` (zmień później)
   - **Confirm Password**: `Admin123!`
   - **User Metadata** (JSON):
   ```json
   {
     "full_name": "Administrator",
     "role": "admin"
   }
   ```
4. Zaznacz "Auto Confirm User"
5. Kliknij "Create user"

### 4.2. Tutor (opcjonalnie)

Powtórz kroki jak wyżej, ale z danymi:

- **Email**: `tutor@akademiawiedzy.pl`
- **Password**: `Tutor123!`
- **User Metadata**:
```json
{
  "full_name": "Jan Kowalski",
  "role": "tutor"
}
```

## 5. Uruchom aplikację

```bash
pnpm dev
```

Aplikacja będzie dostępna na [http://localhost:3000](http://localhost:3000)

## 6. Zaloguj się

1. Przejdź do [http://localhost:3000](http://localhost:3000)
2. Zostaniesz przekierowany do strony logowania
3. Użyj danych:
   - Email: `admin@akademiawiedzy.pl`
   - Hasło: `Admin123!`

## 7. Pierwsze kroki w aplikacji

### Jako Administrator:

1. **Dodaj przedmioty**:
   - Przejdź do "Przedmioty"
   - Dodaj przedmiot (np. "Matematyka")
   - Dla każdego przedmiotu dodaj poziomy (np. "Podstawowy - 80 zł/h")

2. **Dodaj uczniów**:
   - Przejdź do "Uczniowie"
   - Kliknij "Dodaj ucznia"
   - Wypełnij formularz

3. **Przypisz ucznia do tutora**:
   - Przejdź do "Przypisania"
   - Kliknij "Nowe przypisanie"
   - Wybierz ucznia, tutora, przedmiot i poziom

4. **Dodaj sesję**:
   - Przejdź do "Sesje"
   - Kliknij "Dodaj sesję"
   - Wybierz przypisanie, datę i czas trwania

5. **Przeglądaj raporty**:
   - Przejdź do "Raporty"
   - Filtruj dane według potrzeb
   - Eksportuj do CSV

### Jako Tutor:

1. **Przeglądaj swoich uczniów**:
   - Przejdź do "Moi Uczniowie"

2. **Dodaj przeprowadzoną sesję**:
   - Przejdź do "Sesje"
   - Kliknij "Dodaj sesję"
   - Wybierz ucznia i wypełnij szczegóły

3. **Sprawdź historię**:
   - Przejdź do "Historia"
   - Zobacz wszystkie swoje sesje i zarobki

## Troubleshooting

### Błąd: "Invalid API key"

- Sprawdź czy `.env.local` zawiera poprawne dane
- Zrestartuj serwer dev (`Ctrl+C` i `pnpm dev`)

### Błąd: "Error: relation 'profiles' does not exist"

- Upewnij się, że uruchomiłeś migrację `001_initial_schema.sql`
- Sprawdź w Supabase → Table Editor czy tabele zostały utworzone

### Nie mogę się zalogować

- Sprawdź czy użytkownik został utworzony w Authentication → Users
- Sprawdź czy User Metadata zawiera poprawną rolę
- Upewnij się, że użytkownik ma status "confirmed"

### Strona przekierowuje w pętli

- Wyczyść cookies przeglądarki
- Sprawdź middleware.ts
- Zrestartuj serwer

## Następne kroki

Po skonfigurowaniu podstawowej aplikacji możesz:

- Dostosować kolory i style w `tailwind.config.ts`
- Dodać więcej przedmiotów i poziomów
- Zaprosić tutorów (stwórz dla nich konta)
- Rozpocząć dodawanie rzeczywistych danych

## Kontakt i wsparcie

Jeśli masz pytania lub napotkasz problemy, sprawdź:

- [Dokumentacja Next.js](https://nextjs.org/docs)
- [Dokumentacja Supabase](https://supabase.com/docs)
- [Dokumentacja shadcn/ui](https://ui.shadcn.com)

