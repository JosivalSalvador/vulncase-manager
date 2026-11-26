import type { ReactNode } from "react"
import { Link } from "react-router"

import type { Project } from "./types"

const dateFormat = new Intl.DateTimeFormat("pt-BR")

type ProjectListTableProps = {
  projects: Project[]
  // Sem isso, a tabela não tem coluna de ações (quem só lê).
  renderActions?: (project: Project) => ReactNode
}

export function ProjectListTable({
  projects,
  renderActions,
}: ProjectListTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Lista de projetos</caption>
        <thead className="text-muted-foreground">
          <tr className="border-b text-left">
            <th scope="col" className="p-3 font-medium">
              Projeto
            </th>
            <th scope="col" className="p-3 font-medium">
              Descrição
            </th>
            <th scope="col" className="p-3 font-medium whitespace-nowrap">
              Criado em
            </th>
            {renderActions && (
              <th scope="col" className="p-3">
                <span className="sr-only">Ações</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="border-b last:border-0">
              <th
                scope="row"
                className="p-3 text-left font-medium whitespace-nowrap"
              >
                <Link
                  to={`/projects/${project.id}`}
                  className="underline underline-offset-4"
                >
                  {project.name}
                </Link>
              </th>
              <td className="max-w-md truncate p-3 text-muted-foreground">
                {project.description ?? "Sem descrição"}
              </td>
              <td className="p-3 whitespace-nowrap tabular-nums">
                {dateFormat.format(new Date(project.createdAt))}
              </td>
              {renderActions && (
                <td className="p-3 whitespace-nowrap">
                  {renderActions(project)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
