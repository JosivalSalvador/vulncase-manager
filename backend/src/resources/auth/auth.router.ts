import { Router } from "express"

import {
  loginRateLimit,
  registerRateLimit,
} from "../../middlewares/rateLimit.js"
import { validate } from "../../middlewares/validate.js"
import { login, logout, me, register } from "./auth.controller.js"
import { loginSchema, registerSchema } from "./auth.schema.js"

const authRouter: Router = Router()

authRouter.post(
  "/register",
  registerRateLimit,
  validate({ body: registerSchema }),
  register,
)
authRouter.post(
  "/login",
  loginRateLimit,
  validate({ body: loginSchema }),
  login,
)
authRouter.post("/logout", logout)
authRouter.get("/me", me)

export default authRouter
