export interface DeclarationReminderEmailData {
  tutorName: string
  month: number
  year: number
  appUrl?: string
  customMessage?: string
}

const monthNames = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
]

export function generateDeclarationReminderEmail(data: DeclarationReminderEmailData) {
  const { tutorName, month, year, appUrl = 'http://localhost:3000', customMessage } = data
  const monthName = monthNames[month - 1] || `Miesiąc ${month}`
  const mainMessage =
    (customMessage && customMessage.trim()) ||
    `Przypominamy o złożeniu deklaracji miesięcznej za okres ${monthName} ${year}.`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Przypomnienie o deklaracji miesięcznej - Akademia Wiedzy</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Akademia Wiedzy</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Przypomnienie o deklaracji miesięcznej</h2>
    
    <p>Dzień dobry ${tutorName},</p>
    
    <p>${mainMessage}</p>
    
    <div style="background: white; border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #0ea5e9;">Szczegóły:</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Okres:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${monthName} ${year}</td>
        </tr>
      </table>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Prosimy o złożenie deklaracji w najbliższym możliwym terminie poprzez panel tutora w systemie.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}/dashboard/moje-deklaracje" 
         style="background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Złóż deklarację
      </a>
    </div>
    
    <p style="margin-top: 20px; color: #666; font-size: 14px;">
      W razie pytań, prosimy o kontakt.
    </p>
    
    <p style="margin-top: 20px; color: #666; font-size: 14px;">
      Pozdrawiamy,<br>
      <strong>Zespół Akademii Wiedzy</strong>
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Akademia Wiedzy. Wszelkie prawa zastrzeżone.</p>
    <p>To jest automatyczna wiadomość, prosimy nie odpowiadać na ten email.</p>
  </div>
</body>
</html>
  `.trim()
}

