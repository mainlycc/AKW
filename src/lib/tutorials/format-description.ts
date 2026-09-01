/** Konwertuje proste formatowanie **pogrubienie** na HTML dla driver.js (innerHTML). */
export function formatTutorialDescription(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}
