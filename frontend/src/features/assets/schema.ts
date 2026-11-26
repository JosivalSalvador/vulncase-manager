import { z } from "zod"

import type { AssetBody } from "./types"

// Espelha o createAssetSchema do back, só para avisar antes de enviar.
export const assetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome precisa de pelo menos 2 caracteres")
    .max(120, "O nome tem no máximo 120 caracteres"),
  type: z.enum(["WEB", "MOBILE", "NETWORK", "CODE"], {
    error: "Escolha o tipo do ativo",
  }),
  identifier: z
    .string()
    .trim()
    .max(255, "O identificador tem no máximo 255 caracteres"),
})

export type AssetFormValues = z.infer<typeof assetSchema>

// O formulário trabalha com texto; o back guarda "sem identificador" como null.
export function toAssetBody(values: AssetFormValues): AssetBody {
  return {
    name: values.name,
    type: values.type,
    identifier: values.identifier === "" ? null : values.identifier,
  }
}
