# Konfiguracja Stripe - Płatności Online

## 1. Utwórz konto Stripe

1. Przejdź na [https://stripe.com](https://stripe.com)
2. Zarejestruj się i zaloguj do Dashboard
3. Przejdź do trybu testowego (Toggle w lewym górnym rogu: "Test mode")

## 2. Pobierz klucze API

1. W Stripe Dashboard przejdź do **Developers** → **API keys**
2. Skopiuj **Publishable key** (zaczyna się od `pk_test_...`)
3. Skopiuj **Secret key** (zaczyna się od `sk_test_...`)

⚠️ **Uwaga**: W trybie testowym używasz kluczy testowych. W produkcji będziesz potrzebować kluczy produkcyjnych (bez `_test_`).

## 3. Konfiguracja zmiennych środowiskowych

Dodaj do pliku `.env.local` (w katalogu `aw/`):

```env
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Stripe Webhook Secret (zostanie dodany w następnym kroku)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## 4. Konfiguracja Webhook (dla lokalnego rozwoju)

### Opcja A: Używanie Stripe CLI (zalecane dla developmentu)

1. **Zainstaluj Stripe CLI**:
   - Windows: Pobierz z [https://stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)
   - Mac: `brew install stripe/stripe-cli/stripe`
   - Linux: Zobacz dokumentację Stripe

2. **Zaloguj się do Stripe CLI**:
   ```bash
   stripe login
   ```

3. **Uruchom webhook forwarding** (w osobnym terminalu):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. **Skopiuj webhook signing secret**:
   - Stripe CLI wyświetli secret zaczynający się od `whsec_...`
   - Skopiuj go i dodaj do `.env.local` jako `STRIPE_WEBHOOK_SECRET`

### Opcja B: Konfiguracja webhook w Stripe Dashboard (dla produkcji)

1. W Stripe Dashboard przejdź do **Developers** → **Webhooks**
2. Kliknij **Add endpoint**
3. Wprowadź:
   - **Endpoint URL**: `https://twoja-domena.pl/api/stripe/webhook`
   - **Description**: "Payment webhook for Akademia Wiedzy"
4. W sekcji **Events to send** wybierz:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Kliknij **Add endpoint**
6. Po utworzeniu endpointu, kliknij na niego
7. W sekcji **Signing secret** kliknij **Reveal** i skopiuj secret (zaczyna się od `whsec_...`)
8. Dodaj go do `.env.local` jako `STRIPE_WEBHOOK_SECRET`

## 5. Testowanie płatności

### Testowe karty kredytowe

Stripe udostępnia testowe karty do testowania:

- **Sukces**: `4242 4242 4242 4242`
- **Wymaga autoryzacji**: `4000 0025 0000 3155`
- **Odrzucona**: `4000 0000 0000 0002`

Dla wszystkich kart:
- **Data ważności**: Dowolna przyszła data (np. `12/34`)
- **CVC**: Dowolne 3 cyfry (np. `123`)
- **Kod pocztowy**: Dowolny (np. `12345`)

### Testowanie w aplikacji

1. Uruchom aplikację: `pnpm dev`
2. Zaloguj się jako admin
3. Przejdź do **Rozliczenia** → wybierz ucznia → **Dodaj płatność**
4. Wybierz metodę **Online (Stripe)**
5. Wprowadź kwotę i użyj testowej karty
6. Sprawdź w Stripe Dashboard → **Payments**, czy płatność została zarejestrowana

## 6. Produkcja

### Przejście na klucze produkcyjne

1. W Stripe Dashboard przełącz się na **Live mode** (Toggle w lewym górnym rogu)
2. Pobierz produkcyjne klucze z **Developers** → **API keys**
3. Zaktualizuj zmienne środowiskowe w produkcji:
   ```env
   STRIPE_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_... (z produkcyjnego webhook endpoint)
   ```

### Konfiguracja webhook w produkcji

1. Utwórz webhook endpoint w Stripe Dashboard (jak w Opcji B powyżej)
2. Użyj produkcyjnego URL: `https://twoja-domena.pl/api/stripe/webhook`
3. Skopiuj signing secret i dodaj do zmiennych środowiskowych

## 7. Monitorowanie

### Stripe Dashboard

Sprawdź w Stripe Dashboard:
- **Payments** → lista wszystkich płatności
- **Webhooks** → logi wywołań webhook (możesz zobaczyć czy webhook został wywołany poprawnie)
- **Events** → wszystkie zdarzenia w systemie

### Logi aplikacji

W konsoli przeglądarki i terminalu możesz zobaczyć:
- Błędy walidacji webhook
- Problemy z aktualizacją płatności w bazie danych

## Rozwiązywanie problemów

### Webhook nie działa

1. **Sprawdź czy webhook secret jest poprawny**:
   - Dla developmentu: użyj secret z `stripe listen`
   - Dla produkcji: użyj secret z Stripe Dashboard

2. **Sprawdź URL webhook**:
   - Dla developmentu: `http://localhost:3000/api/stripe/webhook`
   - Dla produkcji: `https://twoja-domena.pl/api/stripe/webhook`

3. **Sprawdź logi w Stripe Dashboard**:
   - **Webhooks** → kliknij na endpoint → **Recent deliveries**
   - Zobacz szczegóły błędów

### Płatność nie jest zapisywana w bazie

1. Sprawdź czy webhook został wywołany (Stripe Dashboard → Webhooks)
2. Sprawdź logi aplikacji pod kątem błędów
3. Sprawdź czy migracja `022_payments_schema.sql` została uruchomiona
4. Sprawdź czy RLS policies pozwalają na zapis do tabeli `payments`

### Błąd "STRIPE_WEBHOOK_SECRET is not set"

Upewnij się, że:
1. Zmienna `STRIPE_WEBHOOK_SECRET` jest w pliku `.env.local`
2. Zrestartowałeś serwer dev po dodaniu zmiennej
3. W produkcji zmienna jest ustawiona w panelu hostingowym (np. Vercel)

## Limity Free Tier

**Stripe** oferuje:
- Brak opłat za setup
- 2.9% + 0.30 PLN za udaną transakcję (karty polskie)
- Brak miesięcznych opłat
- Wszystkie funkcje dostępne od razu

## Bezpieczeństwo

⚠️ **WAŻNE**:
- **NIGDY** nie commituj pliku `.env.local` do repozytorium
- Klucze `STRIPE_SECRET_KEY` i `STRIPE_WEBHOOK_SECRET` są sekretami - trzymaj je bezpiecznie
- W produkcji używaj zmiennych środowiskowych w panelu hostingowym, nie w kodzie

