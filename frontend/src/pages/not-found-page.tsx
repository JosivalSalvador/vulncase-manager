import { Link } from "react-router"

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-muted-foreground">
        O endereço não existe ou foi movido.
      </p>
      <Link to="/" className="underline underline-offset-4">
        Voltar ao início
      </Link>
    </div>
  )
}
