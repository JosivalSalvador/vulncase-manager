import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link } from "react-router"

import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { AuthCard } from "@/features/auth/auth-card"
import { loginSchema } from "@/features/auth/schema"
import { useLogin } from "@/features/auth/use-login"

export function LoginPage() {
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  return (
    <AuthCard
      title="Entrar"
      description="Acesse seus projetos e achados."
      footer={
        <>
          Não tem conta?{" "}
          <Link to="/register" className="underline underline-offset-4">
            Criar conta
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={handleSubmit((values) => login.mutate(values))}
      >
        <FormField
          label="E-mail"
          type="email"
          autoComplete="username"
          error={errors.email?.message}
          {...register("email")}
        />
        <FormField
          label="Senha"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        {login.error && (
          <p role="alert" className="text-sm text-destructive">
            {login.error.message}
          </p>
        )}

        <Button type="submit" size="lg" disabled={login.isPending}>
          {login.isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthCard>
  )
}
