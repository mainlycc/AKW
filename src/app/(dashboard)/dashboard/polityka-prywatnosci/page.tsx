import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PolitykaPrywatnosciPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Polityka Prywatności</h1>
        <p className="text-muted-foreground mt-2">
          Polityka prywatności i ochrony danych osobowych platformy Akademia Wiedzy
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Postanowienia ogólne</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Niniejsza Polityka Prywatności określa zasady przetwarzania i ochrony danych osobowych 
            użytkowników platformy e-korepetycji Akademia Wiedzy (zwanej dalej "Platformą").
          </p>
          <p>
            Administratorem danych osobowych jest podmiot prowadzący platformę Akademia Wiedzy.
          </p>
          <p>
            Korzystanie z Platformy oznacza akceptację niniejszej Polityki Prywatności w całości.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Administrator danych osobowych</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Administratorem danych osobowych przetwarzanych w związku z korzystaniem z Platformy 
            jest podmiot prowadzący platformę Akademia Wiedzy.
          </p>
          <p>
            W sprawach dotyczących przetwarzania danych osobowych można kontaktować się z administratorem 
            za pośrednictwem adresu e-mail wskazanego w Serwisie.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Podstawa prawna przetwarzania danych</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Dane osobowe przetwarzane są na podstawie:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Zgody użytkownika (art. 6 ust. 1 lit. a RODO)</li>
            <li>Wykonania umowy o świadczenie usług (art. 6 ust. 1 lit. b RODO)</li>
            <li>Prawnie uzasadnionego interesu administratora (art. 6 ust. 1 lit. f RODO)</li>
            <li>Obowiązku prawnego ciążącego na administratorze (art. 6 ust. 1 lit. c RODO)</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Zakres przetwarzanych danych</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">4.1. Dane użytkowników</h4>
            <p>
              W związku z korzystaniem z Platformy przetwarzane są następujące dane osobowe:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Imię i nazwisko</li>
              <li>Adres e-mail</li>
              <li>Numer telefonu (opcjonalnie)</li>
              <li>Dane dotyczące korzystania z Platformy (logi, historia aktywności)</li>
              <li>Dane dotyczące płatności i rozliczeń</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">4.2. Dane uczniów</h4>
            <p>
              W przypadku uczniów, dodatkowo przetwarzane mogą być:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Informacje o postępach w nauce</li>
              <li>Dane dotyczące uczestnictwa w zajęciach</li>
              <li>Informacje przekazywane przez rodziców lub opiekunów prawnych</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Cele przetwarzania danych</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Dane osobowe przetwarzane są w następujących celach:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Świadczenie usług edukacyjnych poprzez Platformę</li>
            <li>Organizacja i prowadzenie zajęć korepetycyjnych</li>
            <li>Komunikacja z użytkownikami Platformy</li>
            <li>Rozliczenia finansowe i obsługa płatności</li>
            <li>Wypełnienie obowiązków prawnych ciążących na administratorze</li>
            <li>Zapewnienie bezpieczeństwa Platformy i zapobieganie nadużyciom</li>
            <li>Prowadzenie statystyk i analiz dotyczących korzystania z Platformy</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6. Okres przechowywania danych</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Dane osobowe przechowywane są przez okres niezbędny do realizacji celów, dla których 
            zostały zebrane, a następnie przez okres wymagany przepisami prawa (np. przepisy 
            podatkowe, przepisy dotyczące prowadzenia dokumentacji).
          </p>
          <p>
            Po upływie okresu przechowywania dane są usuwane lub anonimizowane w sposób uniemożliwiający 
            identyfikację osoby, której dane dotyczą.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>7. Prawa użytkowników</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Użytkownicy mają następujące prawa w zakresie przetwarzania danych osobowych:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><strong>Prawo dostępu</strong> - prawo do uzyskania informacji o przetwarzaniu swoich danych</li>
            <li><strong>Prawo do sprostowania</strong> - prawo do żądania poprawienia nieprawidłowych danych</li>
            <li><strong>Prawo do usunięcia</strong> - prawo do żądania usunięcia danych ("prawo do bycia zapomnianym")</li>
            <li><strong>Prawo do ograniczenia przetwarzania</strong> - prawo do żądania ograniczenia przetwarzania danych</li>
            <li><strong>Prawo do przenoszenia danych</strong> - prawo do otrzymania danych w ustrukturyzowanym formacie</li>
            <li><strong>Prawo sprzeciwu</strong> - prawo do wniesienia sprzeciwu wobec przetwarzania danych</li>
            <li><strong>Prawo do cofnięcia zgody</strong> - prawo do cofnięcia zgody na przetwarzanie danych</li>
            <li><strong>Prawo do wniesienia skargi</strong> - prawo do wniesienia skargi do organu nadzorczego (UODO)</li>
          </ul>
          <p>
            Aby skorzystać z powyższych praw, należy skontaktować się z administratorem danych 
            za pośrednictwem adresu e-mail wskazanego w Serwisie.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>8. Udostępnianie danych osobowych</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Dane osobowe mogą być udostępniane następującym kategoriom odbiorców:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Dostawcom usług IT i hostingowych wspierającym działanie Platformy</li>
            <li>Dostawcom usług płatniczych i rozliczeniowych</li>
            <li>Organom państwowym w zakresie wymaganym przepisami prawa</li>
            <li>Tutorom prowadzącym zajęcia - w zakresie niezbędnym do realizacji zajęć</li>
          </ul>
          <p>
            Dane osobowe nie są przekazywane do państw trzecich ani organizacji międzynarodowych, 
            chyba że jest to wymagane przepisami prawa lub niezbędne do realizacji usług.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>9. Pliki cookies i technologie śledzące</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Platforma wykorzystuje pliki cookies i podobne technologie w celu zapewnienia prawidłowego 
            działania serwisu, analizy korzystania z Platformy oraz personalizacji doświadczeń użytkowników.
          </p>
          <p>
            Użytkownicy mogą zarządzać ustawieniami cookies za pomocą ustawień przeglądarki internetowej. 
            Wyłączenie cookies może wpłynąć na funkcjonalność Platformy.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>10. Bezpieczeństwo danych</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Administrator dokłada wszelkich starań, aby zapewnić odpowiedni poziom bezpieczeństwa 
            przetwarzanych danych osobowych, w tym stosuje środki techniczne i organizacyjne 
            zapobiegające nieuprawnionemu dostępowi, utracie, zniszczeniu lub zmianie danych.
          </p>
          <p>
            Platforma wykorzystuje szyfrowanie połączeń (HTTPS) oraz inne nowoczesne rozwiązania 
            bezpieczeństwa informatycznego.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>11. Zmiany w Polityce Prywatności</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Administrator zastrzega sobie prawo do wprowadzania zmian w niniejszej Polityce Prywatności. 
            O istotnych zmianach użytkownicy będą informowani z odpowiednim wyprzedzeniem, 
            w szczególności poprzez wiadomość e-mail lub komunikat wyświetlany w Platformie.
          </p>
          <p>
            Aktualna wersja Polityki Prywatności jest zawsze dostępna w Platformie.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>12. Postanowienia końcowe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            W sprawach nieuregulowanych niniejszą Polityką Prywatności zastosowanie mają 
            przepisy prawa polskiego, w szczególności Rozporządzenie Ogólne o Ochronie Danych (RODO) 
            oraz ustawa o ochronie danych osobowych.
          </p>
          <p className="font-semibold mt-4">
            Polityka Prywatności wchodzi w życie z dniem publikacji w Platformie.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
