import { describe, expect, it } from "vitest"

import { startOfToday } from "./dates.js"

const MANAUS = "America/Manaus"

describe("startOfToday", (): void => {
  it("usa o dia do calendário do fuso informado", (): void => {
    // 01:00 UTC do dia 23 ainda é 21:00 do dia 22 em Manaus (UTC-4).
    const now: Date = new Date("2026-11-23T01:00:00.000Z")

    expect(startOfToday(now, MANAUS).toISOString()).toBe(
      "2026-11-22T00:00:00.000Z",
    )
    expect(startOfToday(now, "UTC").toISOString()).toBe(
      "2026-11-23T00:00:00.000Z",
    )
  })

  it("avança o dia em fuso à frente do UTC", (): void => {
    // 23:00 UTC do dia 22 já é 08:00 do dia 23 em Tóquio (UTC+9).
    const now: Date = new Date("2026-11-22T23:00:00.000Z")

    expect(startOfToday(now, "Asia/Tokyo").toISOString()).toBe(
      "2026-11-23T00:00:00.000Z",
    )
  })

  it("troca de dia exatamente à meia-noite do fuso", (): void => {
    const antes: Date = new Date("2026-11-23T03:59:59.999Z")
    const meiaNoite: Date = new Date("2026-11-23T04:00:00.000Z")

    expect(startOfToday(antes, MANAUS).toISOString()).toBe(
      "2026-11-22T00:00:00.000Z",
    )
    expect(startOfToday(meiaNoite, MANAUS).toISOString()).toBe(
      "2026-11-23T00:00:00.000Z",
    )
  })

  it("prazo de hoje só vence no dia seguinte", (): void => {
    // O prazo "2026-11-22" é guardado como meia-noite UTC desse dia.
    const prazo: Date = new Date("2026-11-22")
    const noiteDoPrazo: Date = new Date("2026-11-23T01:00:00.000Z")
    const manhaSeguinte: Date = new Date("2026-11-23T12:00:00.000Z")

    expect(prazo < startOfToday(noiteDoPrazo, MANAUS)).toBe(false)
    expect(prazo < startOfToday(manhaSeguinte, MANAUS)).toBe(true)
  })
})
