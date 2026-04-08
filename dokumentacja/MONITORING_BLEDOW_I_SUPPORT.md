# Monitoring błędów i wsparcie tutorów (admin alerty + kontekst)

## Cel
Gdy tutorowi „coś nie działa” (np. nie może zmienić grafiku), administrator ma:
- **automatyczny sygnał**, że wystąpił problem,
- **kontekst** (kto, gdzie w aplikacji, jaka akcja, jakie dane, jaki błąd),
- **identyfikator zdarzenia** (żeby szybko znaleźć szczegóły i pomóc),
- **historię** takich incydentów (żeby wyłapać powtarzalne problemy / regresje).

Docelowo: zero zgadywania na podstawie „u mnie nie działa”.

---

## Proponowane rozwiązanie (3 warstwy)

### 1) Monitoring błędów aplikacji (Sentry) — “crashe” i wyjątki
**Po co:** stack trace + środowisko + user + route. Najszybszy sposób na realne błędy JS/Server.

**Zakres:**
- Frontend (błędy React/Next, `unhandledrejection`, wyjątki UI).
- Server actions / backend (wyjątki podczas zapisu do Supabase, walidacji itd.).

**Efekt dla admina:**
- alerty (mail/Slack), filtrowanie po tutorze, korelacja z release.

> Uwaga: Sentry nie zastępuje logów biznesowych (np. odrzucone operacje przez RLS), dlatego potrzebna jest warstwa 2.

---

### 2) Audit/Support events w Supabase — “co tutor próbował zrobić i czemu się nie udało”
**Po co:** częste problemy typu „nie mogę zmienić grafiku” wynikają z:
- RLS / uprawnień,
- konfliktów danych (np. dwa zapisy w tym samym czasie),
- walidacji,
- ograniczeń (np. “slot już zajęty”).

To nie zawsze jest „crash”, ale administrator musi widzieć **dokładny błąd z Supabase** + **payload**.

**Propozycja tabeli:** `support_events` (lub `audit_events`)
- `id` uuid (PK)
- `created_at` timestamptz default now()
- `severity` text (np. `info|warning|error|critical`)
- `actor_user_id` uuid (tutor)
- `actor_role` text (np. `tutor|admin`)
- `action` text (np. `availability.update`, `booked_slot.create`)
- `route` text (np. `/dashboard/kalendarz`)
- `correlation_id` text (UUID generowany w UI)
- `request` jsonb (ograniczony payload wejściowy)
- `result` jsonb (np. `{"success":true}` lub szczegóły)
- `supabase_error` jsonb (np. `code`, `message`, `details`, `hint`)
- `client` jsonb (opcjonalnie: `userAgent`, `timezone`, `locale`)

**Zasady bezpieczeństwa danych:**
- nie logować danych wrażliwych (np. pełnych numerów telefonu/PESEL),
- dla danych osobowych: minimalny zakres (np. `student_id` zamiast imienia i nazwiska),
- ograniczyć `request` do tego, co realnie pomaga diagnozować (np. lista slotów i daty).

---

### 3) Workflow supportu w UI — “Zgłoś problem” z kontekstem
**Po co:** tutor nie przekazuje chaotycznych informacji; system zbiera je w ustrukturyzowany sposób.

**Minimalny formularz:**
- pole “Co próbowałeś zrobić?”,
- “Co się stało?”,
- automatycznie: route/URL, userId, correlationId, timestamp.

**Efekt:** po zgłoszeniu powstaje wpis w `support_events` + powiadomienie dla adminów.

---

## Korelacja zdarzeń: `correlationId`
Kluczowe jest powiązanie:
- akcji w UI,
- wywołania server action,
- odpowiedzi Supabase,
- błędu w Sentry (jeśli wystąpi).

**Mechanika:**
- UI generuje `correlationId` (uuid) przy wejściu na ekran albo przy kliknięciu “Zapisz”.
- `correlationId` przekazywane do server action jako argument.
- server action dopina `correlationId` do:
  - wpisu w `support_events`,
  - kontekstu Sentry,
  - ewentualnie do `metadata` w `notifications` (dla admina).

---

## Powiadomienia dla admina (macie już fundament)
W projekcie jest system powiadomień:
- `aw/src/lib/actions/notifications.ts` — `createNotification()` zapisuje do `notifications` (admin client, omija RLS).
- `aw/src/lib/notifications/send-with-channel.ts` — helper “email/sms/both”.
- kanały: mail (Resend) i SMS (Twilio) są obecne w zależnościach.

**Propozycja:**
- dodać nowy typ powiadomienia np. `support_incident` / `tutor_error_reported`,
- tworzyć je **dla wszystkich adminów** przy `severity >= error` lub przy zgłoszeniu “Zgłoś problem”.

**Treść powiadomienia (przykład):**
- tytuł: “Problem u tutora: zapis grafiku”
- wiadomość: “Tutor: {imię/nick}, ekran: Kalendarz, correlationId: …”
- link: np. do adminowego widoku “Incydenty” (do dodania) lub do `/dashboard/powiadomienia` z filtrem.

---

## MVP (najmniej pracy, największy efekt)
1. **Sentry** (frontend + server actions) z przypisywaniem `userId` i `route`.
2. **Logowanie porażek** w krytycznych akcjach grafiku do `support_events` (zwłaszcza błędy Supabase/RLS).
3. **Admin alert** przez `createNotification()` dla `severity=error/critical`.
4. **CorrelationId** przekazywany z UI → server action.

Po MVP: UI “Zgłoś problem” + widok admina “Incydenty”.

---

## Gdzie w kodzie podpiąć (priorytet: grafik/dostępność)
Najbardziej newralgiczne miejsca (wg struktury repo):
- `aw/src/lib/actions/availability.ts`
- `aw/src/lib/actions/booked-slots.ts`
- `aw/src/app/(dashboard)/dashboard/kalendarz/actions.ts`
- `aw/src/app/(dashboard)/dashboard/dostepnosc-tutorow/actions.ts`

**Co logować:**
- nieudany insert/update/delete w Supabase,
- błędy walidacji (np. z Zod),
- konflikty danych (np. “slot zajęty”),
- odrzucenia przez RLS (kod/komunikat z Supabase).

---

## Reguły alertów (żeby nie spamować)
- **critical**: błąd uniemożliwia pracę (np. zapis grafiku zawsze failing) → natychmiastowy alert do admina (powiadomienie + opcjonalnie SMS).
- **error**: pojedynczy błąd zapisu / wyjątek → powiadomienie w panelu admina + ewentualnie mail (1/min throttling).
- **warning/info**: zapis do `support_events`, bez alertu (do analizy trendów).

---

## Efekt końcowy (jak admin pomaga tutorowi)
Tutor zgłasza “nie mogę zmienić grafiku” albo system wyłapuje błąd:
- admin dostaje powiadomienie z `correlationId`,
- w panelu incydentów widzi: akcję, payload, błąd Supabase (np. RLS), user/tutor, timestamp,
- może od razu wskazać przyczynę (uprawnienia/polityka, konflikt, błąd walidacji) i naprawić lub instrukcją pomóc tutorowi.

