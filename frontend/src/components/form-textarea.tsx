import { useId, type ComponentProps } from "react"

import { Textarea } from "@/components/ui/textarea"

type FormTextareaProps = ComponentProps<"textarea"> & {
  label: string
  error?: string
}

// Igual ao FormField, para texto em várias linhas.
export function FormTextarea({ label, error, ...props }: FormTextareaProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Textarea
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
