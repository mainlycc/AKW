/**
 * Seed a few disposable tutors for delete-flow testing.
 *
 * Usage (from aw/):
 *   node --env-file=.env.local scripts/seed-test-tutors.mjs
 *   node --env-file=.env.local scripts/seed-test-tutors.mjs --count=5
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY (.env.local).')
  process.exit(1)
}

const countArg = process.argv.find((a) => a.startsWith('--count='))
const count = Math.min(20, Math.max(1, Number(countArg?.split('=')[1] || 3)))

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const stamp = Date.now()
const password = 'TestDelete123!'

const created = []

for (let i = 1; i <= count; i++) {
  const email = `test.delete.${stamp}.${i}@example.com`
  const fullName = `TEST Delete Tutor ${i}`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'tutor',
    },
  })

  if (error || !data.user) {
    console.error(`✕ ${email}: ${error?.message ?? 'brak usera'}`)
    continue
  }

  // Upewnij się, że profil ma rolę tutor (trigger zwykle to robi)
  const { error: profileError } = await admin
    .from('profiles')
    .upsert(
      {
        id: data.user.id,
        email,
        full_name: fullName,
        role: 'tutor',
        public_booking_enabled: false,
        bio: 'Konto testowe do usuwania — można skasować z panelu.',
      },
      { onConflict: 'id' }
    )

  if (profileError) {
    console.error(`⚠ auth OK, profil: ${profileError.message} (${email})`)
  }

  created.push({ id: data.user.id, email, fullName })
  console.log(`✓ ${fullName}  ${email}  ${data.user.id}`)
}

console.log('')
console.log(`Utworzono ${created.length}/${count} tutorów testowych.`)
console.log(`Hasło do wszystkich: ${password}`)
console.log('Usuń ich z /dashboard/tutorzy (zaznacz → Usuń zaznaczone).')
