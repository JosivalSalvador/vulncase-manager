import type { ReactNode } from "react"

import { assetTypeLabel } from "./labels"
import type { Asset } from "./types"

const dateFormat = new Intl.DateTimeFormat("pt-BR")

type AssetListTableProps = {
  assets: Asset[]
  // Sem isso, a tabela não tem coluna de ações (quem só lê).
  renderActions?: (asset: Asset) => ReactNode
}

export function AssetListTable({ assets, renderActions }: AssetListTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Lista de ativos</caption>
        <thead className="text-muted-foreground">
          <tr className="border-b text-left">
            <th scope="col" className="p-3 font-medium">
              Ativo
            </th>
            <th scope="col" className="p-3 font-medium">
              Tipo
            </th>
            <th scope="col" className="p-3 font-medium">
              Identificador
            </th>
            <th scope="col" className="p-3 font-medium whitespace-nowrap">
              Criado em
            </th>
            {renderActions && (
              <th scope="col" className="p-3">
                <span className="sr-only">Ações</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id} className="border-b last:border-0">
              <th
                scope="row"
                className="p-3 text-left font-medium whitespace-nowrap"
              >
                {asset.name}
              </th>
              <td className="p-3 whitespace-nowrap">
                {assetTypeLabel(asset.type)}
              </td>
              {/* Sempre texto: o valor é livre e nunca vira link. */}
              <td
                title={asset.identifier ?? undefined}
                className="max-w-md truncate p-3 text-muted-foreground"
              >
                {asset.identifier ?? "Sem identificador"}
              </td>
              <td className="p-3 whitespace-nowrap tabular-nums">
                {dateFormat.format(new Date(asset.createdAt))}
              </td>
              {renderActions && (
                <td className="p-3 whitespace-nowrap">
                  {renderActions(asset)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
