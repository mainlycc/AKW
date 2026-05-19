export function formatPendingSessionsMessage(count: number): string {
  if (count === 1) {
    return 'Masz 1 przeszłą lekcję do potwierdzenia.'
  }
  if (count >= 2 && count <= 4) {
    return `Masz ${count} przeszłe lekcje do potwierdzenia.`
  }
  return `Masz ${count} przeszłych lekcji do potwierdzenia.`
}
