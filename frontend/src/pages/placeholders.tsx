import { PagePlaceholder } from "@/components/page-placeholder"

// Páginas provisórias: cada uma vira um arquivo próprio quando for construída.
export function LoginPage() {
  return <PagePlaceholder title="Entrar" />
}

export function RegisterPage() {
  return <PagePlaceholder title="Criar conta" />
}

export function DashboardPage() {
  return <PagePlaceholder title="Dashboard" />
}

export function ProjectsPage() {
  return <PagePlaceholder title="Projetos" />
}

export function ProjectPage() {
  return <PagePlaceholder title="Projeto" />
}

export function AdminUsersPage() {
  return <PagePlaceholder title="Usuários" />
}
