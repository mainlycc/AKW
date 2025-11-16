export interface BookingConfirmationEmailData {
  studentName: string
  tutorName: string
  subject: string
  level: string
  date: string // Format: "15 stycznia 2025"
  time: string // Format: "14:00-15:00"
  duration: number // w minutach
}

export function generateBookingConfirmationEmail(data: BookingConfirmationEmailData) {
  const { studentName, tutorName, subject, level, date, time, duration } = data
  const hours = duration / 60

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Potwierdzenie rezerwacji - Akademia Wiedzy</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Akademia Wiedzy</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Potwierdzenie rezerwacji</h2>
    
    <p>Dzień dobry,</p>
    
    <p>Dziękujemy za rezerwację terminu korepetycji. Oto szczegóły Twojej rezerwacji:</p>
    
    <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #667eea;">Uczeń:</td>
          <td style="padding: 8px 0;">${studentName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #667eea;">Tutor:</td>
          <td style="padding: 8px 0;">${tutorName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #667eea;">Przedmiot:</td>
          <td style="padding: 8px 0;">${subject}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #667eea;">Poziom:</td>
          <td style="padding: 8px 0;">${level}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #667eea;">Data:</td>
          <td style="padding: 8px 0;">${date}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #667eea;">Godzina:</td>
          <td style="padding: 8px 0;">${time}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #667eea;">Czas trwania:</td>
          <td style="padding: 8px 0;">${hours} ${hours === 1 ? 'godzina' : hours < 5 ? 'godziny' : 'godzin'}</td>
        </tr>
      </table>
    </div>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
      <strong>📋 Status:</strong> <span style="color: #856404;">Oczekuje na potwierdzenie</span>
      <p style="margin: 10px 0 0 0; font-size: 14px;">
        Twoja rezerwacja została przyjęta i oczekuje na potwierdzenie przez administratora. 
        Skontaktujemy się z Tobą wkrótce w celu potwierdzenia szczegółów.
      </p>
    </div>
    
    <p style="margin-top: 30px;">
      W razie pytań lub potrzeby zmiany terminu, prosimy o kontakt.
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

