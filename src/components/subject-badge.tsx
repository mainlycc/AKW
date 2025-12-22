'use client'

import { Badge } from "@/components/ui/badge"
import { getSubjectColor } from "@/lib/utils"
import { Subject } from "@/lib/types/database.types"

interface SubjectBadgeProps {
  subject: Subject | { name: string; color?: string | null }
  className?: string
  variant?: "default" | "secondary" | "destructive" | "outline"
}

export function SubjectBadge({ subject, className, variant = "secondary" }: SubjectBadgeProps) {
  const color = getSubjectColor(subject)
  
  return (
    <Badge
      variant={variant}
      className={className}
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
        color: color,
      }}
    >
      {subject.name}
    </Badge>
  )
}

