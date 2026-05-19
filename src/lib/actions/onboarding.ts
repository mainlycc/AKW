'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser, getUserProfile } from '@/lib/actions/auth'
import type { OnboardingProgress } from '@/lib/tutorials/types'

export async function getOnboardingProgress(): Promise<OnboardingProgress> {
  const profile = await getUserProfile()
  if (!profile) {
    return { completed: false, skipped: false, step: 0 }
  }

  const row = profile as {
    onboarding_completed_at?: string | null
    onboarding_skipped_at?: string | null
    onboarding_step?: number | null
  }

  return {
    completed: Boolean(row.onboarding_completed_at),
    skipped: Boolean(row.onboarding_skipped_at),
    step: row.onboarding_step ?? 0,
  }
}

export async function saveOnboardingStep(step: number): Promise<void> {
  const user = await getUser()
  if (!user) return

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_step: step })
    .eq('id', user.id)

  if (error) {
    console.error('[saveOnboardingStep]', error)
  }
}

export async function completeOnboarding(finalStep: number): Promise<void> {
  const user = await getUser()
  if (!user) return

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed_at: new Date().toISOString(),
      onboarding_step: finalStep,
      onboarding_skipped_at: null,
    })
    .eq('id', user.id)

  if (error) {
    console.error('[completeOnboarding]', error)
    return
  }

  revalidatePath('/dashboard', 'layout')
}

export async function skipOnboarding(): Promise<void> {
  const user = await getUser()
  if (!user) return

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_skipped_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('[skipOnboarding]', error)
    return
  }

  revalidatePath('/dashboard', 'layout')
}

export async function resetOnboardingForRestart(): Promise<void> {
  const user = await getUser()
  if (!user) return

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_step: 0,
      onboarding_completed_at: null,
      onboarding_skipped_at: null,
    })
    .eq('id', user.id)

  if (error) {
    console.error('[resetOnboardingForRestart]', error)
    return
  }

  revalidatePath('/dashboard', 'layout')
}
