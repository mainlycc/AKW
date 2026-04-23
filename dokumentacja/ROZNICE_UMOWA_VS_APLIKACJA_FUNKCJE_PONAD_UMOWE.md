# Różnice: funkcje w aplikacji, których nie ma w umowie

Źródła porównania:
- Umowa: `aw/umowa.md` (25 linii – lista funkcjonalności high-level)
- Implementacja: kod w `aw/src/**` oraz migracje `aw/supabase/migrations/**`

Cel dokumentu:
- Wypunktować funkcje, które **występują w aplikacji**, a **nie są opisane wprost** w `aw/umowa.md` (czyli nie da się ich jednoznacznie przypisać do konkretnego punktu umowy).

---

## 1) Centralne zarządzanie stawkami (system settings) + domyślne stawki tutorów „z góry”

W aplikacji istnieje osobny panel admina do zarządzania stawkami oraz tabela `system_settings`, w której trzymane są domyślne stawki (w tym `default_tutor_rate`). Umowa tego nie opisuje wprost (w umowie są „rozliczenia” i „raporty”, ale nie ma modułu „stawki systemowe”).

Dowody w kodzie:
- UI: `aw/src/app/(dashboard)/dashboard/stawki/page.tsx`
- Server actions: `aw/src/app/(dashboard)/dashboard/stawki/actions.ts`
- Migracje DB:  
  - `aw/supabase/migrations/035_system_settings_rates.sql` (tabela `system_settings`, klucz `default_tutor_rate`)  
  - `aw/supabase/migrations/036_student_rate_levels.sql` (poziomy stawek ucznia + override)

---

## 2) Poziomy stawek ucznia (rate_level 1..3) + mechanika „stawka nadpisana”

W aplikacji jest koncept poziomów stawek (1/2/3), powiązany z uczniem (`students.rate_level`) oraz flaga `hourly_rate_is_overridden`. Umowa nie opisuje takiego mechanizmu per uczeń.

Dowody w bazie:
- `aw/supabase/migrations/036_student_rate_levels.sql`

---

## 3) System zaproszeń użytkowników (invitation flow)

W aplikacji jest moduł zaproszeń do systemu (admin wysyła zaproszenie, użytkownik akceptuje i powstaje konto). Umowa nie zawiera funkcjonalności „zapraszania do portalu”.

Dowody w kodzie:
- `aw/src/lib/actions/invitations.ts`
- Widok w menu admina: `/dashboard/zaproszenia` (por. `aw/src/components/app-sidebar.tsx`)

---

## 4) Rozliczenia wieloźródłowe: „z sesji” + „z raportów” + „z deklaracji” jako osobne moduły

W aplikacji istnieją co najmniej 3 ścieżki/ekrany rozliczeń:
- rozliczenia obliczane na podstawie sesji,
- rozliczenia obliczane na podstawie miesięcznych raportów tutorów,
- rozliczenia obliczane na podstawie miesięcznych deklaracji tutorów.

Umowa mówi o ewidencji godzin i rozliczeniach ogólnie, ale nie definiuje rozdzielenia na osobne moduły i osobne „źródła prawdy” (sesje vs raporty vs deklaracje).

Dowody w UI (menu admina):
- `aw/src/components/app-sidebar.tsx` (m.in. `billing-from-reports`, `deklaracje-tutorow`, `rozliczenia-deklaracji`)

Dowody w logice:
- `aw/src/lib/actions/billing.ts` (funkcje m.in. `getStudentBillingsFromReports`, `getStudentBillingsFromDeclarations`)

---

## 5) Miesięczne raporty tutorów z workflow (draft/submitted/approved/paid) + panel admina do zatwierdzania

W aplikacji jest osobny system raportów miesięcznych tutorów wraz z procesem zatwierdzania i statusami. Umowa nie opisuje obiegu dokumentów raportowych ani statusów „paid” w raportach (to rozszerzenie).

Dowody w UI:
- `aw/src/app/(dashboard)/dashboard/moje-raporty/**`
- `aw/src/app/(dashboard)/dashboard/raporty-tutorow/**`

---

## 6) Miesięczne deklaracje tutorów + obieg i rozliczanie deklaracji

W aplikacji jest osobny moduł „deklaracji” (równolegle do raportów), z panelami dla tutora i admina oraz rozliczeniami deklaracji. Umowa nie zawiera tego pojęcia ani procesu.

Dowody w UI:
- `aw/src/app/(dashboard)/dashboard/moje-deklaracje/**`
- `aw/src/app/(dashboard)/dashboard/deklaracje-tutorow/**`
- `aw/src/app/(dashboard)/dashboard/rozliczenia-deklaracji/**`

---

## 7) System powiadomień wewnątrz aplikacji (in-app notifications)

Oprócz powiadomień SMS/e-mail (wymienionych w umowie), aplikacja ma system powiadomień w panelu (lista, dzwonek, oznaczanie przeczytane). Umowa nie przewiduje „powiadomień w aplikacji” jako kanału.

Dowody w UI:
- `aw/src/components/notification-bell.tsx`
- `aw/src/app/(dashboard)/dashboard/powiadomienia/**`

---

## 8) Publiczne rezerwacje jako osobny „backoffice” proces (pending/confirmed/cancelled) + panel admina

Umowa mówi o rezerwacjach online, ale w aplikacji jest rozbudowany moduł obsługi zgłoszeń publicznych jako proces operacyjny (panel admina + statusy + dalsze akcje).

Dowody w UI:
- Public: `aw/src/app/public/rezerwacje/**`
- Admin: `aw/src/app/(dashboard)/dashboard/rezerwacje-publiczne/**`

---

## 9) Profil tutora + konfiguracja przedmiotów/poziomów nauczanych (kompetencje)

W aplikacji tutor ma własny profil i może (lub admin może) ustawić m.in. przedmioty/poziomy, które prowadzi. Umowa nie opisuje modułu profilu tutora.

Dowody w UI:
- `aw/src/app/(dashboard)/dashboard/profil/**`

---

## 10) Płatności „manualne” jako pełnoprawne metody obok online (gotówka/przelew)

Umowa mówi o integracji płatności online (Stripe/PayU) i automatycznym oznaczaniu, natomiast aplikacja ma także pełne wsparcie metod `transfer` i `cash` jako równorzędnych metod płatności (UI/filtry/eksport).

Dowody w logice:
- `aw/src/lib/actions/payments.ts` (typ `PaymentMethod = 'transfer' | 'cash' | 'online'`)

---

## Uwagi końcowe

- Ten dokument dotyczy **funkcji ponad umowę** (aplikacja ma więcej niż opis w `aw/umowa.md`).
- Osobny temat (nie tutaj) to „braki względem umowy” — częściowo opisane w `aw/dokumentacja/POROWNANIE_UMOWA_VS_IMPLEMENTACJA_21.11.2025.md`.

