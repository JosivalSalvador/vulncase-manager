import type { RouteObject } from "react-router"

import { LoginPage } from "@/pages/login-page"
import { NotFoundPage } from "@/pages/not-found-page"
import { RegisterPage } from "@/pages/register-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { ProjectsPage } from "@/pages/projects-page"
import { ProjectPage } from "@/pages/project-page"
import { ProjectAssetsPage } from "@/pages/project-assets-page"
import { ProjectFindingsPage } from "@/pages/project-findings-page"
import { ProjectMembersPage } from "@/pages/project-members-page"
import { AdminUsersPage } from "@/pages/placeholders"

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
            path: "/projects/:projectId/findings",
            element: <ProjectFindingsPage />,
          },
          {
            path: "/projects/:projectId/assets",
            element: <ProjectAssetsPage />,
          },
          {
            path: "/projects/:projectId/members",
            element: <ProjectMembersPage />,
          },
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
