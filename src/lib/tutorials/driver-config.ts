import type { Config } from 'driver.js'

export const DRIVER_BASE_CONFIG: Partial<Config> = {
  animate: true,
  smoothScroll: false,
  allowClose: true,
  overlayOpacity: 0.55,
  stagePadding: 8,
  stageRadius: 8,
  popoverClass: 'aw-driver-popover',
  showButtons: ['previous', 'next', 'close'],
  nextBtnText: 'Dalej',
  prevBtnText: 'Wstecz',
  doneBtnText: 'Zakończ',
}
