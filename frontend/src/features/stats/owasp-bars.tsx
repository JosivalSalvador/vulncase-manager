type OwaspBarsProps = {
  entries: { category: string; count: number }[]
  // Nome em português de cada código; sem ele, aparece só o código.
  names?: Map<string, string>
}

// Barras proporcionais à maior categoria. Código, nome e número ficam em
// texto: o tamanho da barra é só reforço.
export function OwaspBars({ entries, names }: OwaspBarsProps) {
  const max = Math.max(1, ...entries.map((entry) => entry.count))

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-medium">Por categoria OWASP</h2>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum achado com categoria OWASP.
        </p>
      ) : (
        <ul aria-label="Por categoria OWASP" className="space-y-3 text-sm">
          {entries.map((entry) => {
            const name = names?.get(entry.category)

            return (
              <li key={entry.category} className="space-y-1">
                <div className="flex justify-between gap-3">
                  <span>
                    {name ? `${entry.category} · ${name}` : entry.category}
                  </span>
                  <span className="tabular-nums">{entry.count}</span>
                </div>
                <span
                  aria-hidden="true"
                  className="block h-2 rounded-full bg-muted"
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${(entry.count / max) * 100}%` }}
                  />
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
