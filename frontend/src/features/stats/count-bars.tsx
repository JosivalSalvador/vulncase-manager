type CountBarsProps<K extends string> = {
  title: string
  options: readonly { value: K; label: string; color: string }[]
  counts: Record<K, number>
}

// Barras proporcionais ao maior valor. O rótulo e o número estão sempre em
// texto: a cor e o tamanho da barra são só reforço.
export function CountBars<K extends string>({
  title,
  options,
  counts,
}: CountBarsProps<K>) {
  const max = Math.max(1, ...options.map((option) => counts[option.value]))

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-medium">{title}</h2>
      <ul aria-label={title} className="space-y-2 text-sm">
        {options.map((option) => (
          <li key={option.value} className="flex items-center gap-3">
            <span className="w-28 shrink-0">{option.label}</span>
            <span
              aria-hidden="true"
              className="h-2 flex-1 rounded-full bg-muted"
            >
              <span
                className={`block h-full rounded-full ${option.color}`}
                style={{ width: `${(counts[option.value] / max) * 100}%` }}
              />
            </span>
            <span className="w-8 text-right tabular-nums">
              {counts[option.value]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
