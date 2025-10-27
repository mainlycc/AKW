# Konfiguracja Resend Email

## Instalacja i setup

### 1. Rejestracja na Resend

1. Przejdź na [https://resend.com](https://resend.com)
2. Zarejestruj się i zaloguj
3. W Dashboard → API Keys wygeneruj nowy klucz
4. Skopiuj klucz (zaczyna się od `re_`)

### 2. Konfiguracja zmiennych środowiskowych

Dodaj do pliku `.env.local` (w katalogu `aw/`):

```env
# Application URL (zmień na prawidłowy URL w produkcji)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Resend API Key
RESEND_API_KEY=re_your_api_key_here
```

**⚠️ Uwaga**: `RESEND_API_KEY` nie ma prefiksu `NEXT_PUBLIC_` - to klucz serwerowy (secret)!

### 3. Testowanie

1. Uruchom aplikację: `pnpm dev`
2. Zaloguj się jako admin
3. Przejdź do "Zaproszenia" w panelu admin
4. Wyślij zaproszenie na swój email testowy
5. Sprawdź skrzynkę (również folder spam)

### 4. Monitorowanie

Sprawdź Dashboard Resend → Emails, aby zobaczyć:
- Status wysyłki (queued, sent, bounced, etc.)
- Szczegóły błędów (jeśli występują)
- Statystyki dostarczalności

## Produkcja

### Weryfikacja domeny (opcjonalne)

Aby wysyłać emaile z własnej domeny (np. `noreply@akademiawiedzy.pl`):

1. W Resend Dashboard → Domains → Add Domain
2. Dodaj domenę (np. `akademiawiedzy.pl`)
3. Dodaj rekordy DNS wskazane przez Resend:
   - SPF record
   - DKIM records
4. Poczekaj na weryfikację
5. Zmień `FROM_EMAIL` w `src/lib/email/client.ts` na nową domenę

### Zmienne w produkcji

W Vercel lub innej platformie hostingowej ustaw:
- `NEXT_PUBLIC_APP_URL` → właściwy URL produkcyjny (np. `https://akademiawiedzy.pl`)
- `RESEND_API_KEY` → produkcyjny API key z Resend

## Limity Free Tier

**Resend Free Tier** oferuje:
- 3,000 emaili/miesiąc
- 100 emaili/dzień
- Wystarczające dla małych/średnich platform

Jeśli potrzebujesz więcej:
- **Pro**: $20/miesiąc - 50,000 emaili
- **Enterprise**: custom pricing

## Rozwiązywanie problemów

### Email nie dociera

1. Sprawdź terminal/konsolę - czy są błędy?
2. Sprawdź Resend Dashboard → Emails
3. Sprawdź folder spam w swojej skrzynce
4. Upewnij się, że używasz właściwego adresu "from":
   - Dla testów: `onboarding@resend.dev`
   - W produkcji: zweryfikowana domena

### Błąd: "RESEND_API_KEY is not set"

- Upewnij się, że `.env.local` istnieje i zawiera `RESEND_API_KEY`
- Zrestartuj serwer dev po dodaniu zmiennej

### Błąd: "Invalid API key"

- Sprawdź czy klucz jest poprawnie skopiowany (zaczyna się od `re_`)
- Upewnij się, że nie ma spacji przed/po kluczu
- Wygeneruj nowy klucz w Resend Dashboard

## Dodatkowe funkcje

Obecnie zaimplementowano:
- ✅ Wysyłanie emaili z linkiem zaproszenia

Można rozszerzyć o:
- ⏳ Powiadomienia o nowych sesjach
- ⏳ Przypomnienia o raportach miesięcznych
- ⏳ Powiadomienia dla admin o nowych raportach tutorów
- ⏳ Szablony email w React Email (zaawansowane)

