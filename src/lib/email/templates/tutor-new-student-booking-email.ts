export interface TutorNewStudentBookingEmailData {
  tutorName: string
  studentName: string
  subject: string
  level: string
  date: string
  time: string
}

export function generateTutorNewStudentBookingEmail(data: TutorNewStudentBookingEmailData) {
  const { tutorName, studentName, subject, level, date, time } = data

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nowy uczeń zarezerwował lekcję - Akademia Wiedzy</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Akademia Wiedzy</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">📅 Nowy uczeń zarezerwował lekcję</h2>

    <p>Cześć <strong>${tutorName}</strong>,</p>

    <p>Nowy uczeń właśnie zarezerwował lekcję z Tobą.</p>

    <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0; font-weight: bold; color: #333;">Szczegóły lekcji</p>
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
          <td style="padding: 8px 0; font-weight: bold; color: #667eea;">Klasa:</td>
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
      </table>
    </div>

    <div style="background: #fff8e6; border-left: 4px solid #f0ad4e; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;">
        Jeśli uczeń nie kontaktuje się godzinę przed lekcją, zgłoś to w aplikacji lub mailem.
      </p>
    </div>

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
