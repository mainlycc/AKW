'use client'

import { IconBook, IconList, IconRoute } from '@tabler/icons-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getGuidedTourModuleCount,
  getTutorialModulesForRole,
} from '@/lib/tutorials/get-tutorial-modules'
import type { TutorialModule } from '@/lib/tutorials/types'

type TutorialModulePickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectFullTour: () => void
  onSelectModule: (module: TutorialModule) => void
}

export function TutorialModulePicker({
  open,
  onOpenChange,
  onSelectFullTour,
  onSelectModule,
}: TutorialModulePickerProps) {
  const allModules = getTutorialModulesForRole('admin')
  const guidedCount = getGuidedTourModuleCount('admin')
  const overviewModules = allModules.filter((m) => m.index !== undefined)
  const guidedModules = allModules.filter((m) => m.moduleKey)

  const handleFullTour = () => {
    onOpenChange(false)
    onSelectFullTour()
  }

  const handleModule = (module: TutorialModule) => {
    onOpenChange(false)
    onSelectModule(module)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Samouczek administratora</DialogTitle>
          <DialogDescription>
            Wybierz moduł do przejścia albo uruchom pełny tour od początku.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleFullTour}
            className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60"
          >
            <IconList className="size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Pełny samouczek</p>
              <p className="text-muted-foreground text-sm">
                Wszystkie {overviewModules.length} modułów, od początku
              </p>
            </div>
          </button>

          {guidedCount > 0 ? (
            <div className="border-t pt-2">
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Poradniki krok po kroku
              </p>
              <ul className="flex flex-col gap-1">
                {guidedModules.map((module) => (
                  <li key={module.moduleKey}>
                    <button
                      type="button"
                      onClick={() => handleModule(module)}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                    >
                      <IconRoute className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{module.title}</span>
                        {module.stepCount ? (
                          <span className="text-muted-foreground text-xs">
                            {module.stepCount} kroków
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="border-t pt-2">
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Pojedynczy moduł
            </p>
            <ul className="max-h-[min(40vh,280px)] overflow-y-auto flex flex-col gap-1 pr-1">
              {overviewModules.map((module) => (
                <li key={module.index}>
                  <button
                    type="button"
                    onClick={() => handleModule(module)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                  >
                    <IconBook className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate">{module.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
