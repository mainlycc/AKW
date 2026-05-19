# Uzupełnia zmienne Sentry w .env.local (interaktywnie).
# Uruchom: pwsh -File scripts/setup-sentry-env.ps1

$envPath = Join-Path $PSScriptRoot ".." ".env.local" | Resolve-Path
$content = Get-Content $envPath -Raw

function Set-EnvVar {
  param([string]$Name, [string]$Value)
  $pattern = "(?m)^$Name=.*$"
  $line = "$Name=$Value"
  if ($content -match $pattern) {
    $content = $content -replace $pattern, $line
  } else {
    $content += "`n$line"
  }
}

Write-Host "Konfiguracja Sentry dla Akademia Wiedzy"
Write-Host "Utwórz projekt Next.js na https://sentry.io (lub uruchom: npx @sentry/wizard@latest -i nextjs --saas -s)"
Write-Host ""

$dsn = Read-Host "Wklej DSN (Client Keys)"
$org = Read-Host "Org slug (np. twoja-organizacja)"
$project = Read-Host "Project slug [akademia-wiedzy]"
if ([string]::IsNullOrWhiteSpace($project)) { $project = "akademia-wiedzy" }
$token = Read-Host "Auth Token (opcjonalnie, do source maps na Vercel)"
$envName = Read-Host "SENTRY_ENVIRONMENT [development]"
if ([string]::IsNullOrWhiteSpace($envName)) { $envName = "development" }

Set-EnvVar "NEXT_PUBLIC_SENTRY_DSN" $dsn.Trim()
Set-EnvVar "SENTRY_DSN" $dsn.Trim()
Set-EnvVar "SENTRY_ORG" $org.Trim()
Set-EnvVar "SENTRY_PROJECT" $project.Trim()
if (-not [string]::IsNullOrWhiteSpace($token)) {
  Set-EnvVar "SENTRY_AUTH_TOKEN" $token.Trim()
}
Set-EnvVar "SENTRY_ENVIRONMENT" $envName.Trim()
Set-EnvVar "SENTRY_TRACES_SAMPLE_RATE" "1.0"

Set-Content -Path $envPath -Value $content.TrimEnd() -NoNewline
Add-Content -Path $envPath -Value "`n"

Write-Host ""
Write-Host "Zapisano do $envPath"
Write-Host "Dodaj te same zmienne w Vercel: Project Settings -> Environment Variables"
Write-Host "Alerty w Sentry: Alerts -> Create Alert -> Issues -> When: level is error"
