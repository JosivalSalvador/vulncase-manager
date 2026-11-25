export function PagePlaceholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">Em construção.</p>
    </div>
  )
}
