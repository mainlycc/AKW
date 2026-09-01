import { AVAILABILITY_LABELS, availabilityReminderMessage } from '@/lib/labels/availability'

export interface AvailabilityReminderEmailData {
  tutorName: string
  appUrl?: string
  customMessage?: string
}

export function generateAvailabilityReminderEmail(data: AvailabilityReminderEmailData) {
  const { tutorName, appUrl = 'http://localhost:3000', customMessage } = data
  const mainMessage =
    (customMessage && customMessage.trim()) || availabilityReminderMessage()

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${AVAILABILITY_LABELS.reminderAvailabilityTitle} - Akademia Wiedzy</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Akademia Wiedzy</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">${AVAILABILITY_LABELS.reminderAvailabilityTitle}</h2>
    
    <p>Dzień dobry ${tutorName},</p>
    
    <p>${mainMessage}</p>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Prosimy o uzupełnienie grafiku dostępności w najbliższym możliwym terminie poprzez panel tutora w systemie.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}/dashboard/kalendarz" 
         style="background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Wypełnij grafik
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
