import { describe, expect, it } from "vitest"

import { demoProjects, demoUsers, type DemoProject } from "./seed.data.js"
import { finalStatus, validateDemoData } from "./seed.validate.js"

const findings = demoProjects.flatMap((project) => project.findings)

describe("dados do seed de demonstração", (): void => {
  it("passam nas mesmas regras da API", (): void => {
    expect((): void => validateDemoData(demoUsers, demoProjects)).not.toThrow()
  })

  it("cobrem os três tipos de ativo, as severidades e os status", (): void => {
    const types = new Set(
      demoProjects.flatMap((p) => p.assets.map((a) => a.type)),
    )
    expect(types).toEqual(new Set(["WEB", "MOBILE", "NETWORK", "CODE"]))

    expect(new Set(findings.map((f) => f.severity))).toEqual(
      new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
    )
    expect(new Set(findings.map(finalStatus))).toEqual(
      new Set([
        "OPEN",
        "IN_PROGRESS",
        "FIXED",
        "VERIFIED",
        "ACCEPTED_RISK",
        "FALSE_POSITIVE",
      ]),
    )
  })

  it("têm achados vencidos e parados para o dashboard", (): void => {
    const open = findings.filter((f) =>
      ["OPEN", "IN_PROGRESS"].includes(finalStatus(f)),
    )

    expect(open.filter((f) => (f.dueInDays ?? 1) < 0).length).toBeGreaterThan(0)
    expect(open.filter((f) => f.createdDaysAgo > 30).length).toBeGreaterThan(0)
  })

  it("recusa uma mudança de status que a API não permitiria", (): void => {
    const [first] = demoProjects
    const finding = first?.findings[0]
    if (!first || !finding) {
      throw new Error("Dados de demonstração vazios")
    }

    const broken: DemoProject = {
      ...first,
      findings: [
        {
          ...finding,
          steps: [{ to: "VERIFIED", daysAgo: 1, by: "ana" }],
        },
      ],
    }

    expect((): void => validateDemoData(demoUsers, [broken])).toThrow(
      /OPEN para VERIFIED/,
    )
  })

  it("recusa achado criado por quem só pode ler (VIEWER)", (): void => {
    const [first] = demoProjects
    const finding = first?.findings[0]
    if (!first || !finding) {
      throw new Error("Dados de demonstração vazios")
    }

    const broken: DemoProject = {
      ...first,
      findings: [{ ...finding, reporter: "carla" }],
    }

    expect((): void => validateDemoData(demoUsers, [broken])).toThrow(/VIEWER/)
  })
})
