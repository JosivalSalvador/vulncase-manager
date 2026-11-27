import type { PossibleDuplicate } from "./types"

type DuplicatesWarningProps = {
  duplicates: PossibleDuplicate[]
}

// Só avisa: quem decide se é repetido é a pessoa.
export function DuplicatesWarning({ duplicates }: DuplicatesWarningProps) {
  // A região fica sempre na tela para o leitor de tela anunciar quando encher.
  // Vazia, a margem negativa desfaz o espaço que ela ocuparia no formulário.
  return (
    <div role="status" className="empty:-mt-4">
      {duplicates.length > 0 && (
        <div className="space-y-1 rounded-lg border border-destructive/50 p-3">
          <p className="font-medium">
            Pode ser repetido. Achados abertos parecidos:
          </p>
          <ul className="list-disc pl-4">
            {duplicates.map(({ finding, reasons }) => (
              <li key={finding.id}>
                {finding.title}{" "}
                <span className="text-muted-foreground">
                  ({reasons.join(", ")})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
