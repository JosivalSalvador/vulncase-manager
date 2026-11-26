import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link } from "react-router"

import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { AuthCard } from "@/features/auth/auth-card"
import { registerSchema } from "@/features/auth/schema"
import { useRegister } from "@/features/auth/use-register"

export function RegisterPage() {
  const signUp = useRegister()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullname: "", email: "", password: "" },
  })

  return (
    <AuthCard
      title="Criar conta"
      description="Cadastre-se para registrar e acompanhar achados."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="underline underline-offset-4">
            Entrar
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={handleSubmit((values) => signUp.mutate(values))}
      >
        <FormField
          label="Nome completo"
          autoComplete="name"
          error={errors.fullname?.message}
          {...register("fullname")}
        />
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
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />

        {signUp.error && (
          <p role="alert" className="text-sm text-destructive">
            {signUp.error.message}
          </p>
        )}

        <Button type="submit" size="lg" disabled={signUp.isPending}>
          {signUp.isPending ? "Criando…" : "Criar conta"}
        </Button>
      </form>
    </AuthCard>
  )
}
