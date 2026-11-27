import { SeverityBadge, StatusBadge } from "./badges"
import { formatDueDate, isOverdue } from "./due-date"
import type { Finding } from "./types"

type FindingListTableProps = {
  findings: Finding[]
}

export function FindingListTable({ findings }: FindingListTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Lista de achados</caption>
        <thead className="text-muted-foreground">
          <tr className="border-b text-left">
            <th scope="col" className="p-3 font-medium">
              Achado
            </th>
            <th scope="col" className="p-3 font-medium">
              Severidade
            </th>
            <th scope="col" className="p-3 font-medium">
              Status
            </th>
            <th scope="col" className="p-3 font-medium">
              Ativo
            </th>
            <th scope="col" className="p-3 font-medium">
              Responsável
            </th>
            <th scope="col" className="p-3 font-medium whitespace-nowrap">
              Prazo
            </th>
          </tr>
        </thead>
        <tbody>
          {findings.map((finding) => (
            <tr key={finding.id} className="border-b last:border-0">
              <th scope="row" className="p-3 text-left font-medium">
                {finding.title}
              </th>
              <td className="p-3">
                <SeverityBadge severity={finding.severity} />
              </td>
              <td className="p-3">
                <StatusBadge status={finding.status} />
              </td>
              <td className="p-3">
                {finding.asset?.name ?? (
                  <span className="text-muted-foreground">Sem ativo</span>
                )}
              </td>
              <td className="p-3">
                {finding.assignee?.fullname ?? (
                  <span className="text-muted-foreground">Sem responsável</span>
                )}
              </td>
              <td className="p-3 whitespace-nowrap tabular-nums">
                {finding.dueDate === null ? (
                  <span className="text-muted-foreground">Sem prazo</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    {formatDueDate(finding.dueDate)}
                    {/* Texto, não só cor: quem não distingue cores também vê. */}
                    {isOverdue(finding) && (
                      <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                        Vencido
                      </span>
                    )}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
