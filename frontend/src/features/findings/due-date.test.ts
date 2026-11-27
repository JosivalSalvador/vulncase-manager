import { describe, expect, it } from "vitest"

import { formatDueDate, isOverdue } from "./due-date"

// 27/11/2026, meio-dia no fuso local.
const now = new Date(2026, 10, 27, 12)

describe("formatDueDate", () => {
  it("mostra o dia guardado, sem voltar um dia por causa do fuso", () => {
    expect(formatDueDate("2026-12-01T00:00:00.000Z")).toBe("01/12/2026")
  })
})

describe("isOverdue", () => {
  it("achado aberto com o prazo num dia anterior a hoje está vencido", () => {
    expect(
      isOverdue({ status: "OPEN", dueDate: "2026-11-26T00:00:00.000Z" }, now),
    ).toBe(true)
    expect(
      isOverdue(
        { status: "IN_PROGRESS", dueDate: "2020-01-01T00:00:00.000Z" },
        now,
      ),
    ).toBe(true)
  })

  it("o prazo de hoje e os futuros ainda não venceram", () => {
    expect(
      isOverdue({ status: "OPEN", dueDate: "2026-11-27T00:00:00.000Z" }, now),
    ).toBe(false)
    expect(
      isOverdue({ status: "OPEN", dueDate: "2026-11-28T00:00:00.000Z" }, now),
    ).toBe(false)
  })

  it("achado que não está aberto nunca vence", () => {
    for (const status of [
      "FIXED",
      "VERIFIED",
      "ACCEPTED_RISK",
      "FALSE_POSITIVE",
    ] as const) {
      expect(
        isOverdue({ status, dueDate: "2020-01-01T00:00:00.000Z" }, now),
      ).toBe(false)
    }
  })

  it("sem prazo, não vence", () => {
    expect(isOverdue({ status: "OPEN", dueDate: null }, now)).toBe(false)
  })
})
