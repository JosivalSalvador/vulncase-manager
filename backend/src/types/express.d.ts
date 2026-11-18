import type { PublicUser } from "../resources/auth/auth.types.js"

declare module "express-serve-static-core" {
  interface Request {
    user?: PublicUser
  }
}
