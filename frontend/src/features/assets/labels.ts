// Tipos de ativo, na ordem em que aparecem na tela.
export const ASSET_TYPES = [
  { value: "WEB", label: "Web" },
  { value: "MOBILE", label: "Mobile" },
  { value: "NETWORK", label: "Rede" },
  { value: "CODE", label: "Código" },
] as const

export type AssetType = (typeof ASSET_TYPES)[number]["value"]
