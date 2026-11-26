import { Link } from "react-router"

import type { ProjectSummary } from "./types"

export function ProjectsTable({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <p className="text-muted-foreground">
        Você ainda não participa de nenhum projeto.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Achados por projeto</caption>
        <thead className="text-muted-foreground">
          <tr className="border-b text-right">
            <th scope="col" className="p-3 text-left font-medium">
              Projeto
            </th>
            <th scope="col" className="p-3 font-medium">
              Achados
            </th>
            <th scope="col" className="p-3 font-medium">
              Abertos
            </th>
            <th scope="col" className="p-3 font-medium">
              Críticos abertos
            </th>
            <th scope="col" className="p-3 font-medium">
              Vencidos
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              className="border-b text-right tabular-nums last:border-0"
            >
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
              <td className="p-3">{project.total}</td>
              <td className="p-3">{project.open}</td>
              <td className="p-3">{project.openCritical}</td>
              <td className="p-3">{project.overdue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
