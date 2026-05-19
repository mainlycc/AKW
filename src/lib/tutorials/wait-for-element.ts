export async function waitForElement(
  selector: string,
  maxAttempts = 12,
  delayMs = 300
): Promise<Element | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const element = document.querySelector(selector)
    if (element) return element
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return document.querySelector(selector)
}

export async function waitForPath(pathname: string, maxAttempts = 20, delayMs = 100): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (window.location.pathname === pathname) return true
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return window.location.pathname === pathname
}
