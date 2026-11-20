import { randomUUID } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { env } from "../utils/getEnv.js"

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export const uploadRoot = path.resolve(env.UPLOAD_DIR)

// O nome guardado é SEMPRE gerado aqui (uuid + extensão validada), nunca o
// nome enviado pelo usuário. A conferência abaixo garante que não sai da pasta.
export function getStoredFilePath(storedName: string): string {
  if (path.basename(storedName) !== storedName) {
    throw new Error("Nome de arquivo inválido")
  }
  return path.join(uploadRoot, storedName)
}

export async function saveFile(
  buffer: Buffer,
  extension: string,
): Promise<string> {
  await mkdir(uploadRoot, { recursive: true, mode: 0o750 })
  const storedName = `${randomUUID()}.${extension}`
  // flag "wx": falha se o arquivo já existir, em vez de sobrescrever.
  await writeFile(getStoredFilePath(storedName), buffer, {
    flag: "wx",
    mode: 0o640,
  })
  return storedName
}

// Remove arquivos do disco. Não lança erro: se um arquivo não puder ser
// apagado, o registro no banco já foi tratado e só registramos no log.
export async function removeFiles(storedNames: string[]): Promise<void> {
  await Promise.all(
    storedNames.map(async (storedName) => {
      try {
        await rm(getStoredFilePath(storedName), { force: true })
      } catch (error) {
        console.error("Falha ao remover arquivo", storedName, error)
      }
    }),
  )
}
