import { Navigate, Outlet, useLocation, type Path } from "react-router"

import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/features/auth/use-current-user"
import type { Role } from "@/features/auth/types"
import { ForbiddenPage } from "@/pages/forbidden-page"

function Loading() {
  return (
    <div
      role="status"
      className="flex min-h-svh items-center justify-center text-muted-foreground"
    >
      Carregando…
    </div>
  )
}

// Só entra quem está logado. Quem não está vai para o login e, depois de
// entrar, o login pode devolver para a página que a pessoa tentou abrir.
export function RequireAuth() {
  const { data: user, isPending, error, refetch } = useCurrentUser()
  const location = useLocation()

  if (isPending) return <Loading />

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
        <p role="alert">{error.message}</p>
        <Button onClick={() => void refetch()}>Tentar de novo</Button>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

// Vai dentro do RequireAuth. Esconder o menu não protege nada: quem decide de
// verdade é o back, aqui é só a experiência de quem não tem o papel.
export function RequireRole({ roles }: { roles: Role[] }) {
  const { data: user } = useCurrentUser()

  if (!user || !roles.includes(user.role)) return <ForbiddenPage />

  return <Outlet />
}

// A página que o RequireAuth guardou, ou o início.
function returnPath(state: unknown): string {
  const from = (state as { from?: Partial<Path> } | null)?.from

  if (!from?.pathname) return "/"

  return `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`
}

// Login e cadastro: quem já está logado não precisa vê-los.
export function PublicOnly() {
  const { data: user, isPending } = useCurrentUser()
  const location = useLocation()

  if (isPending) return <Loading />
  if (user) return <Navigate to={returnPath(location.state)} replace />

  return <Outlet />
}
