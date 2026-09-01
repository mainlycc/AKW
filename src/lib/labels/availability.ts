export const AVAILABILITY_LABELS = {
  reminderAvailabilityTitle: 'Przypomnienie o wypełnieniu grafiku',
  reminderAvailabilityDialog: 'Wyślij przypomnienie o wypełnieniu grafiku',
  notificationAvailability: 'Grafik dostępności',
  sendAvailabilityReminderButton: 'Przypomnij o wypełnieniu grafiku',
} as const

export function availabilityReminderMessage(): string {
  return 'Przypominamy o wypełnieniu grafiku dostępności na bieżący tydzień.'
}

export function smsAvailabilityReminder(): string {
  return 'przypomnienie o wypełnieniu grafiku dostępności na bieżący tydzień. Prosimy o uzupełnienie w panelu tutora.'
}
