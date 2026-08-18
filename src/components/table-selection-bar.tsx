'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconX } from '@tabler/icons-react'

const MAX_VISIBLE_CHIPS = 5

export interface TableSelectionItem {
  id: string
  label: string
}

interface TableSelectionBarProps {
  items: TableSelectionItem[]
  visibleIds: Set<string>
  onRemove: (id: string) => void
  onClearAll: () => void
}

export function TableSelectionBar({
  items,
  visibleIds,
  onRemove,
  onClearAll,
}: TableSelectionBarProps) {
  if (items.length === 0) return null

  const hiddenCount = items.filter((item) => !visibleIds.has(item.id)).length
  const visibleChips = items.slice(0, MAX_VISIBLE_CHIPS)
  const overflowCount = items.length - visibleChips.length

  return (
    <div className="rounded-lg border bg-muted/50 px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium shrink-0">
          Zaznaczono: {items.length}
        </span>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearAll}>
          Wyczyść wszystkie
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {visibleChips.map((item) => (
          <Badge
            key={item.id}
            variant="secondary"
            className="gap-1 pr-1 max-w-[200px]"
          >
            <span className="truncate">{item.label}</span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="rounded-sm hover:bg-muted p-0.5 shrink-0"
              aria-label={`Usuń ${item.label} z zaznaczenia`}
            >
              <IconX className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {overflowCount > 0 && (
          <Badge variant="outline" className="text-muted-foreground">
            +{overflowCount} więcej
          </Badge>
        )}
      </div>

      {hiddenCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {hiddenCount} poza wynikami wyszukiwania
        </p>
      )}
    </div>
  )
}
