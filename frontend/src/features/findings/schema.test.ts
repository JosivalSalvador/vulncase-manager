import { describe, expect, it } from "vitest"

import {
  findingSchema,
  toDuplicatesParams,
  toFindingBody,
  toFindingFormValues,
} from "./schema"
import type { Finding } from "./types"

const values = {
  title: "SQL Injection no login",
  description: "O campo de e-mail aceita aspas e quebra a consulta.",
  severity: "CRITICAL" as const,
  remediation: "",
  owaspCategory: "",
  cwe: "",
  cve: "",
  dueDate: "",
  assetId: "",
  assigneeId: "",
}

describe("findingSchema", () => {
  it("aceita só os campos obrigatórios", () => {
    expect(findingSchema.safeParse(values).success).toBe(true)
  })

  it("conta título e descrição depois de aparar", () => {
    expect(findingSchema.safeParse({ ...values, title: " ab " }).success).toBe(
      false,
    )
    expect(
      findingSchema.safeParse({ ...values, description: "   curta   " })
        .success,
    ).toBe(false)
  })

  it("normaliza CWE e CVE e recusa formato errado", () => {
    expect(
      findingSchema.parse({
        ...values,
        cwe: " cwe-89 ",
        cve: "cve-2017-0144",
      }),
    ).toMatchObject({ cwe: "CWE-89", cve: "CVE-2017-0144" })
    expect(findingSchema.safeParse({ ...values, cwe: "89" }).success).toBe(
      false,
    )
    expect(
      findingSchema.safeParse({ ...values, cve: "CVE-17-1" }).success,
    ).toBe(false)
  })

  it("recusa severidade que não existe", () => {
    expect(
      findingSchema.safeParse({ ...values, severity: "URGENT" }).success,
    ).toBe(false)
  })
})

describe("toFindingBody", () => {
  it("troca os opcionais vazios por null", () => {
    expect(toFindingBody(values)).toEqual({
      title: values.title,
      description: values.description,
      severity: "CRITICAL",
      remediation: null,
      owaspCategory: null,
      cwe: null,
      cve: null,
      dueDate: null,
      assetId: null,
      assigneeId: null,
    })
  })
})

describe("toFindingFormValues", () => {
  it("deixa a data só com o dia e troca null por texto vazio", () => {
    const finding: Finding = {
      id: "f1",
      title: values.title,
      description: values.description,
      severity: "HIGH",
      status: "OPEN",
      remediation: null,
      owaspCategory: "A03:2021",
      cwe: "CWE-89",
      cve: null,
      dueDate: "2026-12-01T00:00:00.000Z",
      projectId: "p1",
      assetId: "a1",
      reporterId: "u1",
      assigneeId: null,
      createdAt: "2026-11-20T12:00:00.000Z",
      updatedAt: "2026-11-20T12:00:00.000Z",
      asset: { id: "a1", name: "Portal web", type: "WEB" },
      assignee: null,
      reporter: { id: "u1", fullname: "Ana Ribeiro" },
    }

    expect(toFindingFormValues(finding)).toEqual({
      ...values,
      severity: "HIGH",
      owaspCategory: "A03:2021",
      cwe: "CWE-89",
      dueDate: "2026-12-01",
      assetId: "a1",
    })
  })
})

describe("toDuplicatesParams", () => {
  it("não consulta com título curto ou longo demais", () => {
    expect(toDuplicatesParams({ ...values, title: " ab " })).toBeNull()
    expect(toDuplicatesParams({ ...values, title: "a".repeat(201) })).toBeNull()
  })

  it("deixa de fora CWE e CVE incompletos", () => {
    expect(
      toDuplicatesParams({
        title: " XSS na busca ",
        assetId: "",
        cwe: "CWE-",
        cve: "CVE-2024",
      }),
    ).toEqual({ title: "XSS na busca" })
  })

  it("manda ativo, CWE e CVE quando estão completos", () => {
    expect(
      toDuplicatesParams({
        title: "SMBv1 habilitado",
        assetId: "a1",
        cwe: "cwe-89",
        cve: "cve-2017-0144",
      }),
    ).toEqual({
      title: "SMBv1 habilitado",
      assetId: "a1",
      cwe: "CWE-89",
      cve: "CVE-2017-0144",
    })
  })
})
