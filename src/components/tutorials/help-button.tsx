'use client'

import { IconHelp } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { useTutorialOptional } from '@/components/tutorials/tutorial-provider'

export function HelpButton() {
  const tutorial = useTutorialOptional()

  if (!tutorial) return null

  const { isRunning, startTour } = tutorial

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 px-2.5"
      data-tour="help-button"
      disabled={isRunning}
      onClick={() => void startTour({ restart: true })}
    >
      <IconHelp className="size-4" />
      <span className="hidden sm:inline">Pomoc</span>
    </Button>
  )
}
