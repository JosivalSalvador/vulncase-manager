import { execSync } from "node:child_process"

import { getTestDatabaseUrl } from "./testEnv.js"

// Roda uma vez, antes de todos os testes de integração: aplica as migrations
// do repositório no banco de teste, para ele nunca ficar com tabelas velhas.
export default function setup(): void {
  const databaseUrl: string = getTestDatabaseUrl()

  try {
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    })
  } catch (error) {
    const where: URL = new URL(databaseUrl)
    const output: string =
      error instanceof Error && "stdout" in error && "stderr" in error
        ? `${String(error.stdout)}${String(error.stderr)}`
        : ""

    throw new Error(
      `Não consegui aplicar as migrations no banco de teste ` +
        `(${where.host}${where.pathname}).\n` +
        `O banco está no ar? Rode: npm run test:db\n${output}`,
      { cause: error },
    )
  }
}
