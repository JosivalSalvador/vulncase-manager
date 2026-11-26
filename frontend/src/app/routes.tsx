import type { RouteObject } from "react-router"

import { LoginPage } from "@/pages/login-page"
import { NotFoundPage } from "@/pages/not-found-page"
import {
  AdminUsersPage,
  DashboardPage,
  ProjectPage,
  ProjectsPage,
  RegisterPage,
} from "@/pages/placeholders"

import { AppLayout } from "./app-layout"
import { PublicOnly, RequireAuth, RequireRole } from "./auth-guards"

export const routes: RouteObject[] = [
  {
    element: <PublicOnly />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/projects", element: <ProjectsPage /> },
          { path: "/projects/:projectId", element: <ProjectPage /> },
          {
            element: <RequireRole roles={["ADMIN"]} />,
            children: [{ path: "/admin/users", element: <AdminUsersPage /> }],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]
