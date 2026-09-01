import type { TutorialStep } from './types'
import { resolveStepPath, stepMatchesPath } from './tutorial-path'

function query(selector: string): Element | null {
  return document.querySelector(selector)
}

/** Elementy z layoutu (menu, dzwonek) — bez przeładowania strony. */
export function isLayoutTourSelector(selector: string): boolean {
  if (/\[data-tour="nav-/.test(selector)) return true
  if (selector.includes('[data-tour="notifications-bell"]')) return true
  if (selector.includes('[data-tour="help-button"]')) return true
  if (selector.includes('[data-tour="page-main"]')) return true
  return false
}

export function elementExists(selector: string): boolean {
  return query(selector) !== null
}

/** Otwiera zwiniętą grupę w sidebarze, jeśli cel touru jest w podmenu. */
export function revealNavTarget(selector: string): void {
  const el = query(selector)
  if (!el) return
  const closedRoot = el.closest('[data-state="closed"]')
  if (!closedRoot) return
  const trigger = closedRoot.querySelector<HTMLElement>('button')
  trigger?.click()
}

/**
 * Czeka na element w DOM — MutationObserver + krótki polling jako fallback.
 */
export function waitForElement(
  selector: string,
  timeoutMs = 2500
): Promise<Element | null> {
  const existing = query(selector)
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve) => {
    let settled = false

    const finish = (el: Element | null) => {
      if (settled) return
      settled = true
      observer.disconnect()
      clearInterval(pollId)
      clearTimeout(timeoutId)
      resolve(el)
    }

    const observer = new MutationObserver(() => {
      const el = query(selector)
      if (el) finish(el)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    const pollId = window.setInterval(() => {
      const el = query(selector)
      if (el) finish(el)
    }, 50)

    const timeoutId = window.setTimeout(() => {
      finish(query(selector))
    }, timeoutMs)
  })
}

export function waitForPath(pathname: string, timeoutMs = 4000): Promise<boolean> {
  if (window.location.pathname === pathname) return Promise.resolve(true)

  return new Promise((resolve) => {
    let settled = false

    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      observer.disconnect()
      clearInterval(pollId)
      clearTimeout(timeoutId)
      resolve(ok)
    }

    const check = () => window.location.pathname === pathname

    const observer = new MutationObserver(() => {
      if (check()) finish(true)
    })

    observer.observe(document.body, { childList: true, subtree: true })

    const pollId = window.setInterval(() => {
      if (check()) finish(true)
    }, 32)

    const timeoutId = window.setTimeout(() => {
      finish(check())
    }, timeoutMs)
  })
}

export function waitForStepPath(
  step: TutorialStep,
  demoTutorPath?: string | null,
  timeoutMs = 4000
): Promise<boolean> {
  const currentPath = window.location.pathname
  const resolvedPath = resolveStepPath(step, demoTutorPath, currentPath)
  if (stepMatchesPath(step, currentPath)) return Promise.resolve(true)

  return new Promise((resolve) => {
    let settled = false

    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      observer.disconnect()
      clearInterval(pollId)
      clearTimeout(timeoutId)
      resolve(ok)
    }

    const check = () =>
      stepMatchesPath(step, window.location.pathname) ||
      window.location.pathname === resolvedPath

    const observer = new MutationObserver(() => {
      if (check()) finish(true)
    })

    observer.observe(document.body, { childList: true, subtree: true })

    const pollId = window.setInterval(() => {
      if (check()) finish(true)
    }, 32)

    const timeoutId = window.setTimeout(() => {
      finish(check())
    }, timeoutMs)
  })
}
