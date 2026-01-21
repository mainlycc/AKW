import Link from "next/link"

export function AppFooter() {
  return (
    <footer className="border-t bg-background py-2">
      <div className="container mx-auto px-4">
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

