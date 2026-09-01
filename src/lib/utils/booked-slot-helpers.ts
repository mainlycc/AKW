export const SESSION_SLOT_ID_PREFIX = 'session:'

export function isSessionDisplaySlot(slotId: string): boolean {
  return slotId.startsWith(SESSION_SLOT_ID_PREFIX)
}

export function toSessionDisplaySlotId(sessionId: string): string {
  return `${SESSION_SLOT_ID_PREFIX}${sessionId}`
}
