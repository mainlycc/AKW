# Menu boczne administratora - Dokumentacja

## Opis menu bocznego

Menu boczne (sidebar) administratora znajduje się po lewej stronie ekranu i składa się z trzech głównych sekcji:

1. **Header (Góra menu)**
   - Logo i nazwa "Akademia Wiedzy" z ikoną szkoły
   - Link prowadzący do strony głównej dashboardu

2. **Content (Główna zawartość menu)**
   - Lista wszystkich dostępnych sekcji z ikonami i nazwami
   - Każda pozycja jest klikalna i prowadzi do odpowiedniej podstrony
   - Menu jest zwijane/rozwijane (collapsible) z możliwością wyświetlenia w trybie offcanvas

3. **Footer (Stopka menu)**
   - Informacje o zalogowanym użytkowniku (NavUser)
   - Wyświetla imię, email i rolę użytkownika

Menu jest responsywne i może być zwijane na mniejszych ekranach.

---

## Lista pozycji menu administratora

### 1. Dashboard
**URL:** `/dashboard`  
**Ikona:** Dashboard  
**Opis:** Strona główna wyświetlająca statystyki systemu: liczbę uczniów, tutorów, aktywnych przypisań oraz sesje w bieżącym miesiącu.

### 2. Uczniowie
**URL:** `/dashboard/uczniowie`  
**Ikona:** Users  
**Opis:** Zarządzanie listą wszystkich uczniów w systemie z możliwością dodawania, edycji, przeglądania szczegółów oraz przypisywania do tutorów i przedmiotów.

### 3. Rodzice
**URL:** `/dashboard/rodzice`  
**Ikona:** UsersGroup  
**Opis:** Zarządzanie danymi rodziców uczniów z możliwością dodawania, edycji i przeglądania informacji kontaktowych.

### 4. Tutorzy
**URL:** `/dashboard/tutorzy`  
**Ikona:** School  
**Opis:** Przeglądanie listy wszystkich tutorów wraz ze statystykami (aktywne przypisania, łączna liczba godzin, liczba sesji) oraz zarządzanie ich danymi i przedmiotami.

### 5. Zaproszenia
**URL:** `/dashboard/zaproszenia`  
**Ikona:** MailPlus  
**Opis:** Zarządzanie zaproszeniami wysyłanymi do nowych użytkowników (tutorów lub rodziców) z możliwością tworzenia, przeglądania i anulowania zaproszeń.

### 6. Dostępność tutorów
**URL:** `/dashboard/dostepnosc-tutorow`  
**Ikona:** CalendarCheck  
**Opis:** Przeglądanie i zarządzanie dostępnością wszystkich tutorów, w tym ich grafików i slotów czasowych.

### 7. Publiczne rezerwacje
**URL:** `/dashboard/rezerwacje-publiczne`  
**Ikona:** CalendarPlus  
**Opis:** Zarządzanie zgłoszeniami rezerwacji wysłanymi przez formularz publiczny z możliwością zatwierdzania, anulowania i tworzenia przypisań.

### 8. Przedmioty
**URL:** `/dashboard/przedmioty`  
**Ikona:** Book  
**Opis:** Zarządzanie przedmiotami nauczania oraz ich poziomami z możliwością ustawiania cen za godzinę dla każdego poziomu.

### 9. Przypisania
**URL:** `/dashboard/przypisania`  
**Ikona:** UserPlus  
**Opis:** Zarządzanie przypisaniami uczniów do tutorów z określeniem przedmiotu i poziomu, z możliwością aktywacji, dezaktywacji i edycji.

### 10. Sesje
**URL:** `/dashboard/sesje`  
**Ikona:** Calendar  
**Opis:** Zarządzanie wszystkimi sesjami korepetycji z możliwością dodawania, edycji, zmiany statusu oraz przeglądania historii lekcji.

### 11. Kalendarz lekcji
**URL:** `/dashboard/kalendarz-lekcji`  
**Ikona:** CalendarTime  
**Opis:** Widok kalendarzowy wszystkich zaplanowanych lekcji z możliwością filtrowania i przeglądania szczegółów sesji.

### 12. Raporty
**URL:** `/dashboard/raporty`  
**Ikona:** FileReport  
**Opis:** Generowanie i przeglądanie raportów z sesji korepetycji z możliwością filtrowania po tutorach, uczniach, przedmiotach i datach.

### 13. Raporty tutorów
**URL:** `/dashboard/raporty-tutorow`  
**Ikona:** ClockDollar  
**Opis:** Zarządzanie miesięcznymi raportami tutorów z możliwością przeglądania, zatwierdzania i obliczania wynagrodzeń na podstawie przepracowanych godzin.

### 14. Powiadomienia
**URL:** `/dashboard/powiadomienia`  
**Ikona:** Bell  
**Opis:** Przeglądanie wszystkich powiadomień systemowych z możliwością oznaczania jako przeczytane i filtrowania.

### 15. Rozliczenia
**URL:** `/dashboard/billing`  
**Ikona:** CreditCard  
**Opis:** Przeglądanie miesięcznych rozliczeń uczniów z możliwością wyboru okresu, przeglądania należności i dodawania płatności.

### 16. Historia płatności
**URL:** `/dashboard/payments`  
**Ikona:** History  
**Opis:** Przeglądanie historii wszystkich płatności z możliwością filtrowania po uczniach, edycji płatności i eksportu danych do pliku CSV.

---

## Uwagi techniczne

- Menu boczne jest komponentem `AppSidebar` znajdującym się w `aw/src/components/app-sidebar.tsx`
- Menu jest renderowane w layoutcie dashboardu (`aw/src/app/(dashboard)/layout.tsx`)
- Wszystkie pozycje menu są dostępne tylko dla użytkowników z rolą 'admin'
- Menu wykorzystuje komponenty shadcn/ui (Sidebar, SidebarContent, SidebarHeader, SidebarFooter)
- Ikony pochodzą z biblioteki @tabler/icons-react

