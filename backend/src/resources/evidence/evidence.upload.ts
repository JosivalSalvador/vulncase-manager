import multer from "multer"

import { MAX_UPLOAD_BYTES } from "../../lib/storage.js"

// O arquivo fica na memória (máx. 5 MB) para ser VALIDADO antes de ir ao disco.
// Aceita um único arquivo no campo "file" e nenhum campo de texto.
export const uploadSingleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 },
}).single("file")
