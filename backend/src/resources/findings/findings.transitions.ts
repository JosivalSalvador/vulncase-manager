import { AppError } from "../../utils/AppError.js"
import type { FindingStatus } from "./findings.types.js"

export const allowedTransitions: Record<FindingStatus, FindingStatus[]> = {
  OPEN: ["IN_PROGRESS", "ACCEPTED_RISK", "FALSE_POSITIVE"],
  IN_PROGRESS: ["OPEN", "FIXED", "ACCEPTED_RISK", "FALSE_POSITIVE"],
  FIXED: ["VERIFIED", "IN_PROGRESS", "OPEN"],
  VERIFIED: ["OPEN"],
  ACCEPTED_RISK: ["OPEN"],
  FALSE_POSITIVE: ["OPEN"],
}

export function assertTransitionAllowed(
  from: FindingStatus,
  to: FindingStatus,
): void {
  if (from === to) {
    throw new AppError(409, `O achado já está com o status ${to}`)
  }

  const allowed = allowedTransitions[from]
  if (!allowed.includes(to)) {
    throw new AppError(
      409,
      `Não é possível mudar de ${from} para ${to}. Permitidos: ${allowed.join(", ")}`,
    )
  }
}
