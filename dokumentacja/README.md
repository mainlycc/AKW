# Akademia Wiedzy - System Zarządzania E-Korepetycjami

System do zarządzania korepetycjami online z podziałem na role admin i tutor.

## Funkcje MVP

### Panel Administratora
- ✅ Zarządzanie uczniami (dodawanie, edycja, usuwanie)
- ✅ Zarządzanie przedmiotami z poziomami trudności
- ✅ Przypisywanie uczniów do tutorów
- ✅ Dodawanie i przeglądanie sesji korepetycji
- ✅ Raporty godzin z filtrowaniem i eksportem do CSV
- ✅ Przeglądanie listy tutorów ze statystykami

### Panel Tutora
- ✅ Przeglądanie przypisanych uczniów
- ✅ Dodawanie sesji korepetycji
- ✅ Historia wszystkich przeprowadzonych sesji
- ✅ Statystyki (suma godzin, liczba sesji, zarobki)

## Technologie

- **Next.js 14+** (App Router)
- **TypeScript**
- **Supabase** (PostgreSQL, Auth, RLS)
- **shadcn/ui** (komponenty UI)
- **Tailwind CSS**

## Instalacja i uruchomienie

### 1. Zainstaluj zależności

Projekt już ma zainstalowane podstawowe zależności. Jeśli potrzebujesz doinstalować `date-fns`:

```bash
cd aw
pnpm add date-fns
```

### 2. Konfiguracja Supabase

1. Utwórz projekt na [supabase.com](https://supabase.com)
2. Skopiuj plik `.env.local.example` do `.env.local`
3. Uzupełnij dane dostępowe z Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Uruchom migracje bazy danych

1. Zaloguj się do panelu Supabase
2. Przejdź do SQL Editor
3. Skopiuj i uruchom zawartość pliku `supabase/migrations/001_initial_schema.sql`

Migracja utworzy:
- Tabele: profiles, students, subjects, subject_levels, student_assignments, tutoring_sessions
- Row Level Security (RLS) policies
- Triggery i funkcje
- Indeksy

### 4. Utwórz pierwszego użytkownika (admin)

W panelu Supabase Authentication:

1. Przejdź do **Authentication** → **Users**
2. Kliknij **Add user** → **Create new user**
3. Podaj:
   - Email: `admin@akademiawiedzy.pl`
   - Password: (ustaw bezpieczne hasło)
   - User Metadata (JSON):
   ```json
   {
     "full_name": "Administrator",
     "role": "admin"
   }
   ```

### 5. Uruchom aplikację

```bash
cd aw
pnpm dev
```

Aplikacja będzie dostępna pod adresem: [http://localhost:3000](http://localhost:3000)

## Struktura projektu

```
aw/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/          # Strona logowania
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx      # Layout z sidebar
│   │   │   └── dashboard/
│   │   │       ├── page.tsx    # Dashboard główny
│   │   │       ├── uczniowie/  # Zarządzanie uczniami
│   │   │       ├── tutorzy/    # Lista tutorów
│   │   │       ├── przedmioty/ # Zarządzanie przedmiotami
│   │   │       ├── przypisania/# Przypisywanie uczniów
│   │   │       ├── sesje/      # Sesje korepetycji
│   │   │       ├── raporty/    # Raporty godzin (admin)
│   │   │       └── historia/   # Historia sesji (tutor)
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                 # Komponenty shadcn/ui
│   │   ├── app-sidebar.tsx     # Sidebar aplikacji
│   │   ├── nav-user.tsx        # Menu użytkownika
│   │   └── ...
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts       # Klient dla komponentów client
│   │   │   ├── server.ts       # Klient dla Server Components
│   │   │   └── middleware.ts   # Middleware Supabase
│   │   ├── actions/
│   │   │   └── auth.ts         # Server Actions dla auth
│   │   └── types/
│   │       └── database.types.ts # Typy TypeScript
│   └── middleware.ts           # Next.js middleware (auth)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── .env.local.example
└── README.md
```

## Użytkowanie

### Logowanie

1. Przejdź do [http://localhost:3000](http://localhost:3000)
2. Zostaniesz przekierowany do `/login`
3. Zaloguj się używając emaila i hasła utworzonego w Supabase

### Tworzenie tutora

1. Zaloguj się jako admin
2. W panelu Supabase Authentication utwórz nowego użytkownika:
   - Email: `tutor@akademiawiedzy.pl`
   - User Metadata:
   ```json
   {
     "full_name": "Jan Kowalski",
     "role": "tutor"
   }
   ```

### Workflow podstawowy

1. **Admin dodaje przedmioty** z poziomami trudności (np. Matematyka: Podstawowy, Rozszerzony, Maturalny)
2. **Admin dodaje uczniów** z danymi kontaktowymi rodziców
3. **Admin przypisuje ucznia do tutora** wybierając przedmiot i poziom
4. **Tutor/Admin dodaje sesje** korepetycji po ich przeprowadzeniu
5. **Admin przegląda raporty** - suma godzin, koszty, statystyki

## Baza danych - schemat

### Tabele główne:
- `profiles` - profile użytkowników (admin/tutor)
- `students` - uczniowie (bez logowania)
- `subjects` - przedmioty
- `subject_levels` - poziomy trudności przedmiotów z cenami
- `student_assignments` - przypisania uczniów do tutorów
- `tutoring_sessions` - sesje korepetycji

### Bezpieczeństwo

Projekt wykorzystuje Row Level Security (RLS) w Supabase:
- Admini mają pełny dostęp do wszystkich danych
- Tutorzy widzą tylko swoich uczniów i swoje sesje
- Wszyscy authenticated użytkownicy mogą czytać podstawowe dane (przedmioty, poziomy)

## Dalszy rozwój

### Planowane funkcje (poza MVP):
- Publiczny kalendarz rezerwacji dla rodziców
- System powiadomień email
- Automatyczne faktury
- Panel dla uczniów/rodziców
- Integracja z systemami płatności
- Kalendarz dostępności tutorów
- Wideo korepetycje (integracja z Zoom/Meet)

## Wsparcie

W razie problemów z konfiguracją lub pytań, sprawdź:
- Dokumentację Next.js: https://nextjs.org/docs
- Dokumentację Supabase: https://supabase.com/docs
- Dokumentację shadcn/ui: https://ui.shadcn.com

## Licencja

Projekt prywatny dla Akademii Wiedzy.
