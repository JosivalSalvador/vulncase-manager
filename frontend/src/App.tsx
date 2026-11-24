import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"

export default function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <h1 className="text-3xl font-bold">VulnCase</h1>
      <Button>Botão de teste</Button>
    </div>
  )
}
