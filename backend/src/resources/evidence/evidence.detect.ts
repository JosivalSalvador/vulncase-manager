import { isUtf8 } from "node:buffer"

import { fileTypeFromBuffer } from "file-type"

// Tipos aceitos como evidência, com a extensão usada no disco.
// SVG, HTML, ZIP e executáveis ficam de fora de propósito.
const allowedTypes: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
}

export interface DetectedFile {
  mimeType: string
  extension: string
}

// Descobre o tipo pelo CONTEÚDO do arquivo (os primeiros bytes), ignorando o
// nome e o Content-Type que o cliente mandou, que são fáceis de forjar.
export async function detectAllowedFileType(
  buffer: Buffer,
): Promise<DetectedFile | null> {
  const detected = await fileTypeFromBuffer(buffer)

  if (detected) {
    const extension = allowedTypes[detected.mime]
    return extension ? { mimeType: detected.mime, extension } : null
  }

  // Sem assinatura conhecida: só vale se for texto puro (UTF-8, sem byte nulo).
  if (isUtf8(buffer) && !buffer.includes(0)) {
    return { mimeType: "text/plain", extension: "txt" }
  }

  return null
}
