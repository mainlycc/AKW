# Konfiguracja PayU - Płatności Online

## 1. Utwórz konto PayU

1. Przejdź na [https://www.payu.pl](https://www.payu.pl)
2. Kliknij **Załóż konto** lub **Dołącz do PayU**
3. Wypełnij formularz rejestracyjny dla firm
4. Po weryfikacji otrzymasz dostęp do panelu PayU

## 2. Aktywuj środowisko testowe (Sandbox)

1. Zaloguj się do panelu PayU: [https://secure.payu.com/cp/login](https://secure.payu.com/cp/login)
2. W menu wybierz **Moje sklepy** → **Dodaj sklep**
3. Wprowadź dane sklepu testowego:
   - **Nazwa sklepu**: "Akademia Wiedzy - Test"
   - **URL sklepu**: adres Twojej aplikacji (np. https://localhost:3000)
4. Zaznacz opcję **Sklep testowy (Sandbox)**
5. Zapisz sklep

## 3. Pobierz dane konfiguracyjne

Po utworzeniu sklepu, przejdź do **Ustawienia sklepu** → **Punkty płatności**:

### Dane do pobrania:

1. **POS ID (Id punktu płatności)**
   - Unikalny identyfikator Twojego punktu płatności
   - Format: liczba (np. `300746`)

2. **Client ID**
   - Używany do uwierzytelniania OAuth2
   - Format: liczba (taka sama jak POS ID)

3. **Client Secret (Klucz autoryzacji - MD5)**
   - Sekretny klucz do OAuth2
   - Format: ciąg znaków (np. `2ee86a66e5d97e3fadc400c9f19b065d`)

4. **Second Key (Drugi klucz - MD5)**
   - Używany do weryfikacji podpisu webhook
   - Format: ciąg znaków (np. `b6ca15b0390e616ed6c6c6d7c48a7d8d`)

⚠️ **Uwaga**: Zapisz te dane w bezpiecznym miejscu!

## 4. Konfiguracja zmiennych środowiskowych

Dodaj do pliku `.env.local` (w katalogu `aw/`):

```env
# PayU Configuration (Sandbox)
PAYU_POS_ID=twoj_pos_id
PAYU_CLIENT_ID=twoj_client_id
PAYU_CLIENT_SECRET=twoj_client_secret
PAYU_MD5_KEY=twoj_second_key_md5
PAYU_API_URL=https://secure.snd.payu.com

# URL aplikacji (dla webhook i continueUrl)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Przykład z rzeczywistymi danymi testowymi**:
```env
PAYU_POS_ID=300746
PAYU_CLIENT_ID=300746
PAYU_CLIENT_SECRET=2ee86a66e5d97e3fadc400c9f19b065d
PAYU_MD5_KEY=b6ca15b0390e616ed6c6c6d7c48a7d8d
PAYU_API_URL=https://secure.snd.payu.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 5. Konfiguracja Webhook (dla lokalnego rozwoju)

### Opcja A: Używanie ngrok (zalecane dla developmentu)

PayU wymaga aby webhook URL był dostępny przez HTTPS z internetu.

1. **Zainstaluj ngrok**:
   - Pobierz z [https://ngrok.com/download](https://ngrok.com/download)
   - Zarejestruj się i pobierz authtoken

2. **Uruchom ngrok** (w osobnym terminalu):
   ```bash
   ngrok http 3000
   ```

3. **Skopiuj URL HTTPS**:
   - ngrok wyświetli URL typu: `https://abc123.ngrok.io`
   - Zaktualizuj `.env.local`:
     ```env
     NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
     ```

4. **Skonfiguruj webhook w PayU**:
   - Panel PayU → **Moje sklepy** → wybierz sklep → **Ustawienia**
   - **Adres powiadomień (notifyUrl)**: `https://abc123.ngrok.io/api/payu/webhook`
   - Zapisz zmiany

### Opcja B: Konfiguracja dla produkcji

1. W panelu PayU przejdź do **Moje sklepy** → wybierz sklep → **Ustawienia**
2. W sekcji **Adresy i powiadomienia** wprowadź:
   - **Adres powiadomień**: `https://twoja-domena.pl/api/payu/webhook`
3. Zapisz zmiany

## 6. Testowanie płatności

### Środowisko Sandbox

PayU Sandbox udostępnia testowe metody płatności:

#### Testowe karty kredytowe:

- **Visa (sukces)**:
  - Numer: `4444333322221111`
  - Data ważności: dowolna przyszła (np. `12/28`)
  - CVV: `123`

- **Mastercard (sukces)**:
  - Numer: `5555555555554444`
  - Data ważności: dowolna przyszła
  - CVV: `123`

- **Visa (odrzucona)**:
  - Numer: `4012001037141112`

#### Testowy BLIK:

- Kod BLIK: `777123` (automatyczne zatwierdzenie)
- Kod BLIK: `777000` (automatyczne odrzucenie)

#### Przelewy online:

Wszystkie banki w sandbox działają automatycznie (instant payment).

### Testowanie w aplikacji

1. Uruchom aplikację: `pnpm dev`
2. Zaloguj się jako admin
3. Przejdź do **Rozliczenia deklaracji**
4. Wybierz ucznia → **Wyślij link płatności**
5. Sprawdź email - kliknij link płatności
6. Użyj testowej karty lub metody płatności
7. Sprawdź czy status płatności został zaktualizowany w panelu

## 7. Monitorowanie

### Panel PayU

W panelu PayU możesz monitorować:
- **Transakcje** → lista wszystkich płatności
- **Raporty** → szczegółowe raporty finansowe
- **Logi powiadomień** → historia wywołań webhook

### Logi aplikacji

W konsoli aplikacji zobaczysz:
- Tworzenie zamówień PayU
- Otrzymane powiadomienia webhook
- Błędy walidacji i autoryzacji

## 8. Produkcja

### Przejście na środowisko produkcyjne

1. **Aktywuj konto produkcyjne**:
   - W panelu PayU przejdź przez proces weryfikacji firmy
   - Podpisz umowę z PayU
   - Otrzymasz dostęp do środowiska produkcyjnego

2. **Utwórz punkt płatności produkcyjny**:
   - Panel PayU → **Moje sklepy** → **Dodaj sklep**
   - Wprowadź dane RZECZYWISTEGO sklepu
   - **NIE** zaznaczaj opcji "Sklep testowy"

3. **Pobierz produkcyjne dane konfiguracyjne**:
   - POS ID (inny niż w sandbox)
   - Client ID
   - Client Secret
   - Second Key (MD5)

4. **Zaktualizuj zmienne środowiskowe** w produkcji:
   ```env
   PAYU_POS_ID=twoj_produkcyjny_pos_id
   PAYU_CLIENT_ID=twoj_produkcyjny_client_id
   PAYU_CLIENT_SECRET=twoj_produkcyjny_client_secret
   PAYU_MD5_KEY=twoj_produkcyjny_md5_key
   PAYU_API_URL=https://secure.payu.com
   NEXT_PUBLIC_APP_URL=https://twoja-domena.pl
   ```

5. **Skonfiguruj produkcyjny webhook**:
   - URL: `https://twoja-domena.pl/api/payu/webhook`
   - Musi być dostępny przez HTTPS

## 9. Rozwiązywanie problemów

### Webhook nie działa

1. **Sprawdź URL webhook**:
   - Dla developmentu: użyj ngrok i sprawdź czy URL jest aktualny
   - Dla produkcji: sprawdź czy domena jest dostępna przez HTTPS

2. **Sprawdź logi w panelu PayU**:
   - **Transakcje** → wybierz płatność → **Powiadomienia**
   - Zobacz szczegóły błędów HTTP

3. **Sprawdź weryfikację podpisu**:
   - Upewnij się że używasz poprawnego MD5_KEY (Second Key)
   - Sprawdź logi aplikacji pod kątem błędów weryfikacji

### Błąd autoryzacji OAuth2

1. Sprawdź czy CLIENT_ID i CLIENT_SECRET są poprawne
2. Sprawdź czy używasz odpowiedniego URL API (sandbox vs produkcja)
3. Token OAuth2 jest ważny ~12h - aplikacja automatycznie go odnawia

### Płatność nie jest zapisywana w bazie

1. Sprawdź czy webhook został wywołany (Panel PayU → Transakcje)
2. Sprawdź logi aplikacji pod kątem błędów
3. Sprawdź czy migracja `031_payu_integration.sql` została uruchomiona
4. Sprawdź czy RLS policies pozwalają na zapis do tabeli `payu_payments`

### Błąd "PAYU_POS_ID is not set"

Upewnij się, że:
1. Zmienne są w pliku `.env.local` (dla developmentu)
2. Zrestartowałeś serwer dev po dodaniu zmiennych
3. W produkcji zmienne są ustawione w panelu hostingowym (np. Vercel)

## 10. Opłaty i prowizje

**PayU** standardowe stawki:
- **Karty płatnicze**: ~2.9% + 0.30 PLN za transakcję
- **BLIK**: ~1.5% za transakcję
- **Przelewy online**: ~1.5% za transakcję
- Brak opłat miesięcznych za sam dostęp do API

⚠️ **Uwaga**: Dokładne stawki negocjuj bezpośrednio z PayU.

## 11. Bezpieczeństwo

⚠️ **WAŻNE**:
- **NIGDY** nie commituj pliku `.env.local` do repozytorium
- Klucze `PAYU_CLIENT_SECRET` i `PAYU_MD5_KEY` są sekretami - trzymaj je bezpiecznie
- W produkcji używaj zmiennych środowiskowych w panelu hostingowym, nie w kodzie
- Webhook MUSI być dostępny przez HTTPS w produkcji
- Zawsze weryfikuj podpis webhook przed przetworzeniem powiadomienia

## 12. Wsparcie

- **Dokumentacja PayU**: [https://developers.payu.com/europe/pl/](https://developers.payu.com/europe/pl/)
- **Panel PayU**: [https://secure.payu.com/cp/](https://secure.payu.com/cp/)
- **Wsparcie techniczne**: [pomoc@payu.pl](mailto:pomoc@payu.pl)
- **Sandbox**: [https://secure.snd.payu.com](https://secure.snd.payu.com)

## 13. Checklist wdrożenia

- [ ] Konto PayU utworzone i zweryfikowane
- [ ] Sklep testowy utworzony w panelu
- [ ] Pobrano wszystkie klucze API (POS_ID, Client credentials, MD5)
- [ ] Zmienne środowiskowe skonfigurowane w `.env.local`
- [ ] ngrok uruchomiony (dla developmentu)
- [ ] Webhook URL skonfigurowany w panelu PayU
- [ ] Wykonano testową płatność kartą
- [ ] Wykonano testową płatność BLIK
- [ ] Webhook działa poprawnie (status aktualizuje się w bazie)
- [ ] Przygotowano dane produkcyjne (dla wdrożenia)
