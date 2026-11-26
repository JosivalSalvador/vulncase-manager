import { Outlet } from "react-router"

import { ModeToggle } from "@/components/mode-toggle"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useCurrentUser } from "@/features/auth/use-current-user"

import { AppSidebar } from "./app-sidebar"

// Vai dentro do RequireAuth, então o usuário já existe quando chega aqui.
export function AppLayout() {
  const { data: user } = useCurrentUser()

  if (!user) return null

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
