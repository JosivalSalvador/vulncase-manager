import type { RouteObject } from "react-router"

import { NotFoundPage } from "@/pages/not-found-page"
import {
  AdminUsersPage,
  DashboardPage,
  LoginPage,
  ProjectPage,
  ProjectsPage,
  RegisterPage,
} from "@/pages/placeholders"

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
      { path: "/", element: <DashboardPage /> },
      { path: "/projects", element: <ProjectsPage /> },
      { path: "/projects/:projectId", element: <ProjectPage /> },
      {
        element: <RequireRole roles={["ADMIN"]} />,
        children: [{ path: "/admin/users", element: <AdminUsersPage /> }],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]
