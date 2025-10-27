export function generateInvitationEmail(recipientName: string, invitationLink: string, expiryDays: number) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zaproszenie do Akademii Wiedzy</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Akademia Wiedzy</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Witaj w naszym zespole!</h2>
    
    <p>Zostałeś zaproszony do dołączenia do platformy <strong>Akademia Wiedzy</strong> jako tutor.</p>
    
    <p>Aby aktywować swoje konto, kliknij w poniższy przycisk:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${invitationLink}" 
         style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Aktywuj konto
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      Lub skopiuj i wklej poniższy link do przeglądarki:<br>
      <a href="${invitationLink}" style="color: #667eea; word-break: break-all;">${invitationLink}</a>
    </p>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
      <strong>⚠️ Ważne:</strong> Ten link jest ważny przez <strong>${expiryDays} dni</strong>.
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Jeśli nie spodziewałeś się tego zaproszenia, zignoruj tę wiadomość.
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Akademia Wiedzy. Wszelkie prawa zastrzeżone.</p>
  </div>
</body>
</html>
  `.trim()
}

