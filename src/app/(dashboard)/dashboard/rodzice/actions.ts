'use server'

import { revalidatePath } from 'next/cache'
import { createParent, updateParent, deleteParent, type ParentType } from '@/lib/actions/parents'

export async function createParentAction(data: {
  first_name: string
  last_name: string
  email: string
  phone: string
  parent_type: ParentType
}) {
  await createParent(data)
  revalidatePath('/dashboard/rodzice')
}

export async function updateParentAction(
  parentId: string,
  data: {
    first_name: string
    last_name: string
    email: string
    phone: string
    parent_type: ParentType
  }
) {
  await updateParent(parentId, data)
  revalidatePath('/dashboard/rodzice')
}

export async function deleteParentAction(parentId: string) {
  await deleteParent(parentId)
  revalidatePath('/dashboard/rodzice')
}

