'use client'

import * as React from 'react'
import { IconHelp } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { TutorialModulePicker } from '@/components/tutorials/tutorial-module-picker'
import { useTutorialOptional } from '@/components/tutorials/tutorial-provider'
import type { TutorialModule } from '@/lib/tutorials/types'

export function HelpButton() {
  const tutorial = useTutorialOptional()
  const [pickerOpen, setPickerOpen] = React.useState(false)

  if (!tutorial) return null

  const { isRunning, role, startTour } = tutorial
  const isAdmin = role === 'admin'

  const handleClick = () => {
    if (isAdmin) {
      setPickerOpen(true)
      return
    }
    void startTour({ restart: true })
  }

  const handleSelectModule = (module: TutorialModule) => {
    if (module.moduleKey) {
      void startTour({ guidedTourKey: module.moduleKey })
      return
    }
    if (module.index !== undefined) {
      void startTour({ fromStep: module.index, singleModule: true })
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 px-2.5"
        data-tour="help-button"
        disabled={isRunning}
        onClick={handleClick}
      >
        <IconHelp className="size-4" />
        <span className="hidden sm:inline">Samouczek</span>
      </Button>

      {isAdmin ? (
        <TutorialModulePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelectFullTour={() => void startTour({ restart: true })}
          onSelectModule={handleSelectModule}
        />
      ) : null}
    </>
  )
}
