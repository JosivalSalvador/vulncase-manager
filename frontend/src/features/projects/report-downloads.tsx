import { Download } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { apiUrl } from "@/lib/api"

const FORMATS = [
  { format: "md", label: "Relatório em Markdown" },
  { format: "csv", label: "Relatório em CSV" },
] as const

// Link direto para a API: o navegador manda o cookie de sessão e baixa o
// arquivo (o back responde como attachment). Em outra aba, para um erro do
// back não tirar a pessoa do app.
export function ReportDownloads({ projectId }: { projectId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FORMATS.map(({ format, label }) => (
        <a
          key={format}
          href={apiUrl(`/projects/${projectId}/report`, { format })}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          <Download data-icon="inline-start" />
          {label}
        </a>
      ))}
    </div>
  )
}
