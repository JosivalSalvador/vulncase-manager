import { FormSelect } from "@/components/form-select"

import { STALE_OPTIONS } from "./filters"
import {
  SEVERITIES,
  STATUSES,
  type FindingStatus,
  type Severity,
} from "./labels"

export type FilterKey = "severity" | "status" | "overdue" | "stale"

type FindingFiltersProps = {
  severity: Severity | undefined
  status: FindingStatus | undefined
  overdue: boolean
  staleDays: number | undefined
  // Valor vazio (undefined) tira o filtro.
  onChange: (key: FilterKey, value: string | undefined) => void
}

export function FindingFilters({
  severity,
  status,
  overdue,
  staleDays,
  onChange,
}: FindingFiltersProps) {
  return (
    <>
      <div className="w-44">
        <FormSelect
          label="Severidade"
          value={severity ?? ""}
          onChange={(event) =>
            onChange("severity", event.target.value || undefined)
          }
        >
          <option value="">Todas</option>
          {SEVERITIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </FormSelect>
      </div>
      <div className="w-44">
        <FormSelect
          label="Status"
          value={status ?? ""}
          onChange={(event) =>
            onChange("status", event.target.value || undefined)
          }
        >
          <option value="">Todos</option>
          {STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </FormSelect>
      </div>
      <div className="w-44">
        <FormSelect
          label="Parados"
          value={staleDays === undefined ? "" : String(staleDays)}
          onChange={(event) =>
            onChange("stale", event.target.value || undefined)
          }
        >
          <option value="">Qualquer tempo</option>
          {STALE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </FormSelect>
      </div>
      <label className="flex h-8 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={overdue}
          onChange={(event) =>
            onChange("overdue", event.target.checked ? "true" : undefined)
          }
        />
        Só vencidos
      </label>
    </>
  )
}
