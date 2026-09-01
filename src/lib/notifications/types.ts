export type NotificationType =
  | 'public_booking_created'
  | 'public_booking_confirmed'
  | 'public_booking_cancelled'
  | 'assignment_created'
  | 'assignment_status_changed'
  | 'report_submitted'
  | 'report_approved'
  | 'report_paid'
  | 'report_reminder'
  | 'declaration_reminder'
  | 'availability_reminder'
  | 'session_created'
  | 'session_confirmation_required'
  | 'support_incident'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  read_at: string | null
  metadata: Record<string, unknown>
  created_at: string
}
