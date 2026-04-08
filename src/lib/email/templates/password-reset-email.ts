export function generatePasswordResetEmail(resetLink: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resetowanie hasła</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Akademia Wiedzy</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Resetowanie hasła</h2>

    <p>Otrzymaliśmy prośbę o zresetowanie hasła do konta w <strong>Akademii Wiedzy</strong>.</p>

    <p>Kliknij w przycisk poniżej, aby ustawić nowe hasło:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}"
         style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Ustaw nowe hasło
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">
      Jeśli przycisk nie działa, skopiuj link do przeglądarki:<br>
      <a href="${resetLink}" style="color: #667eea; word-break: break-all;">${resetLink}</a>
    </p>

    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
      <strong>Ważne:</strong> Link jest ważny krótko (zwykle do 1 godziny). Jeśli nie prosiłeś o reset, zignoruj tę wiadomość.
    </div>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Akademia Wiedzy. Wszelkie prawa zastrzeżone.</p>
  </div>
</body>
</html>
  `.trim()
}
