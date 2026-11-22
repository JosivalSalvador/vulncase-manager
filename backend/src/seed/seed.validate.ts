import { ZodError } from "zod"

import { createFindingSchema } from "../resources/findings/findings.schema.js"
import { assertTransitionAllowed } from "../resources/findings/findings.transitions.js"
import type { FindingStatus } from "../generated/prisma/enums.js"
import type {
  DemoFinding,
  DemoProject,
  DemoUser,
  DemoUserKey,
} from "./seed.data.js"

// Os campos de texto passam pelas MESMAS regras da API (tamanhos, formato do
// CWE e do CVE, categoria OWASP do catálogo). Ativo, responsável e prazo são
// conferidos à parte, porque ainda não têm id.
const findingFieldsSchema = createFindingSchema.omit({
  assetId: true,
  assigneeId: true,
  dueDate: true,
})

export function finalStatus(finding: DemoFinding): FindingStatus {
  return finding.steps.at(-1)?.to ?? "OPEN"
}

function fail(where: string, message: string): never {
  throw new Error(`Seed inválido em ${where}: ${message}`)
}

export function validateDemoData(
  users: DemoUser[],
  projects: DemoProject[],
): void {
  const roles = new Map<DemoUserKey, DemoUser["role"]>(
    users.map((user) => [user.key, user.role]),
  )

  const emails = new Set(users.map((user) => user.email))
  if (emails.size !== users.length || roles.size !== users.length) {
    fail("usuários", "e-mail ou chave repetidos")
  }

  // Quem cria ou muda achado precisa ser membro do projeto e poder escrever.
  const assertCanWork = (
    where: string,
    key: DemoUserKey,
    members: Set<DemoUserKey>,
  ): void => {
    if (!members.has(key)) {
      fail(where, `${key} não é membro do projeto`)
    }
    if (roles.get(key) === "VIEWER") {
      fail(where, `${key} é VIEWER e não pode escrever`)
    }
  }

  for (const project of projects) {
    const members = new Set(project.members)
    const assetNames = new Set(project.assets.map((asset) => asset.name))

    if (assetNames.size !== project.assets.length) {
      fail(project.name, "nomes de ativo repetidos")
    }
    assertCanWork(project.name, project.owner, members)

    for (const finding of project.findings) {
      const where = `${project.name} / ${finding.title}`

      try {
        findingFieldsSchema.parse(finding)
      } catch (error) {
        if (error instanceof ZodError) {
          const issues = error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")
          fail(where, issues)
        }
        throw error
      }

      if (!assetNames.has(finding.asset)) {
        fail(where, `ativo inexistente (${finding.asset})`)
      }
      assertCanWork(where, finding.reporter, members)
      if (finding.assignee) {
        assertCanWork(where, finding.assignee, members)
      }

      // Os passos seguem as regras de transição da API e a ordem do tempo.
      let previous: FindingStatus = "OPEN"
      let previousDay = finding.createdDaysAgo
      for (const step of finding.steps) {
        assertTransitionAllowed(previous, step.to)
        if (step.daysAgo >= previousDay) {
          fail(where, "os passos precisam estar em ordem cronológica")
        }
        assertCanWork(where, step.by, members)
        previous = step.to
        previousDay = step.daysAgo
      }
    }
  }
}
