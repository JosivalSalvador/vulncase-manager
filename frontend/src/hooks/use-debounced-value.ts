import { useEffect, useState } from "react"

// Devolve o valor só depois de ele ficar parado por `delayMs`.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)

    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
