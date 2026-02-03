export interface TutorGroupMessageEmailData {
  tutorName: string
  message: string
  headerImageUrl: string
}

export function generateTutorGroupMessageEmail(data: TutorGroupMessageEmailData) {
  const { tutorName, message, headerImageUrl } = data

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wiadomość z Akademii Wiedzy</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; border-radius: 10px 10px 0 0; overflow: hidden;">
    <img src="${headerImageUrl}" alt="Akademia Wiedzy" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; margin: 0 auto;" />
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <div style="background: white; border-left: 4px solid #667eea; padding: 20px; margin: 0; white-space: pre-wrap;">
      ${message.replace(/\n/g, '<br>')}
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

