import { QueryClientProvider } from "@tanstack/react-query"
import { createBrowserRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

import { routes } from "@/app/routes"
import { queryClient } from "@/lib/query-client"

const router = createBrowserRouter(routes)

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
