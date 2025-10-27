'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TutorInvitation } from '@/lib/types/database.types'
import { sendInvitationEmail } from '@/lib/email/send'

interface CreateInvitationResult {
  success: boolean
  error?: string
  invitation?: TutorInvitation
}

interface ValidateTokenResult {
  valid: boolean
  email?: string
  error?: string
}

interface RegisterResult {
  success: boolean
  error?: string
}

/**
 * Tworzy nowe zaproszenie dla tutora
 */
export async function createInvitation(email: string): Promise<CreateInvitationResult> {
  const supabase = await createClient()
  
  // Sprawdź czy użytkownik jest adminem
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Nie jesteś zalogowany' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { success: false, error: 'Brak uprawnień' }
  }

  // Sprawdź czy email już nie istnieje w systemie
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingUser) {
    return { success: false, error: 'Użytkownik z tym adresem email już istnieje' }
  }

  // Sprawdź czy istnieje aktywne zaproszenie dla tego emaila
  const { data: existingInvitation } = await supabase
    .from('tutor_invitations')
    .select('*')
    .eq('email', email)
    .eq('status', 'pending')
    .single()

  if (existingInvitation) {
    return { success: false, error: 'Aktywne zaproszenie dla tego emaila już istnieje' }
  }

  // Ustaw datę wygaśnięcia na 7 dni od teraz
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  // Utwórz zaproszenie
  const { data: invitation, error } = await supabase
    .from('tutor_invitations')
    .insert({
      email,
      created_by: user.id,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating invitation:', error)
    return { success: false, error: 'Nie udało się utworzyć zaproszenia' }
  }

  // Wyślij email z zaproszeniem
  // W produkcji użyj VERCEL_URL jeśli to produkcja (production branch), inaczej NEXT_PUBLIC_APP_URL
  let baseUrl = 'http://localhost:3000'
  
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_URL) {
    // Produkcja na Vercel - użyj VERCEL_URL
    baseUrl = `https://${process.env.VERCEL_URL}`
  } else if (process.env.NEXT_PUBLIC_APP_URL) {
    // Development lub custom domain
    baseUrl = process.env.NEXT_PUBLIC_APP_URL
  }
  
  const invitationLink = `${baseUrl}/register?token=${invitation.token}`
  
  const emailResult = await sendInvitationEmail({
    to: email,
    invitationLink,
    expiryDays: 7,
  })

  if (!emailResult.success) {
    console.error('Failed to send invitation email:', emailResult.error)
    // Kontynuujemy - zaproszenie jest już utworzone, użytkownik może skopiować link ręcznie
    // W przyszłości można dodać opcję ponownego wysłania emaila
  } else {
    console.log('Invitation email sent successfully to:', email)
  }

  revalidatePath('/dashboard/zaproszenia')
  return { success: true, invitation: invitation as TutorInvitation }
}

/**
 * Pobiera listę wszystkich zaproszeń (tylko dla adminów)
 */
export async function getInvitations(): Promise<TutorInvitation[]> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return []

  // Najpierw wygaś stare zaproszenia
  await supabase.rpc('expire_old_invitations')

  const { data: invitations } = await supabase
    .from('tutor_invitations')
    .select('*')
    .order('created_at', { ascending: false })

  return (invitations as TutorInvitation[]) || []
}

/**
 * Waliduje token zaproszenia
 */
export async function validateInvitationToken(token: string): Promise<ValidateTokenResult> {
  const supabase = await createClient()

  const { data: invitation, error } = await supabase
    .from('tutor_invitations')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !invitation) {
    return { valid: false, error: 'Nieprawidłowy token zaproszenia' }
  }

  if (invitation.status !== 'pending') {
    return { valid: false, error: 'To zaproszenie zostało już wykorzystane lub wygasło' }
  }

  const now = new Date()
  const expiresAt = new Date(invitation.expires_at)
  
  if (now > expiresAt) {
    // Aktualizuj status na expired
    await supabase
      .from('tutor_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id)

    return { valid: false, error: 'To zaproszenie wygasło' }
  }

  return { valid: true, email: invitation.email }
}

/**
 * Rejestruje tutora za pomocą tokenu zaproszenia
 */
export async function registerWithInvitation(
  token: string,
  fullName: string,
  password: string
): Promise<RegisterResult> {
  const supabase = await createClient()

  // Waliduj token
  const validation = await validateInvitationToken(token)
  if (!validation.valid || !validation.email) {
    return { success: false, error: validation.error }
  }

  // Pobierz zaproszenie
  const { data: invitation } = await supabase
    .from('tutor_invitations')
    .select('*')
    .eq('token', token)
    .single()

  if (!invitation) {
    return { success: false, error: 'Nie znaleziono zaproszenia' }
  }

  // Utwórz użytkownika w Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: validation.email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: 'tutor',
      },
    },
  })

  if (authError) {
    console.error('Auth error:', authError)
    return { success: false, error: authError.message }
  }

  if (!authData.user) {
    return { success: false, error: 'Nie udało się utworzyć konta' }
  }

  // Aktualizuj status zaproszenia
  const { error: updateError } = await supabase
    .from('tutor_invitations')
    .update({ status: 'accepted' })
    .eq('id', invitation.id)

  if (updateError) {
    console.error('Error updating invitation:', updateError)
  }

  return { success: true }
}

/**
 * Anuluje zaproszenie (zmienia status na expired)
 */
export async function cancelInvitation(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  // Sprawdź czy użytkownik jest adminem
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Nie jesteś zalogowany' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { success: false, error: 'Brak uprawnień' }
  }

  const { error } = await supabase
    .from('tutor_invitations')
    .update({ status: 'expired' })
    .eq('id', id)

  if (error) {
    console.error('Error canceling invitation:', error)
    return { success: false, error: 'Nie udało się anulować zaproszenia' }
  }

  revalidatePath('/dashboard/zaproszenia')
  return { success: true }
}

