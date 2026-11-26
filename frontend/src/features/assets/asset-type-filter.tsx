import { Button } from "@/components/ui/button"

import { ASSET_TYPES, type AssetType } from "./labels"

type AssetTypeFilterProps = {
  // undefined = todos os tipos.
  value: AssetType | undefined
  onChange: (type: AssetType | undefined) => void
}

// Botões em vez de um menu: são só 4 tipos, e todos ficam à vista.
export function AssetTypeFilter({ value, onChange }: AssetTypeFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filtrar por tipo"
      className="flex flex-wrap gap-2"
    >
      <Button
        variant={value === undefined ? "default" : "outline"}
        size="sm"
        aria-pressed={value === undefined}
        onClick={() => onChange(undefined)}
      >
        Todos
      </Button>
      {ASSET_TYPES.map((type) => (
        <Button
          key={type.value}
          variant={value === type.value ? "default" : "outline"}
          size="sm"
          aria-pressed={value === type.value}
          onClick={() => onChange(type.value)}
        >
          {type.label}
        </Button>
      ))}
    </div>
  )
}
