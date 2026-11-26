import { Link } from "react-router"

export function ForbiddenPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 py-24 text-center">
      <h1 className="text-2xl font-semibold">Sem permissão</h1>
      <p className="text-muted-foreground">
        Você não tem acesso a esta página.
      </p>
      <Link to="/" className="underline underline-offset-4">
        Voltar ao início
      </Link>
    </div>
  )
}
