export interface PaymentLinkEmailData {
  parentName: string
  studentName: string
  amount: number
  month: number
  year: number
  paymentUrl: string
}

const monthNames = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
]

export function generatePaymentLinkEmail(data: PaymentLinkEmailData) {
  const { parentName, studentName, amount, month, year, paymentUrl } = data
  const monthName = monthNames[month - 1] || `Miesiąc ${month}`
  const formattedAmount = amount.toFixed(2).replace('.', ',')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Płatność za korepetycje - Akademia Wiedzy</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Akademia Wiedzy</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Płatność za korepetycje</h2>
    
    <p>Dzień dobry ${parentName},</p>
    
    <p>Przesyłamy link do płatności za zajęcia dla ucznia <strong>${studentName}</strong> za okres <strong>${monthName} ${year}</strong>.</p>
    
    <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #667eea;">Szczegóły płatności:</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Okres:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${monthName} ${year}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; font-size: 16px; font-weight: bold; color: #667eea;">Kwota do zapłaty:</td>
          <td style="padding: 12px 0; text-align: right; font-size: 18px; font-weight: bold; color: #667eea;">${formattedAmount} zł</td>
        </tr>
      </table>
    </div>
    
    <p style="margin-top: 30px; text-align: center;">
      <a href="${paymentUrl}" 
         style="background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
        Przejdź do płatności
      </a>
    </p>
    
    <p style="color: #666; font-size: 14px; margin-top: 20px; text-align: center;">
      Lub skopiuj i wklej poniższy link do przeglądarki:<br>
      <a href="${paymentUrl}" style="color: #667eea; word-break: break-all; font-size: 12px;">${paymentUrl}</a>
    </p>
    
    <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
      <strong>ℹ️ Informacja:</strong> Płatność możesz dokonać za pomocą różnych metod płatności (BLIK, karta płatnicza, przelew online).
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
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

