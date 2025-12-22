'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function approveDeclaration(declarationId: string, adminId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('monthly_declarations')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: adminId,
    })
    .eq('id', declarationId)

  if (error) throw error

  revalidatePath('/dashboard/deklaracje-tutorow')
}

