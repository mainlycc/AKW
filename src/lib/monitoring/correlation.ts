export type MonitoringMeta = {
  correlationId?: string
  route?: string
}

export const KALENDARZ_ROUTE = '/dashboard/kalendarz'

export function createCorrelationId(): string {
  return crypto.randomUUID()
}

export function resolveCorrelationId(meta?: MonitoringMeta): string {
  return meta?.correlationId ?? 'unknown'
}

export function resolveRoute(meta?: MonitoringMeta, fallback = KALENDARZ_ROUTE): string {
  return meta?.route ?? fallback
}
