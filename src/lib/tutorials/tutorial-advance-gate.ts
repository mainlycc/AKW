import type { TutorialStep } from './types'
import { canAdvanceFromStep } from './tutorial-path'

type PopoverLike = {
  footerButtons: HTMLElement
  description: HTMLElement
}

export function setupAdvanceGate(
  popover: PopoverLike,
  step: TutorialStep,
  onAdvanceAllowed?: () => void
): () => void {
  if (!step.advanceRequires) return () => {}

  const nextBtn = popover.footerButtons.querySelector('.driver-popover-next-btn')
  if (!(nextBtn instanceof HTMLButtonElement)) return () => {}

  let wasAllowed = canAdvanceFromStep(step, window.location.pathname)
  let advanceTriggered = false

  let hintEl: HTMLElement | null = null
  if (step.advanceHint) {
    hintEl = document.createElement('p')
    hintEl.className = 'text-xs text-amber-600 dark:text-amber-500 mt-2'
    hintEl.textContent = step.advanceHint
    popover.description.appendChild(hintEl)
  }

  const updateBtn = () => {
    const allowed = canAdvanceFromStep(step, window.location.pathname)
    nextBtn.disabled = !allowed
    nextBtn.setAttribute('aria-disabled', allowed ? 'false' : 'true')
    nextBtn.style.opacity = allowed ? '' : '0.45'
    nextBtn.style.pointerEvents = allowed ? '' : 'none'
    if (hintEl) {
      hintEl.style.display = allowed ? 'none' : ''
    }

    if (!wasAllowed && allowed && onAdvanceAllowed && !advanceTriggered) {
      advanceTriggered = true
      onAdvanceAllowed()
    }
    wasAllowed = allowed
  }

  updateBtn()
  const intervalId = window.setInterval(updateBtn, 150)

  return () => {
    clearInterval(intervalId)
    nextBtn.disabled = false
    nextBtn.style.opacity = ''
    nextBtn.style.pointerEvents = ''
    nextBtn.setAttribute('aria-disabled', 'false')
    hintEl?.remove()
  }
}
