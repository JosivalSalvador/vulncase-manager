import { tmpdir } from "node:os"
import path from "node:path"

import { vi } from "vitest"

import { getTestDatabaseUrl, getTestRedisUrl } from "./testEnv.js"

// O morgan escreveria uma linha por requisição no meio da saída dos testes.
vi.mock("morgan", () => ({
  default:
    (): ((req: unknown, res: unknown, next: () => void) => void) =>
    (_req, _res, next): void => {
      next()
    },
}))

// Estas variáveis são lidas por src/utils/getEnv.ts quando o app é importado.
process.env["NODE_ENV"] = "test"
process.env["DATABASE_URL"] = getTestDatabaseUrl()
process.env["REDIS_URL"] = getTestRedisUrl()
process.env["COOKIE_SECURE"] = "false"
// As evidências enviadas nos testes vão para uma pasta temporária, longe da
// pasta "uploads" do desenvolvimento.
process.env["UPLOAD_DIR"] = path.join(tmpdir(), "vulncase-test-uploads")
