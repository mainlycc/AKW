import Link from "next/link"

export function AppFooter() {
  return (
    <footer className="bg-background py-2 mt-auto">
      <div className="mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Akademia Wiedzy. </span>
          <Link 
            href="/dashboard/regulamin" 
            className="ml-1 underline-offset-4 hover:underline"
          >
            Regulamin
          </Link>
          <span className="mx-2">•</span>
          <Link 
            href="/dashboard/polityka-prywatnosci" 
            className="underline-offset-4 hover:underline"
          >
            Polityka Prywatności
          </Link>
        </div>
      </div>
    </footer>
  )
}

