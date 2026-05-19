export interface PaymentReminderEmailData {
  parentName: string
  studentName: string
  month: number
  year: number
  totalDue: number
  totalPaid: number
  balance: number
  hours: number
  customMessage?: string
}

const monthNames = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
]

export function generatePaymentReminderEmail(data: PaymentReminderEmailData) {
  const { parentName, studentName, month, year, totalDue, totalPaid, balance, hours, customMessage } = data
  const monthName = monthNames[month - 1] || `Miesiąc ${month}`
  const formattedTotalDue = totalDue.toFixed(2).replace('.', ',')
  const formattedTotalPaid = totalPaid.toFixed(2).replace('.', ',')
  const formattedBalance = balance.toFixed(2).replace('.', ',')
  const customBlock =
    customMessage && customMessage.trim()
      ? `
    <div style="background: white; border-left: 4px solid #667eea; padding: 16px; margin: 16px 0; white-space: pre-wrap;">
      ${customMessage.replace(/\\n/g, '<br>')}
    </div>
      `.trim()
      : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Przypomnienie o płatności - Akademia Wiedzy</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Akademia Wiedzy</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Przypomnienie o płatności</h2>
    
    <p>Dzień dobry ${parentName},</p>
    
    <p>Przypominamy o zaległej płatności za zajęcia dla ucznia <strong>${studentName}</strong> za okres <strong>${monthName} ${year}</strong>.</p>
    ${customBlock}
    
    <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #667eea;">Szczegóły rozliczenia:</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Okres:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${monthName} ${year}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Liczba godzin:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${hours}h</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Należność:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${formattedTotalDue} zł</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Opłacone:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${formattedTotalPaid} zł</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; font-size: 16px; font-weight: bold; color: #d32f2f;">Do zapłaty:</td>
          <td style="padding: 12px 0; text-align: right; font-size: 16px; font-weight: bold; color: #d32f2f;">${formattedBalance} zł</td>
        </tr>
      </table>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Prosimy o dokonanie płatności w najbliższym możliwym terminie.
    </p>
    
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

