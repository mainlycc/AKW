## Tryb testowy aplikacji

Ten dokument opisuje, jak uruchamiać aplikację w **trybie testowym** oraz jak wykonywać testy, żeby sprawdzić, czy główne funkcje systemu działają poprawnie.

---

## 1. Założenia

- **Środowisko**: lokalne (`localhost:3000`)
- **Backend**: Supabase (ten sam projekt co dla dev, ale możesz utworzyć osobny projekt Supabase tylko do testów)
- **Baza danych**: dane testowe (np. przykładowi uczniowie, tutorzy, sesje)

Rekomendacja: jeśli planujesz dużo testów, rozważ zrobienie **osobnego projektu Supabase** tylko do testów („środowisko testowe”), aby nie mieszać danych testowych z produkcyjnymi.

---

## 2. Osobne środowisko testowe (opcjonalne, ale zalecane)

1. Wejdź na panel Supabase i utwórz **nowy projekt** (np. nazwa: `akademiawiedzy-test`).
2. W nowym projekcie:
   - uruchom **te same migracje SQL**, co w głównym projekcie (patrz `supabase/migrations`),
   - opcjonalnie załaduj dane przykładowe (uczniowie, tutorzy itd.).
3. Utwórz plik `.env.test.local` (obok `.env.local`) z danymi nowego projektu Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://twoj-projekt-test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=twoj-testowy-klucz-anonimowy
```

4. W `package.json` dodaj skrypt startujący aplikację z tym plikiem (przykładowo, jeśli używasz `cross-env` lub innego mechanizmu – do dostosowania do Twojej konfiguracji):

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:test": "cross-env NODE_ENV=test next dev"
  }
}
```

> Uwaga: sposób wykorzystania `.env.test.local` zależy od Twojej konfiguracji. W prostym scenariuszu możesz po prostu **tymczasowo podmieniać** `.env.local` na testowy, gdy chcesz testować.

---

## 3. Dane testowe – konta użytkowników

W projekcie testowym Supabase (lub w dev, jeśli nie rozdzielasz środowisk) utwórz minimum:

- konto **administratora**,
- konto **tutora** (jeśli chcesz testować widok tutora).

Przykładowe dane (możesz dostosować do swoich potrzeb):

### 3.1. Administrator

- Email: `admin-test@akademiawiedzy.pl`
- Hasło: `AdminTest123!`
- User Metadata:

```json
{
  "full_name": "Admin Testowy",
  "role": "admin"
}
```

### 3.2. Tutor

- Email: `tutor-test@akademiawiedzy.pl`
- Hasło: `TutorTest123!`
- User Metadata:

```json
{
  "full_name": "Tutor Testowy",
  "role": "tutor"
}
```

---

## 4. Uruchamianie aplikacji w trybie testowym

### 4.1. Prosty wariant (bez osobnego pliku `.env.test.local`)

1. Skonfiguruj `.env.local` tak, aby wskazywał na **testowy projekt Supabase**.
2. Uruchom aplikację:

```bash
pnpm dev
```

3. Wejdź na `http://localhost:3000` i loguj się na konta testowe.

### 4.2. Wariant z osobnym środowiskiem (`.env.test.local`)

1. Podmień tymczasowo plik środowiskowy:
   - zmień nazwę:

```bash
mv .env.local .env.local.backup
mv .env.test.local .env.local
```

2. Uruchom:

```bash
pnpm dev
```

3. Po zakończonych testach przywróć oryginalny plik:

```bash
mv .env.local .env.test.local
mv .env.local.backup .env.local
```

> Ten mechanizm możesz zautomatyzować według własnych potrzeb (np. prostym skryptem).

---

## 5. Ręczny scenariusz testowy – „czy główne funkcje działają”

Poniżej przykładowa lista kroków do ręcznego przejścia po aplikacji:

### 5.1. Logowanie jako Administrator

1. Otwórz `http://localhost:3000`.
2. Zaloguj się jako **Admin Testowy**.
3. Sprawdź, czy:
   - widzisz panel administratora,
   - w menu dostępne są odpowiednie zakładki (np. Uczniowie, Przedmioty, Sesje, Raporty).

### 5.2. Zarządzanie przedmiotami i poziomami

1. Przejdź do zakładki **Przedmioty**.
2. Dodaj nowy przedmiot (np. „Matematyka – test”).
3. Dodaj do niego poziom (np. „Podstawowy – 80 zł/h”).
4. Upewnij się, że nowy przedmiot i poziom są widoczne na liście.

### 5.3. Dodawanie ucznia i przypisanie do tutora

1. Przejdź do **Uczniowie**.
2. Dodaj nowego ucznia testowego (np. „Uczeń Testowy”).
3. Przejdź do **Przypisania**.
4. Utwórz nowe przypisanie:
   - wybierz ucznia testowego,
   - wybierz tutora testowego,
   - wybierz przedmiot testowy i poziom.

### 5.4. Dodawanie sesji

1. Przejdź do zakładki **Sesje**.
2. Dodaj nową sesję:
   - wybierz istniejące przypisanie,
   - ustaw datę i czas,
   - wpisz czas trwania (np. 60 minut).
3. Sprawdź, czy sesja pojawia się na liście.

### 5.5. Raporty

1. Przejdź do **Raporty**.
2. Przefiltruj dane (np. po uczniu, tutorze, zakresie dat).
3. Sprawdź, czy raport pokazuje nowo dodaną sesję.
4. Jeśli jest opcja eksportu do CSV, użyj jej i upewnij się, że plik się generuje.

### 5.6. Widok Tutora

1. Wyloguj się z konta administratora.
2. Zaloguj się jako **Tutor Testowy**.
3. Sprawdź:
   - czy widzisz przypisanych do siebie uczniów,
   - czy możesz dodać nową sesję z uczniem,
   - czy historia sesji i zarobków wygląda poprawnie.

---

## 6. Automatyczne testy (unit / komponenty / E2E)

Jeżeli w projekcie są skonfigurowane testy (Vitest, Testing Library, Playwright), rekomendowany „pełny tryb testowy” wygląda tak:

1. **Testy jednostkowe i komponentów**:

```bash
pnpm test
```

2. **Testy end-to-end (E2E)**:

```bash
pnpm test:e2e
```

3. Jeśli oba kroki przechodzą bez błędów **i** ręczne scenariusze z punktu 5 działają, możesz uznać, że aplikacja przeszła tryb testowy.

---

## 7. Dobre praktyki dla trybu testowego

- Oddzielaj **dane testowe** od **produkcyjnych** (osobny projekt Supabase lub osobna baza).
- Używaj **kont testowych** z jasnymi nazwami (np. `admin-test@...`), żeby nie pomylić ich z realnymi użytkownikami.
- Regularnie **czyść dane testowe**, żeby środowisko testowe było czytelne.
- Najważniejsze scenariusze użytkowników (np. logowanie, dodanie ucznia, dodanie sesji, generowanie raportu) trzymaj w jednym miejscu – w tym dokumencie – i przechodź je przy każdej większej zmianie w kodzie.

