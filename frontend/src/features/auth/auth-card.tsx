import type { ReactNode } from "react"

type AuthCardProps = {
  title: string
  description: string
  footer: ReactNode
  children: ReactNode
}

// Moldura comum do login e do cadastro.
export function AuthCard({
  title,
  description,
  footer,
  children,
}: AuthCardProps) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 text-card-foreground">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </header>

        {children}

        <p className="text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </main>
  )
}
