import type { ReactNode } from "react"

import { ROLE_LABELS } from "@/features/auth/types"

import type { Member } from "./types"

const dateFormat = new Intl.DateTimeFormat("pt-BR")

type MemberListTableProps = {
  members: Member[]
  // Sem isso, a tabela não tem coluna de ações.
  renderActions?: (member: Member) => ReactNode
}

export function MemberListTable({
  members,
  renderActions,
}: MemberListTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Lista de membros</caption>
        <thead className="text-muted-foreground">
          <tr className="border-b text-left">
            <th scope="col" className="p-3 font-medium">
              Membro
            </th>
            <th scope="col" className="p-3 font-medium">
              E-mail
            </th>
            <th scope="col" className="p-3 font-medium">
              Papel
            </th>
            <th scope="col" className="p-3 font-medium whitespace-nowrap">
              Entrou em
            </th>
            {renderActions && (
              <th scope="col" className="p-3">
                <span className="sr-only">Ações</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.userId} className="border-b last:border-0">
              <th scope="row" className="p-3 text-left font-medium">
                <span className="flex flex-wrap items-center gap-2">
                  {member.fullname}
                  {/* Texto, não só cor: quem não distingue cores também vê. */}
                  {member.isOwner && (
                    <span className="rounded-md border px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                      Dono
                    </span>
                  )}
                </span>
              </th>
              <td className="p-3 text-muted-foreground">{member.email}</td>
              <td className="p-3 whitespace-nowrap">
                {ROLE_LABELS[member.role]}
              </td>
              <td className="p-3 whitespace-nowrap tabular-nums">
                {dateFormat.format(new Date(member.joinedAt))}
              </td>
              {renderActions && (
                <td className="p-3 whitespace-nowrap">
                  {renderActions(member)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
