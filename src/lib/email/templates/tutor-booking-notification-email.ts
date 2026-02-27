export interface TutorBookingNotificationEmailData {
  tutorName: string
  studentName: string
  subject: string
  level: string
  date: string // Format: "15 stycznia 2025"
  time: string // Format: "14:00-15:00"
  duration: number // w minutach
  contactEmail: string
  contactPhone?: string | null
  notes?: string | null
}

export function generateTutorBookingNotificationEmail(data: TutorBookingNotificationEmailData) {
  const { tutorName, studentName, subject, level, date, time, duration, contactEmail, contactPhone, notes } = data
  const hours = duration / 60

  const phoneRow = contactPhone
    ? `<tr>
          <td style="padding: 8px 0; font-weight: bold; color: #667eea;">Telefon kontaktowy:</td>
          <td style="padding: 8px 0;">${contactPhone}</td>
        </tr>`
    : ''

  const notesSection = notes
    ? `<div style="background: #f0f4ff; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">
        <strong>📝 Uwagi od klienta:</strong>
        <p style="margin: 10px 0 0 0; font-size: 14px;">${notes}</p>
      </div>`
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nowa rezerwacja - Akademia Wiedzy</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Akademia Wiedzy</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">📅 Nowa rezerwacja lekcji</h2>
    
    <p>Cześć <strong>${tutorName}</strong>,</p>
    
    <p>Masz nową rezerwację lekcji! Ktoś właśnie zarezerwował z Tobą termin korepetycji. Oto szczegóły:</p>
    
    <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #667eea;">Uczeń:</td>
          <td style="padding: 8px 0;">${studentName}</td>
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
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #667eea;">Email kontaktowy:</td>
          <td style="padding: 8px 0;">${contactEmail}</td>
        </tr>
        ${phoneRow}
      </table>
    </div>

    ${notesSection}
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
      <strong>⏳ Status:</strong> <span style="color: #856404;">Oczekuje na płatność</span>
      <p style="margin: 10px 0 0 0; font-size: 14px;">
        Rezerwacja została utworzona i oczekuje na płatność ze strony klienta. Po dokonaniu płatności rezerwacja zostanie automatycznie potwierdzona.
      </p>
    </div>
    
    <p style="margin-top: 20px;">
      Szczegóły rezerwacji znajdziesz również w swoim panelu w zakładce <strong>Rezerwacje publiczne</strong>.
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
