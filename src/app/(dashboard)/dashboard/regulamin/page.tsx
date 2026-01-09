import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function RegulaminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Regulamin Serwisu</h1>
        <p className="text-muted-foreground mt-2">
          Regulamin korzystania z platformy e-korepetycji Akademia Wiedzy
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Postanowienia ogólne</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Niniejszy regulamin określa zasady korzystania z serwisu e-korepetycji Akademia Wiedzy 
            (zwany dalej "Serwisem"), dostępnego pod adresem internetowym wskazanym przez administratora.
          </p>
          <p>
            Administratorem Serwisu jest podmiot prowadzący platformę Akademia Wiedzy.
          </p>
          <p>
            Korzystanie z Serwisu oznacza akceptację niniejszego regulaminu w całości.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Definicje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            <strong>Serwis</strong> - platforma internetowa umożliwiająca organizację i prowadzenie 
            korepetycji online oraz zarządzanie procesem nauczania.
          </p>
          <p>
            <strong>Użytkownik</strong> - osoba fizyczna korzystająca z Serwisu, w tym tutorzy, 
            uczniowie, rodzice oraz administratorzy.
          </p>
          <p>
            <strong>Tutor</strong> - osoba prowadząca zajęcia edukacyjne poprzez Serwis.
          </p>
          <p>
            <strong>Uczeń</strong> - osoba uczestnicząca w zajęciach edukacyjnych prowadzonych 
            przez tutora.
          </p>
          <p>
            <strong>Sesja</strong> - pojedyncza jednostka zajęć edukacyjnych prowadzona przez tutora 
            dla ucznia.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Zasady korzystania z Serwisu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Serwis przeznaczony jest wyłącznie do celów edukacyjnych i organizacji korepetycji.
          </p>
          <p>
            Użytkownik zobowiązuje się do korzystania z Serwisu w sposób zgodny z prawem, 
            dobrymi obyczajami oraz postanowieniami niniejszego regulaminu.
          </p>
          <p>
            Zabronione jest wykorzystywanie Serwisu do celów niezgodnych z jego przeznaczeniem, 
            w tym do działań naruszających prawa osób trzecich.
          </p>
          <p>
            Użytkownik zobowiązuje się do podawania prawdziwych i aktualnych danych osobowych 
            oraz informacji niezbędnych do korzystania z Serwisu.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Prawa i obowiązki użytkowników</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">4.1. Tutorzy</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Zobowiązani są do prowadzenia zajęć zgodnie z ustalonym harmonogramem</li>
              <li>Powinni przygotowywać się do zajęć i zapewniać odpowiednią jakość nauczania</li>
              <li>Zobowiązani są do prowadzenia dokumentacji zajęć zgodnie z wymogami Serwisu</li>
              <li>Mają prawo do wynagrodzenia zgodnie z ustalonymi zasadami rozliczeń</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">4.2. Uczniowie i rodzice</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Zobowiązani są do punktualnego uczestnictwa w zajęciach</li>
              <li>Powinni przygotowywać się do zajęć i aktywnie w nich uczestniczyć</li>
              <li>Zobowiązani są do przestrzegania zasad kultury i szacunku wobec tutorów</li>
              <li>Mają prawo do otrzymywania informacji o postępach w nauce</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Organizacja zajęć</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Zajęcia organizowane są zgodnie z harmonogramem ustalonym między tutorem a uczniem 
            (lub rodzicem).
          </p>
          <p>
            Odwołanie lub przełożenie zajęć powinno nastąpić z odpowiednim wyprzedzeniem, 
            zgodnie z zasadami określonymi w Serwisie.
          </p>
          <p>
            W przypadku nieobecności ucznia bez wcześniejszego powiadomienia, zajęcia mogą 
            zostać rozliczone zgodnie z zasadami określonymi w Serwisie.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6. Rozliczenia i płatności</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Rozliczenia za przeprowadzone zajęcia dokonywane są zgodnie z zasadami określonymi 
            w Serwisie i ustalonymi stawkami.
          </p>
          <p>
            Płatności powinny być dokonywane terminowo, zgodnie z ustalonym harmonogramem.
          </p>
          <p>
            Wszelkie rozbieżności dotyczące rozliczeń powinny być zgłaszane niezwłocznie 
            administratorowi Serwisu.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>7. Ochrona danych osobowych</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Administrator Serwisu przetwarza dane osobowe użytkowników zgodnie z obowiązującymi 
            przepisami prawa, w szczególności z Rozporządzeniem Ogólnym o Ochronie Danych (RODO).
          </p>
          <p>
            Szczegółowe informacje dotyczące przetwarzania danych osobowych zawarte są 
            w Polityce Prywatności dostępnej w Serwisie.
          </p>
          <p>
            Użytkownicy mają prawo do dostępu do swoich danych, ich poprawiania, usunięcia 
            oraz wniesienia sprzeciwu wobec przetwarzania danych.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>8. Odpowiedzialność</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Administrator Serwisu dokłada starań, aby Serwis działał prawidłowo, jednak nie 
            ponosi odpowiedzialności za ewentualne przerwy w działaniu Serwisu spowodowane 
            czynnikami niezależnymi od niego.
          </p>
          <p>
            Administrator nie ponosi odpowiedzialności za treści przekazywane przez użytkowników 
            podczas zajęć oraz za skutki wykorzystania informacji przekazywanych podczas zajęć.
          </p>
          <p>
            Użytkownicy ponoszą pełną odpowiedzialność za treści, które zamieszczają lub 
            przekazują za pośrednictwem Serwisu.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>9. Własność intelektualna</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Wszelkie materiały edukacyjne, treści i funkcjonalności Serwisu są chronione 
            prawem autorskim i stanowią własność administratora Serwisu lub podmiotów trzecich.
          </p>
          <p>
            Użytkownicy nie mają prawa do kopiowania, modyfikowania, rozpowszechniania 
            lub wykorzystywania w inny sposób materiałów dostępnych w Serwisie bez zgody 
            administratora.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>10. Postanowienia końcowe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Administrator zastrzega sobie prawo do wprowadzania zmian w regulaminie. 
            O zmianach użytkownicy będą informowani z odpowiednim wyprzedzeniem.
          </p>
          <p>
            W sprawach nieuregulowanych niniejszym regulaminem zastosowanie mają 
            przepisy prawa polskiego.
          </p>
          <p>
            W przypadku sporów, strony będą dążyć do ich polubownego rozwiązania. 
            W razie braku porozumienia, spory będą rozstrzygane przez właściwy sąd 
            zgodnie z przepisami prawa.
          </p>
          <p className="font-semibold mt-4">
            Regulamin wchodzi w życie z dniem publikacji w Serwisie.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

