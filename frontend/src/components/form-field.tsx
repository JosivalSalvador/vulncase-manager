import { useId, type ComponentProps } from "react"

import { Input } from "@/components/ui/input"

type FormFieldProps = ComponentProps<"input"> & {
  label: string
  error?: string
}

// Campo com rótulo e mensagem de erro ligados ao input (leitor de tela).
export function FormField({ label, error, ...props }: FormFieldProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
