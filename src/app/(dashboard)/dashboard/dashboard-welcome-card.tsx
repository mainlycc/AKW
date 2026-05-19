import { Card } from "@/components/ui/card"

type DashboardWelcomeCardProps = {
  description: string
}

export function DashboardWelcomeCard({ description }: DashboardWelcomeCardProps) {
  return (
    <Card className="relative overflow-hidden border bg-card/80 py-0 shadow-sm">
      <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <div className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Witamy w systemie Akademia Wiedzy
          </div>
          <div className="mt-2 text-sm text-muted-foreground sm:text-[15px]">
            System zarządzania e-korepetycjami
          </div>
          <div className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </div>
        </div>

        <div className="relative hidden md:block">
          <div className="absolute inset-0 bg-muted/40" />
          <div className="absolute inset-0 opacity-[0.35]">
            <svg
              className="h-full w-full"
              viewBox="0 0 800 420"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <pattern id="awGrid" width="44" height="44" patternUnits="userSpaceOnUse">
                  <path
                    d="M0 44V0H44"
                    fill="none"
                    stroke="#94a3b8"
                    strokeOpacity="0.35"
                    strokeWidth="1"
                  />
                  <circle cx="22" cy="22" r="2.2" fill="#64748b" fillOpacity="0.35" />
                </pattern>
                <filter id="awSoft" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation="10" />
                </filter>
              </defs>

              <rect width="800" height="420" fill="url(#awGrid)" />
              <path
                d="M520 60c120 12 178 88 214 158 38 74 12 140-62 174-90 42-190 30-276-22-92-56-116-158-74-234 40-72 112-88 198-76z"
                fill="#60a5fa"
                fillOpacity="0.22"
                filter="url(#awSoft)"
              />
              <path
                d="M610 250c88-20 142 4 170 44 30 44 18 90-36 116-62 30-142 22-204-10-66-34-90-90-62-132 26-38 78-48 132-18z"
                fill="#22c55e"
                fillOpacity="0.14"
                filter="url(#awSoft)"
              />
            </svg>
          </div>
        </div>
      </div>
    </Card>
  )
}
