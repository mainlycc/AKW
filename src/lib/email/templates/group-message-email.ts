export interface GroupMessageEmailData {
  parentName: string
  studentNames: string[]
  message: string
}

export function generateGroupMessageEmail(data: GroupMessageEmailData) {
  const { parentName, studentNames, message } = data
  const studentsList = studentNames.map(name => `<li>${name}</li>`).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wiadomość grupowa - Akademia Wiedzy</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Akademia Wiedzy</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Wiadomość grupowa</h2>
    
    <p>Dzień dobry ${parentName},</p>
    
    <p>Otrzymujesz tę wiadomość w sprawie ${studentNames.length === 1 ? 'ucznia' : 'uczniów'}:</p>
    
    <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <ul style="margin: 0; padding-left: 20px;">
        ${studentsList}
      </ul>
    </div>
    
    <div style="background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; white-space: pre-wrap;">
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

