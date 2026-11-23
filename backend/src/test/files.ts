import { crc32, deflateSync } from "node:zlib"

// Arquivos de exemplo para os testes de upload, todos montados aqui no código,
// para o repositório não guardar binários.

function pngChunk(type: string, data: Buffer): Buffer {
  const length: Buffer = Buffer.alloc(4)
  length.writeUInt32BE(data.length)

  const body: Buffer = Buffer.concat([Buffer.from(type, "ascii"), data])
  const checksum: Buffer = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))

  return Buffer.concat([length, body, checksum])
}

// PNG de 1x1 pixel vermelho, válido de verdade: assinatura, IHDR, IDAT e IEND.
export function makePng(): Buffer {
  const header: Buffer = Buffer.alloc(13)
  header.writeUInt32BE(1, 0) // largura
  header.writeUInt32BE(1, 4) // altura
  header.writeUInt8(8, 8) // bits por canal
  header.writeUInt8(2, 9) // cor RGB
  // Compressão, filtro e entrelaçamento ficam em 0.

  // Uma linha: o byte de filtro 0 e o pixel RGB (255, 0, 0).
  const pixel: Buffer = deflateSync(Buffer.from([0, 255, 0, 0]))

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", pixel),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
}

export function makeText(text: string): Buffer {
  return Buffer.from(text, "utf8")
}

// Começa com "MZ" (executável do Windows) e tem bytes que não são texto: seja
// reconhecido pela assinatura ou não, nunca pode ser aceito como evidência.
export function makeExecutable(): Buffer {
  return Buffer.from([
    0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0xff, 0xfe,
  ])
}

// Monta o formulário multipart do upload. O contentType é o que o "navegador"
// declara, e o servidor precisa ignorá-lo: o tipo vem do conteúdo.
export function fileForm(
  content: Buffer,
  filename: string,
  contentType: string,
  field = "file",
): FormData {
  const form: FormData = new FormData()
  // new Uint8Array(...): o TypeScript novo não aceita um Buffer direto como
  // parte de um Blob.
  form.append(
    field,
    new File([new Uint8Array(content)], filename, { type: contentType }),
  )
  return form
}
